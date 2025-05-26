// Arquivo tabelaHandler.js

/**
 * Função para retornar a tabela de preços.
 * @returns {string} - A tabela de preços formatada.
 */
const getTabelaPrecos = () => {
    return `> ⓘ *❗🛑MEGABYTE* *VODACOM*

*💡ESTAMOS DISPONÍVEIS DAS 6H ÀS 23:00*

*TABELA ATUALIZADA* 04/05/2025

🕓Validade: 1 dia
20MT    📶  1.100MB
30MT    📶  1.650MB
40MT    📶  2.200MB
50MT    📶  2.750MB 
60MT    📶  3.300MB
80MT    📶  4.400MB
100MT  📶  5.500MB
180MT  📶  10.000MB
280MT  📶  15.000MB
360MT  📶  20.000MB


*🗓️MENSAL 30DIAS*
 130MT   📶  5.000MB 
 150MT   📶  6.100MB
170MT    📶  7.200MB
210MT    📶  9.400MB
260MT    📶  10.500MB
520MT    📶   20.000MB
1150MT  📶   50.250MB

> 🚀 _Conectando pessoas,_
> 🚀 _compartilhando megabytes!_


📞 TUDO TOP VODACOM 

📍chamadas e SMS ilimitadas para todas redes

📆30 dias Tudo top


450MT 🔥 Chamadas + SMS ilimitadas + 9.5GB  +10min
Int+30MB Roam

550MT 🔥 Chamadas + SMS ilimitadas + 12.5GB  +10min
Int+30MB Roam

650MT 🔥 Chamadas + SMS ilimitadas + 15.5GB  +10min
Int+30MB Roam

850MT 🔥 Chamadas + SMS ilimitadas + 27.5GB  +10min
Int+30MB Roam

1050MT 🔥 Chamadas + SMS ilimitadas + 25.5GB  +10min
Int+30MB Roam
`.trim();
};

/**
 * Função para enviar a tabela de preços ao grupo.
 * @param {Object} sock - Cliente Baileys.
 * @param {Object} msg - Mensagem recebida.
 */
const handleTabela = async (sock, msg) => {
    const from = msg.key.remoteJid;

    try {
        console.log(`✅ Enviando tabela de preços para o grupo ${from}`);

        // Obtém os metadados do grupo para listar os participantes
        const groupMetadata = await sock.groupMetadata(from).catch(() => null);
        if (!groupMetadata) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
        }

        const participants = groupMetadata.participants.map(p => p.id); // Lista de IDs dos participantes

        // Mensagem inicial com menção a todos os participantes
        const mensagemInicial = `📢 ATENÇÃO, MEMBROS DO GRUPO!`;

        // Envia a mensagem inicial com menções
        await sock.sendMessage(from, {
            text: mensagemInicial,
            mentions: participants, // Menciona todos os participantes
        });

        // Aguarda 4 segundos antes de enviar a tabela
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Obtém a tabela de preços
        const tabelaPrecos = getTabelaPrecos();

        // Divide a tabela de preços em partes menores (máximo de 1000 caracteres por parte)
        const maxCharsPerMessage = 1000; // Limite de caracteres por mensagem
        const partes = [];

        for (let i = 0; i < tabelaPrecos.length; i += maxCharsPerMessage) {
            partes.push(tabelaPrecos.substring(i, i + maxCharsPerMessage));
        }

        // Envia cada parte separadamente
        for (const parte of partes) {
            await sock.sendMessage(from, { text: parte });
            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo entre mensagens
        }

        console.log(`✅ Tabela de preços enviada em ${partes.length} parte(s).`);
    } catch (error) {
        console.error('🚨 Erro ao enviar tabela de preços:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.' });
    }
};

// Exporta a função handleTabela
module.exports = { handleTabela };