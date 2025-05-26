const { Boom } = require("@hapi/boom");

// Palavras-chave para filtrar biografias
const keywords = ["megas", "internet", "net", "gigas", "mb", "mbs", "fornecedor"];

/**
 * Função para lidar com o comando @concorrencia
 * @param {Object} sock - Instância do socket WA
 * @param {Object} msg - Mensagem recebida
 */
async function handleConcorrer(sock, msg) {
    try {
        const groupId = msg.key.remoteJid; // ID do grupo
        if (!groupId.endsWith("@g.us")) {
            console.log("❌ Comando @concorrencia só pode ser usado em grupos.");
            await sock.sendMessage(groupId, { text: "⚠️ Este comando só pode ser usado em grupos." });
            return;
        }

        // Obter lista de participantes do grupo
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants;

        // Array para armazenar números que correspondem às palavras-chave
        const matchingNumbers = [];

        console.log(`🔍 Verificando biografias de ${participants.length} participantes no grupo ${groupId}`);

        // Iterar sobre os participantes e verificar suas biografias
        for (const participant of participants) {
            const userJid = participant.id; // ID do usuário no formato '1234567890@s.whatsapp.net'
            const userStatus = await getUserStatus(sock, userJid); // Obter biografia do usuário

            // Verificar se a biografia contém alguma das palavras-chave
            if (userStatus && containsKeywords(userStatus, keywords)) {
                const phoneNumber = userJid.split("@")[0]; // Extrair número do JID
                matchingNumbers.push(phoneNumber); // Adicionar número à lista
                console.log(`✅ Biografia corresponde: ${phoneNumber}`);
            }
        }

        // Montar mensagem de resposta
        let responseMessage = "📋 Lista de números com biografias correspondentes:\n\n";
        if (matchingNumbers.length > 0) {
            responseMessage += matchingNumbers.map((number) => `📞 +${number}`).join("\n");
        } else {
            responseMessage += "❌ Nenhum número encontrado com as palavras-chave especificadas.";
        }

        // Enviar mensagem de resposta ao grupo
        await sock.sendMessage(groupId, { text: responseMessage });

    } catch (error) {
        console.error("❌ Erro ao processar comando @concorrencia:", error.message || error);
        await sock.sendMessage(msg.key.remoteJid, { text: "❌ Ocorreu um erro ao processar sua solicitação." });
    }
}

/**
 * Função para obter a biografia/status de um usuário
 * @param {Object} sock - Instância do socket WA
 * @param {string} userJid - ID do usuário
 * @returns {string|null} - Biografia do usuário ou null se não disponível
 */
async function getUserStatus(sock, userJid) {
    try {
        const status = await sock.fetchStatus(userJid);
        if (!status || !status.status) {
            console.log(`👤 Usuário: ${userJid}, Biografia: "Sem biografia ou restrição de privacidade"`);
            return null; // Retorna null se não houver biografia ou ocorrer erro
        }
        console.log(`👤 Usuário: ${userJid}, Biografia: "${status.status}"`);
        return status.status.trim(); // Retorna a biografia normalizada
    } catch (error) {
        console.error(`❌ Erro ao buscar biografia do usuário ${userJid}:`, error.message || error);
        return null; // Retorna null em caso de erro
    }
}

/**
 * Função para verificar se uma string contém alguma das palavras-chave
 * @param {string} text - Texto a ser verificado
 * @param {Array<string>} keywords - Lista de palavras-chave
 * @returns {boolean} - Verdadeiro se o texto contiver alguma palavra-chave
 */
function containsKeywords(text, keywords) {
    if (!text) return false; // Retorna falso se o texto for nulo ou vazio
    const lowerCaseText = text.toLowerCase().trim(); // Remove espaços extras e converte para minúsculas
    return keywords.some((keyword) => lowerCaseText.includes(keyword));
}

module.exports = { handleConcorrer };