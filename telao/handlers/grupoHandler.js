exports.handleGrupo = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid;

        // Verifica se é grupo
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
        }

        // Extrai o conteúdo da mensagem
        const messageContent = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ""
        ).toLowerCase();

        // Verifica se o comando é @grupo on ou @grupo off
        if (messageContent === "@grupo on") {
            // Abre o grupo (permite que todos enviem mensagens)
            await sock.groupSettingUpdate(from, "not_announcement");
            await sock.sendMessage(from, { text: '✅ O grupo foi *aberto* com sucesso. Agora todos podem enviar mensagens.' });
        } else if (messageContent === "@grupo off") {
            // Fecha o grupo (apenas administradores podem enviar mensagens)
            await sock.groupSettingUpdate(from, "announcement");
            await sock.sendMessage(from, { text: '🔒 O grupo foi *fechado* com sucesso. Apenas administradores podem enviar mensagens.' });
        } else {
            // Comando inválido
            await sock.sendMessage(from, { text: '❌ Comando inválido. Use *@grupo on* para abrir ou *@grupo off* para fechar o grupo.' });
        }

    } catch (error) {
        console.error('🚨 Erro ao processar @grupo:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.' });
    }
};