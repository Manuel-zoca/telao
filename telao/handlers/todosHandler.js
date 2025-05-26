// Arquivo todosHandler.js

/**
 * Função para lidar com a menção de todos os membros do grupo.
 * @param {Object} sock - Cliente Baileys.
 * @param {Object} msg - Mensagem recebida.
 */
const handleTodos = async (sock, msg) => {
    const from = msg.key.remoteJid; // ID do grupo ou chat onde a mensagem foi enviada
    const sender = msg.key.participant || msg.key.remoteJid; // ID do remetente da mensagem
    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    try {
        // Verifica se a mensagem contém a palavra-chave "@todos"
        if (messageText && messageText.trim().toLowerCase() === '@todos') {
            console.log(`✅ Detectado comando @todos no grupo ${from}`);

            // Obtém os metadados do grupo para listar os participantes
            const groupMetadata = await sock.groupMetadata(from).catch(() => null);
            if (!groupMetadata) {
                return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
            }

            // Verifica se o remetente é um administrador
            const isAdmin = groupMetadata.participants.some(
                participant => participant.id === sender && participant.admin
            );

            if (!isAdmin) {
                return sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando!' });
            }

            const participants = groupMetadata.participants.map(p => p.id); // Lista de IDs dos participantes

            // Mensagem inicial com menção a todos os participantes
            const mensagemInicial = `📢j@${sender.split('@')[0]}.`;

            // Envia a mensagem inicial com menções
            await sock.sendMessage(from, {
                text: mensagemInicial,
                mentions: participants, // Menciona todos os participantes
            });

            console.log(`✅ Todos os membros do grupo foram mencionados.`);
        }
    } catch (error) {
        console.error('🚨 Erro ao processar comando @todos:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.' });
    }
};

// Exporta a função handleTodos
module.exports = { handleTodos };