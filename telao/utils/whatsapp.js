// utils/whatsapp.js

const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { Boom } = require("@hapi/boom");

// Handlers
const { handleReaction } = require("../handlers/reactionHandler");
const { handleMessage } = require("../handlers/messageHandler");
const { handleMensagemPix } = require("../handlers/pixHandler");
const { handleComprovanteFoto } = require("../handlers/handleComprovanteFoto");

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        version: [2, 3000, 13178], // opcional mas recomendado
        browser: ['Baileys-MD', 'Chrome', 'Windows'],
    });

    // Garantir que store exista para buscar mensagens reagidas
    if (!sock.ev?.store) {
        sock.ev.store = {
            messages: new Map(),
            chats: new Map(),
            contacts: {},
            stats: {}
        };
    }

    // Listener para atualizar credenciais
    sock.ev.on('creds.update', saveCreds);

    // Gerar QR Code no terminal
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'close') {
            const shouldReconnect = new Boom(lastDisconnect?.error)?.output.statusCode !== DisconnectReason.loggedOut;
            console.log(`🔌 Conexão fechada. ${shouldReconnect ? 'Reconectando...' : ''}`);
            if (shouldReconnect) connectToWhatsApp();
        }
        if (qr) {
            console.log("📱 Escaneie o QR code abaixo:");
            qrcode.generate(qr, { small: true });
        }
    });

    // Listeners
    sock.ev.on('messages.reaction', async reactions => {
        for (const reactionMsg of reactions) {
            console.log("📥 Reação recebida:");
            console.dir(reactionMsg, { depth: null }); // útil pra debug
            await handleReaction({ reactionMessage: reactionMsg, sock });
        }
    });

    // Outros eventos
    sock.ev.on('messages.upsert', async (m) => {
        await handleMessage(m, sock);
        await handleMensagemPix(m, sock);
        await handleComprovanteFoto(m, sock);
    });

    return sock;
}

module.exports = { connectToWhatsApp };