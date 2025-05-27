const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const express = require("express");
const app = express();

const { loadAuthState, saveAuthState } = require("./db");
const handleMessage = require("./handlers/messageHandler");
const handleConcorrer = require("./handlers/concorrerHandler");
const handleListar = require("./handlers/listarHandler");
const handleRemove = require("./handlers/removeHandler");
const handlePagamento = require("./handlers/pagamentoHandler");
const handleGrupo = require("./handlers/grupoHandler");
const handleBan = require("./handlers/banHandler");
const handleCompra = require("./handlers/compraHandler");
const handleTabela = require("./handlers/tabelaHandler");
const handleTodos = require("./handlers/todosHandler");
const { iniciarAgendamento } = require("./handlers/grupoSchedulerHandler");
const { verificarEnvioTabela } = require("./handlers/tabelaScheduler");
const { handleMensagemPix } = require("./handlers/pixHandler");
const { handleComprovanteFoto } = require("./handlers/handleComprovanteFoto");
const { handleReaction } = require("./handlers/reactionHandler");

let pendingMessages = [];

async function iniciarBot(deviceName) {
    console.log(`🟢 [${deviceName}] Iniciando bot...`);

    // Carregando estado salvo no MongoDB (não está sendo usado diretamente aqui porque você usa multi-file auth)
    const mongoState = await loadAuthState();
    if (mongoState) {
        console.log(`🟡 [${deviceName}] Estado auth carregado do MongoDB (não utilizado diretamente pois auth multi-file será usado)`);
    } else {
        console.log(`🟡 [${deviceName}] Nenhum estado auth encontrado no MongoDB`);
    }

    const authFolder = './auth1'; // pasta para salvar credenciais multi-file
    fs.mkdirSync(authFolder, { recursive: true }); // garante que pasta exista
    console.log(`🟢 [${deviceName}] Diretório de auth '${authFolder}' garantido.`);

    // Inicializando Baileys com multi-file auth
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    console.log(`🟢 [${deviceName}] Estado de autenticação multi-file carregado.`);

    // Pegando versão mais recente do WhatsApp Web para o Baileys
    const { version } = await fetchLatestBaileysVersion();
    console.log(`🟢 [${deviceName}] Versão Baileys para WA: ${version.join('.')}`);

    // Criando socket com configuração
    let sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false // QR no console é customizado via qrcode pacote
    });

    // Agendamento periódicos, ex: verificar envio tabela
    setInterval(() => {
        console.log(`🕒 [${deviceName}] Rodando verificação de envio da tabela...`);
        verificarEnvioTabela(sock);
    }, 60 * 1000);

    // Eventos de conexão
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Gerar QR Code no terminal como base64 para visualização (você pode alterar para qrcode-terminal)
            const qrBase64 = await QRCode.toDataURL(qr);
            console.log(`📌 [${deviceName}] Escaneie o QR Code para autenticar:`);
            console.log(qrBase64.split(',')[1]);
        }

        if (connection === "close") {
            const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`🔴 [${deviceName}] Conexão fechada, motivo: ${motivo}`);

            if (motivo === DisconnectReason.loggedOut) {
                console.log(`❌ [${deviceName}] Sessão deslogada. Encerrando processo.`);
                process.exit(0);
            }

            console.log(`🔁 [${deviceName}] Tentando reconectar em 3 segundos...`);
            setTimeout(() => iniciarBot(deviceName), 3000);
        }

        if (connection === "open") {
            console.log(`✅ [${deviceName}] Conectado com sucesso!`);
            iniciarAgendamento(sock);

            if (pendingMessages.length > 0) {
                console.log(`📤 [${deviceName}] Enviando ${pendingMessages.length} mensagens pendentes...`);
                await Promise.all(pendingMessages.map(({ jid, msg }) => sock.sendMessage(jid, msg)));
                pendingMessages = [];
            }
        }
    });

    // Evento para salvar credenciais automaticamente no multi-file
    sock.ev.on("creds.update", async () => {
        await saveCreds();
        console.log(`💾 [${deviceName}] Credenciais atualizadas e salvas no multi-file.`);
    });

    // Manipulação de mensagens recebidas
    sock.ev.on("messages.upsert", async ({ messages }) => {
        if (!messages || messages.length === 0) return;

        const msg = messages[0];
        const senderJid = msg.key.remoteJid;

        // Extrai texto da mensagem de forma segura
        const messageText = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.text ||
            ""
        ).replace(/[\u200e\u200f\u2068\u2069]/g, '').trim();

        const lowerText = messageText.toLowerCase();

        try {
            if (msg.message?.imageMessage && senderJid.endsWith("@g.us")) {
                console.log(`🖼️ [${deviceName}] Mensagem com foto em grupo detectada.`);
                await handleComprovanteFoto(sock, msg);
            }

            await handleMensagemPix(sock, msg);

            if (lowerText.startsWith('@') || lowerText.startsWith('/')) {
                console.log(`📨 [${deviceName}] Comando recebido de ${senderJid}: ${lowerText}`);
            }

            // Roteamento de comandos (você pode ajustar conforme sua lógica)
            if (lowerText === "@concorrentes") {
                await handleListar(sock, msg);
            } else if (lowerText.startsWith("@remove") || lowerText.startsWith("/remove")) {
                await handleRemove(sock, msg);
            } else if (lowerText.startsWith("@ban") || lowerText.startsWith("/ban")) {
                await handleBan(sock, msg);
            } else if (lowerText === "@pagamentos") {
                await handlePagamento(sock, msg);
            } else if (["@grupo on", "@grupo off"].includes(lowerText)) {
                await handleGrupo(sock, msg);
            } else if (lowerText.startsWith("@compra") || lowerText.startsWith("@rentanas") || lowerText.startsWith("@remove rentanas")) {
                await handleCompra(sock, msg);
            } else if (senderJid.endsWith("@g.us") && lowerText === "@concorrencia") {
                await handleConcorrer(sock, msg);
            } else if (lowerText === "@tabela") {
                await handleTabela(sock, msg);
            } else if (lowerText === "@todos") {
                await handleTodos(sock, msg);
            } else if (lowerText.startsWith('@') || lowerText.startsWith('/')) {
                await handleMessage(sock, msg);
            }

        } catch (error) {
            console.error(`❌ [${deviceName}] Erro ao processar mensagem de ${senderJid}:`, error.message);
            try {
                await sock.sendMessage(senderJid, { text: "❌ Erro ao processar sua solicitação." });
            } catch {
                pendingMessages.push({ jid: senderJid, msg: { text: "❌ Erro ao processar sua solicitação." } });
                console.log(`⚠️ [${deviceName}] Mensagem de erro adicionada na fila para envio posterior.`);
            }
        }
    });

    // Reações em mensagens
    sock.ev.on("messages.reaction", async reactions => {
        for (const reaction of reactions) {
            console.log(`🔄 [${deviceName}] Reação recebida:`, reaction);
            await handleReaction({ reactionMessage: reaction, sock });
        }
    });

    // Boas-vindas para novos participantes em grupos
    sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
        if (action === "add") {
            for (const participant of participants) {
                const nome = participant.split("@")[0];
                const mensagem = `
@${nome} *👋 Bem-vindo(a) ao grupo!*

📌 Para ofertas: *@Megas / @Tabela*
🎉 Já são +3.796 clientes felizes com nossos serviços!

Qualquer dúvida, estamos à disposição!
                `.trim();

                try {
                    const ppUrl = await sock.profilePictureUrl(participant, "image").catch(() => null);
                    if (ppUrl) {
                        await sock.sendMessage(id, { image: { url: ppUrl }, caption: mensagem, mentions: [participant] });
                    } else {
                        await sock.sendMessage(id, { text: mensagem, mentions: [participant] });
                    }
                    console.log(`👋 [${deviceName}] Mensagem de boas-vindas enviada para ${participant} no grupo ${id}`);
                } catch (err) {
                    console.error(`❌ [${deviceName}] Erro ao enviar boas-vindas para ${participant}:`, err.message);
                }
            }
        }
    });

    return sock;
}

(async () => {
    try {
        await iniciarBot("Dispositivo 1");
    } catch (error) {
        console.error("❌ Erro fatal ao iniciar o bot:", error);
        process.exit(1);
    }
})();

// Servidor HTTP para manter o bot vivo e responder status básico
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('✅ TopBot rodando com sucesso!'));
app.listen(PORT, () => console.log(`🌐 HTTP ativo na porta ${PORT}`));
