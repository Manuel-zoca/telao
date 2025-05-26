const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const { Boom } = require("@hapi/boom");

// Handlers
const { handleMessage } = require("./handlers/messageHandler");
const { handleConcorrer } = require("./handlers/concorrerHandler");
const { handleListar } = require("./handlers/listarHandler");
const { handleRemove } = require("./handlers/removeHandler");
const { handlePagamento } = require("./handlers/pagamentoHandler");
const { handleGrupo } = require("./handlers/grupoHandler");
const { handleBan } = require("./handlers/banHandler");
const { handleCompra } = require("./handlers/compraHandler");
const { handleTabela } = require("./handlers/tabelaHandler");
const { handleTodos } = require("./handlers/todosHandler");
const { iniciarAgendamento } = require("./handlers/grupoSchedulerHandler");
const { verificarEnvioTabela } = require('./handlers/tabelaScheduler');
const { handleMensagemPix } = require('./handlers/pixHandler');
const { handleComprovanteFoto } = require('./handlers/handleComprovanteFoto');
const { handleReaction } = require("./handlers/reactionHandler");

// Adicione o Express
const express = require('express');
const app = express();

async function iniciarBot(deviceName, authFolder) {
    console.log(`🟢 Iniciando o bot para o dispositivo: ${deviceName}...`);

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        qrTimeout: 60_000,
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
    });

    setInterval(() => {
        verificarEnvioTabela(sock);
    }, 60 * 1000);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`📌 Escaneie o QR Code do dispositivo: ${deviceName}`);
            try {
                const qrBase64 = await QRCode.toDataURL(qr, { type: 'image/png' });
                const base64Data = qrBase64.split(',')[1];
                console.log(`📷 QR Code (base64 PNG) para ${deviceName}:\n`);
                console.log(base64Data);
                console.log("\n🔗 Cole essa string no https://base64.guru/converter/decode/image para gerar a imagem do QR.");
            } catch (err) {
                console.error("❌ Erro ao gerar QR Code base64:", err);
            }
        }

        if (connection === "close") {
            const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.error(`⚠️ Conexão fechada para o dispositivo ${deviceName}. Motivo: ${motivo || "Desconhecido"}`);
            if (motivo === DisconnectReason.loggedOut) {
                console.log(`❌ Bot deslogado no dispositivo ${deviceName}. Reinicie manualmente.`);
                process.exit(0);
            } else {
                console.log(`🔄 Tentando reconectar o dispositivo ${deviceName} em 3 segundos...`);
                setTimeout(() => iniciarBot(deviceName, authFolder), 3000);
            }
        } else if (connection === "open") {
            console.log(`✅ Bot conectado com sucesso ao dispositivo: ${deviceName}`);
            iniciarAgendamento(sock);
            console.log("Inicializado WA v" + require("@whiskeysockets/baileys").version);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        if (!messages || messages.length === 0) return;

        const msg = messages[0];
        const from = msg.key.remoteJid;

        let messageText = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.text || ""
        );

        if (msg.message?.imageMessage && from.endsWith("@g.us")) {
            console.log("📸 [handleComprovanteFoto] Executando handler de comprovante por imagem...");
            await handleComprovanteFoto(sock, msg);
            console.log("✅ Handler de comprovante (handleComprovanteFoto) executado.");
        }

        messageText = messageText.replace(/[\u200e\u200f\u2068\u2069]/g, '').trim();
        const messageContent = messageText.toLowerCase();

        try {
            console.log("💸 [handleMensagemPix] Verificando se é comprovativo PIX...");
            await handleMensagemPix(sock, msg);

            if (messageContent.startsWith('@') || messageContent.startsWith('/')) {
                console.log(`📥 Nova mensagem de ${from} no ${deviceName}: ${messageContent}`);
            }

            if (messageContent === "@concorrentes") {
                console.log("📍 [handleListar] Listando concorrentes...");
                await handleListar(sock, msg);
            } else if (messageContent.startsWith('@remove') || messageContent.startsWith('/remove')) {
                console.log("📍 [handleRemove] Executando remoção...");
                await handleRemove(sock, msg);
            } else if (messageContent.startsWith('@ban') || messageContent.startsWith('/ban')) {
                console.log("📍 [handleBan] Executando banimento...");
                await handleBan(sock, msg);
            } else if (messageContent === "@pagamentos") {
                console.log("📍 [handlePagamento] Exibindo lista de pagamentos...");
                await handlePagamento(sock, msg);
            } else if (messageContent === "@grupo on" || messageContent === "@grupo off") {
                console.log("📍 [handleGrupo] Alterando status do grupo...");
                await handleGrupo(sock, msg);
            } else if (messageContent.startsWith("@compra") || messageContent.startsWith("@rentanas") || messageContent.startsWith("@remove rentanas")) {
                console.log("📍 [handleCompra] Executando compra...");
                await handleCompra(sock, msg);
            } else if (from.endsWith("@g.us") && messageContent === "@concorrencia") {
                console.log("📍 [handleConcorrer] Lidando com concorrência...");
                await handleConcorrer(sock, msg);
            } else if (messageContent === "@tabela") {
                console.log("📍 [handleTabela] Exibindo tabela...");
                await handleTabela(sock, msg);
            } else if (messageContent === "@todos") {
                console.log("📍 [handleTodos] Chamando todos...");
                await handleTodos(sock, msg);
            } else if (messageContent.startsWith('@') || messageContent.startsWith('/')) {
                console.log("📍 [handleMessage] Comando genérico...");
                await handleMessage(sock, msg);
            }

        } catch (error) {
            console.error("❌ Erro ao processar mensagem:", error.message || error);
            await sock.sendMessage(from, { text: "❌ Ocorreu um erro ao processar sua solicitação." });
        }
    });

    sock.ev.on('messages.reaction', async reactions => {
        console.log("📥 Reação recebida:", reactions.length);
        
        for (const reactionMsg of reactions) {
            console.log("📍 [handleReaction] Processando reação...");
            console.dir(reactionMsg, { depth: null });
            await handleReaction({ reactionMessage: reactionMsg, sock });
        }
    });

    sock.ev.on("group-participants.update", async (update) => {
        const { id, participants, action } = update;

        if (action === "add") {
            for (let participant of participants) {
                try {
                    const ppUrl = await sock.profilePictureUrl(participant, "image").catch(() => null);
                    const nome = participant.split("@")[0];

                    const mensagem = `
@${nome}  *👋 Olá, Seja muito bem-vindo(a) ao nosso grupo de Vendas de Megas! 🚀* 

📌 Para conferir todas as nossas ofertas, basta digitar: 
*✨ @Megas / @Tabela ✨*

*✨ ilimitado / ✨*

🎉 Já são mais de 3.796 clientes satisfeitos com nossos serviços! 
Garantimos qualidade, rapidez e os melhores preços para você.

*Fique à vontade para tirar suas dúvidas e aproveitar nossas promoções! 😃💬*
`.trim();

                    if (ppUrl) {
                        await sock.sendMessage(id, { image: { url: ppUrl }, caption: mensagem, mentions: [participant] });
                    } else {
                        await sock.sendMessage(id, { text: mensagem, mentions: [participant] });
                    }
                } catch (err) {
                    console.error("❌ Erro ao enviar mensagem de boas-vindas:", err);
                }
            }
        }
    });

    return sock;
}

// Inicia o bot
iniciarBot("Dispositivo 1", "./auth1");

// ➕ Configura servidor HTTP com Express para manter vivo no Render
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('✅ TopBot está rodando com sucesso no Render!');
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP iniciado na porta ${PORT}`);
});
