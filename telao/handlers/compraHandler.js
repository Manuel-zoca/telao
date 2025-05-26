const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de persistência
const COMPRADORES_FILE = path.join(__dirname, '..', 'data', 'compradores.json');

// Carrega a lista de compradores do arquivo (ou cria uma nova se não existir)
let compradoresPorGrupo = {};
if (fs.existsSync(COMPRADORES_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(COMPRADORES_FILE, 'utf-8'));
        // Converte arrays de volta para Sets
        compradoresPorGrupo = Object.fromEntries(
            Object.entries(data).map(([groupId, jids]) => [groupId, new Set(jids)])
        );
    } catch (error) {
        console.error('⚠️ Erro ao carregar compradores.json:', error);
        compradoresPorGrupo = {}; 
    }
} else {
    compradoresPorGrupo = {}; 
}

function saveCompradores() {
    try {
      
        const dataToSave = Object.fromEntries(
            Object.entries(compradoresPorGrupo).map(([groupId, set]) => [groupId, Array.from(set)])
        );
        fs.writeFileSync(COMPRADORES_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (error) {
        console.error('🚨 Erro ao salvar compradores.json:', error);
    }
}

exports.handleCompra = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid;

        // Verifica se é grupo
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
        }

        // Inicializa o conjunto de compradores para o grupo, se ainda não existir
        if (!compradoresPorGrupo[from]) {
            compradoresPorGrupo[from] = new Set();
        }

        // Extrai o conteúdo da mensagem
        const messageContent = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ""
        ).toLowerCase();

        // Comando @compra
        if (messageContent === "@compra") {
            // Extrai informações da mensagem mencionada (quotedMessage)
            const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

            // Verifica se há uma mensagem mencionada
            if (!quotedMessage || !quotedParticipant) {
                return sock.sendMessage(from, { text: '❌ Você precisa responder a uma mensagem para usar o comando @compra.' });
            }

            // Adiciona o participante à lista de compradores do grupo
            const jidToAdd = quotedParticipant;
            if (!compradoresPorGrupo[from].has(jidToAdd)) {
                compradoresPorGrupo[from].add(jidToAdd);
                saveCompradores(); // Salva no arquivo
                await sock.sendMessage(from, { text: `✅ O participante *${jidToAdd.split('@')[0]}* foi adicionado à lista de compradores deste grupo.` });
            } else {
                await sock.sendMessage(from, { text: `⚠️ O participante *${jidToAdd.split('@')[0]}* já está na lista de compradores deste grupo.` });
            }
        } 
        // Comando @compra1 (parabenização pela primeira compra no grupo)
        else if (messageContent === "@compra1") {
            // Extrai informações da mensagem mencionada (quotedMessage)
            const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

            // Verifica se há uma mensagem mencionada
            if (!quotedMessage || !quotedParticipant) {
                return sock.sendMessage(from, { text: '❌ Você precisa responder a uma mensagem para usar o comando @compra1.' });
            }

            // Obtém o JID do participante mencionado
            const jidToCongratulate = quotedParticipant;

            // Envia a mensagem de parabenização (independentemente de estar na lista de compradores)
            await sock.sendMessage(from, { 
                text: `🎉 Parabéns, *${jidToCongratulate.split('@')[0]}*! 🎉\n\nVocê foi o primeiro a fazer uma compra conosco hoje neste grupo.\n\nEstamos muito felizes por você ter aderido aos nossos serviços.\n\n*Continue comprando mais e aproveite todos os benefícios que oferecemos!* 💖` 
            });

            // Adiciona o participante à lista de compradores do grupo (caso ainda não esteja)
            if (!compradoresPorGrupo[from].has(jidToCongratulate)) {
                compradoresPorGrupo[from].add(jidToCongratulate);
                saveCompradores(); // Salva no arquivo
            }
        } 
        // Comando @rentanas
        else if (messageContent === "@rentanas") {
            // Obtém metadados do grupo
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;

            // Lista de números que nunca enviaram mensagens ou não estão na lista de compradores deste grupo
            const rentanas = participants.filter(participant => {
                const jid = participant.id;
                return !compradoresPorGrupo[from]?.has(jid); // Filtra quem não está na lista de compradores deste grupo
            });

            if (rentanas.length > 0) {
                let resposta = '📱 Números que não estão na lista de compradores:\n\n';
                rentanas.forEach((participant, index) => {
                    resposta += `${index + 1}-${participant.id.split('@')[0]}\n`;
                });
                await sock.sendMessage(from, { text: resposta });
            } else {
                await sock.sendMessage(from, { text: '✅ Todos os participantes deste grupo estão na lista de compradores.' });
            }
        } 
        // Comando @remove Rentanas
        else if (messageContent === "@remove rentanas") {
            // Obtém metadados do grupo
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;

            // Lista de números que não estão na lista de compradores deste grupo
            const rentanas = participants.filter(participant => {
                const jid = participant.id;
                return !compradoresPorGrupo[from]?.has(jid); // Filtra quem não está na lista de compradores deste grupo
            });

            if (rentanas.length > 0) {
                // Envia mensagem informando que vai remover
                await sock.sendMessage(from, { text: '⏳ Removendo números que não estão na lista de compradores...' });

                // Aguarda 4 segundos antes de remover
                await new Promise(resolve => setTimeout(resolve, 4000));

                // Remove os participantes
                try {
                    for (const participant of rentanas) {
                        await sock.groupParticipantsUpdate(
                            from, // ID do grupo
                            [participant.id], // Lista de JIDs para remover
                            "remove" // Ação: remover
                        );
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Atraso de 1 segundo entre remoções
                    }

                    await sock.sendMessage(from, { text: '✅ Todos os números que não estavam na lista de compradores foram removidos.' });
                } catch (removeError) {
                    console.error('🚨 Erro ao remover participantes:', removeError);
                    await sock.sendMessage(from, { text: '❌ Não foi possível remover todos os participantes. Verifique as permissões do bot.' });
                }
            } else {
                await sock.sendMessage(from, { text: '✅ Não há números para remover. Todos os participantes deste grupo estão na lista de compradores.' });
            }
        } 
        // Comando @compradores
        else if (messageContent === "@compradores") {
            if (compradoresPorGrupo[from]?.size > 0) {
                let resposta = '📋 Lista de compradores deste grupo:\n\n';
                Array.from(compradoresPorGrupo[from]).forEach((jid, index) => {
                    resposta += `${index + 1}-${jid.split('@')[0]}\n`;
                });
                await sock.sendMessage(from, { text: resposta });
            } else {
                await sock.sendMessage(from, { text: '⚠️ A lista de compradores deste grupo está vazia.' });
            }
        } else {
            await sock.sendMessage(from, { text: '❌ Comando inválido. Use *@compra*, *@compra1*, *@rentanas*, *@remove Rentanas* ou *@compradores*.' });
        }

    } catch (error) {
        console.error('🚨 Erro ao processar comando:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.' });
    }
};