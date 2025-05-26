exports.handleRemove = async (sock, msg) => {
    try {
        console.log('✅ handleRemove foi chamado'); // Para debug no console

        const from = msg.key.remoteJid;

        // Verifica se é grupo
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos.' });
        }

        // Extrai texto da mensagem
        let messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        messageText = messageText.trim();

        // Remove caracteres invisíveis (como \u2068 e \u2069)
        messageText = messageText.replace(/[\u200e\u200f\u2068\u2069]/g, '');

        // Garante que começa com /remove, /ban, @remove ou @ban
        const lowerMessage = messageText.toLowerCase();
        if (!lowerMessage.startsWith('/remove') && 
            !lowerMessage.startsWith('/ban') && 
            !lowerMessage.startsWith('@remove') && 
            !lowerMessage.startsWith('@ban')) {
            return;
        }

        // Lista para armazenar números encontrados
        const mentions = [];

        // Divide por "@" ou espaços
        const parts = messageText.split(/@|\s+/);

        for (let part of parts) {
            // Limpa tudo que não é número
            let numero = part.replace(/\D/g, '');

            // Se tiver mais de 8 dígitos, considera válido
            if (numero.length >= 8) {
                mentions.push(numero);
            }
        }

        if (mentions.length === 0) {
            return sock.sendMessage(from, {
                text: '❌ Comando inválido. Use `/ban @número` ou `/remove @número`.'
            });
        }

        // Remove cada participante encontrado
        for (const numero of mentions) {
            const jid = `${numero}@s.whatsapp.net`;

            try {
                await sock.groupParticipantsUpdate(from, [jid], 'remove');
                await sock.sendMessage(from, {
                    text: `🚫 Participante removido: @${numero}`,
                    mentions: [jid]
                });
            } catch (err) {
                console.error(`Erro ao remover ${jid}:`, err);
                await sock.sendMessage(from, {
                    text: `❌ Erro ao remover @${numero}. Verifique se o bot é administrador.`,
                    mentions: [jid]
                });
            }
        }

    } catch (error) {
        console.error('Erro no handleRemove:', error);
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ Erro ao executar o comando.' });
    }
};