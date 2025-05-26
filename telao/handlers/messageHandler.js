const fs = require("fs");
const path = require("path");

// Caminho para o arquivo de persistência
const INFRACTIONS_FILE = path.join(__dirname, "..", "data", "infracoes.json");

// Carrega as infrações do arquivo (ou cria uma nova se não existir)
let infracoes = {};
if (fs.existsSync(INFRACTIONS_FILE)) {
    const data = JSON.parse(fs.readFileSync(INFRACTIONS_FILE, "utf-8"));
    infracoes = data;
}

// Salva as infrações no arquivo
function saveInfractions() {
    fs.writeFileSync(INFRACTIONS_FILE, JSON.stringify(infracoes), "utf-8");
}

// Expressão regular para detectar links
const linkRegex = /(https?:\/\/[^\s]+)/g;

async function handleMessage(sock, msg) {
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const remetente = msg.key.participant || msg.key.remoteJid;
    const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
    const isGroup = chatId.endsWith("@g.us");

    // Ignora mensagens fora de grupos
    if (!isGroup) return;

    // Obtém metadados do grupo
    const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
    const isAdmin = groupMetadata?.participants?.some(p => p.id === remetente && p.admin === "admin");
    const isBotMessage = msg.key.fromMe;

    // Ignora administradores completamente
    if (isAdmin) return;

    // Detecta links proibidos
    if (linkRegex.test(texto) && !isBotMessage) {
        if (!infracoes[remetente]) {
            infracoes[remetente] = 1;
        } else {
            infracoes[remetente]++;
        }

        saveInfractions(); // Salva as infrações

        setTimeout(async () => {
            console.log(`Infrações de @${remetente.split("@")[0]}: ${infracoes[remetente]}`);
            
            await sock.sendMessage(chatId, {
                text: `🚫 @${remetente.split("@")[0]}, links não são permitidos! (${infracoes[remetente]}/2)\nSe continuar, será removido.`,
                mentions: [remetente],
            });

            if (!isBotMessage) {
                await sock.sendMessage(chatId, { delete: msg.key });
            }

            if (infracoes[remetente] >= 2) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [remetente], "remove");
                    delete infracoes[remetente];
                    saveInfractions(); // Remove o registro após remover o participante
                } catch (error) {
                    console.log("Erro ao remover participante:", error);
                }
            }
        }, 5000);
    }

    // Comando @todos
    else if (texto === "@todos" && groupMetadata) {
        if (!isAdmin) {
            return sock.sendMessage(chatId, { text: "❌ Apenas administradores podem usar este comando." });
        }

        setTimeout(async () => {
            try {
                const participantes = groupMetadata.participants.map(p => p.id);
                const mensagem = `📢 MENSAGEM PARA TODOS OS PARTICIPANTES 📢\n\n`;
                
                await sock.sendMessage(chatId, {
                    text: mensagem,
                    mentions: participantes,
                });
            } catch (error) {
                console.log("Erro ao mencionar todos:", error);
            }
        }, 5000);
    }
}

async function handleGroupParticipants(sock, update) {
    const { id, participants, action } = update;

    if (action === "add") {
        for (let participant of participants) {
            try {
                const ppUrl = await sock.profilePictureUrl(participant, "image").catch(() => null);
                const nome = participant.split("@")[0];

                const mensagem = ` @${nome}  *👋 Olá, Seja muito bem-vindo(a) ao nosso grupo de Vendas de Megas! 🚀* \n

📌 Para conferir todas as nossas ofertas, basta digitar: \n
*✨ @Megas / @Tabela ✨*
\n
*✨ ilimitado / ✨*

🎉 Já são mais de 3.796 clientes satisfeitos com nossos serviços! \n
Garantimos qualidade, rapidez e os melhores preços para você.\n

*Fique à vontade para tirar suas dúvidas e aproveitar nossas promoções! 😃💬*`;

                if (ppUrl) {
                    await sock.sendMessage(id, { image: { url: ppUrl }, caption: mensagem, mentions: [participant] });
                } else {
                    await sock.sendMessage(id, { text: mensagem, mentions: [participant] });
                }
            } catch (error) {
                console.log("Erro ao enviar mensagem de boas-vindas:", error);
            }
        }
    }
}

module.exports = { handleMessage, handleGroupParticipants };