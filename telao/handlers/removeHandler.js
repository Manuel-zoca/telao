// Importa a variável global de resultados temporários
const { resultadosTemp } = require("./listarHandler");

exports.handleRemove = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid;

        // Verifica se é grupo
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
        }

        // Extrai o comando da mensagem
        const rawCommand = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
        console.log(`📦 Comando recebido: "${rawCommand}"`);

        // Remove todos os espaços extras para evitar problemas de formatação
        const cleanedCommand = rawCommand.replace(/\s+/g, '');
        console.log(`📦 Comando limpo: "${cleanedCommand}"`);

        // Regex para capturar o número após @remove
        const match = cleanedCommand.match(/^@remove(\d+)$/);
        if (!match) {
            console.error(`❌ Regex falhou para o comando: "${cleanedCommand}"`);
            return sock.sendMessage(from, { text: '❌ Comando inválido. Use `@remove X`, onde X é o número do participante na lista.' });
        }

        const indexToRemove = parseInt(match[1], 10) - 1; // Converte para índice baseado em zero
        console.log(`📦 Índice extraído: ${indexToRemove}`);

        // Verifica se há resultados armazenados para o grupo
        if (!resultadosTemp[from] || resultadosTemp[from].length === 0) {
            console.error(`❌ Nenhum resultado temporário disponível para o grupo: ${from}`);
            return sock.sendMessage(from, { text: '❌ Nenhuma lista de participantes disponível para este grupo. Use o comando de listagem primeiro.' });
        }

        console.log(`📦 Resultados temporários para o grupo (${from}):`, resultadosTemp[from]);

        // Verifica se o índice é válido
        if (indexToRemove < 0 || indexToRemove >= resultadosTemp[from].length) {
            console.error(`❌ Índice inválido: ${indexToRemove} (tamanho da lista: ${resultadosTemp[from].length})`);
            return sock.sendMessage(from, { text: '❌ Índice inválido. Certifique-se de usar um número presente na lista.' });
        }

        // Remove o participante selecionado
        const jidToRemove = resultadosTemp[from][indexToRemove];
        console.log(`📦 JID a ser removido: ${jidToRemove}`);

        try {
            await sock.groupParticipantsUpdate(
                from, // ID do grupo
                [jidToRemove], // Remove um participante por vez
                "remove" // Ação: remover
            );
            console.log(`✅ Participante removido com sucesso: ${jidToRemove}`);
        } catch (groupError) {
            console.error(`🚨 Erro ao remover participante (${jidToRemove}):`, groupError);
            return sock.sendMessage(from, { text: '❌ Não foi possível remover o participante. Verifique as permissões do bot.' });
        }

        // Atualiza a lista temporária removendo o participante removido
        resultadosTemp[from].splice(indexToRemove, 1);
        console.log(`📦 Lista atualizada após remoção:`, resultadosTemp[from]);

        // Envia confirmação
        await sock.sendMessage(from, { text: `✅ Participante ${jidToRemove.split('@')[0]} foi removido do grupo.` });

    } catch (error) {
        console.error('🚨 Erro crítico ao processar comando de remoção:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.' });
    }
};