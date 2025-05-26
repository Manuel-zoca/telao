exports.handleReacaoConcluida = async (sock, reaction) => {
    try {
        const { key, messageReaction, participant } = reaction;
        const from = key?.remoteJid;

        if (!key || !messageReaction || !from) {
            console.log("🚫 Reação inválida ou incompleta.");
            return;
        }

        const emoji = messageReaction.emoji;
        if (emoji !== '✅') return;

        console.log('✅ Reação "✅" detectada');

        const quoted = messageReaction?.contextInfo?.quotedMessage
            || messageReaction?.message?.extendedTextMessage?.contextInfo?.quotedMessage
            || messageReaction?.message?.imageMessage?.contextInfo?.quotedMessage
            || messageReaction?.message?.contextInfo?.quotedMessage;

        let textoOriginal = '';

        if (quoted?.extendedTextMessage?.text) {
            textoOriginal = quoted.extendedTextMessage.text;
        } else if (quoted?.imageMessage?.caption) {
            textoOriginal = quoted.imageMessage.caption;
        } else if (quoted?.conversation) {
            textoOriginal = quoted.conversation;
        }

        if (!textoOriginal) {
            console.log("🚫 Não foi possível extrair o texto da mensagem reagida.");
            return;
        }

        console.log("🤖 Mensagem do bot:", textoOriginal);

        const temPalavraChave = textoOriginal.toLowerCase().includes("comprovante recebido");
        if (!temPalavraChave) {
            console.log("🚫 Mensagem não contém 'comprovante recebido!', ignorando...");
            return;
        }

        const mensagemConfirmacao = `*Feito* 🤖`;
        await sock.sendMessage(from, {
            text: mensagemConfirmacao,
            mentions: [`${participant}@s.whatsapp.net`]
        });

        console.log(`✅ Mensagem "Feito 🤖" enviada`);

    } catch (error) {
        console.error('❌ Erro ao processar reação ✅:', error);
    }
};
