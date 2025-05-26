async function handleReaction({ reactionMessage, sock }) {
    try {
        const reaction = reactionMessage?.reaction;
        if (!reaction) {
            console.log("🔕 Sem reação para processar.");
            return;
        }

        const emoji = reaction.text;
        const groupId = reactionMessage.key.remoteJid;
        const senderId = reactionMessage.key.participant;

        console.log(`👤 Reagiu: ${senderId}`);
        console.log(`Emoji: ${emoji}, Grupo: ${groupId}`);

        // Verifica se é grupo e se a reação é 💯
        if (!groupId.endsWith("@g.us") || emoji !== "💯") {
            console.log("🚫 Reação não corresponde a '💯' ou não é um grupo.");
            return;
        }

        // Busca os participantes do grupo
        const metadata = await sock.groupMetadata(groupId);
        const isAdmin = metadata.participants.some(p =>
            p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        if (!isAdmin) {
            console.log("🚫 Quem reagiu não é administrador.");
            return;
        }

        // Envia a resposta
        console.log("👑 Administrador identificado. Enviando mensagem 'Feito'.");
        await sock.sendMessage(groupId, {
            text: "*Feito* 🤖",
        });

        console.log("✅ Mensagem 'Feito' enviada com sucesso!");

    } catch (error) {
        console.error("❌ Erro no handleReaction:", error);
    }
}

module.exports = { handleReaction };