// Variável global para armazenar temporariamente os resultados da busca
let resultadosTemp = {};

exports.handleListar = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid;

        // Verifica se é grupo
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
        }

        // Obtém metadados do grupo
        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants;

        // Lista de palavras-chave para verificar no status
        const palavrasChave = ['megas', 'net', 'gigas', 'internet', 'dados', 'fornecedor', 'revendedor', 'vodacom', 'mega']; // Adicione mais palavras aqui

        const resultados = [];
        const errors = [];

        // Processa cada participante
        for (const participant of participants) {
            let jid = participant.id.replace(/@c.us$/, '@s.whatsapp.net');

            try {
                // Valida formato do JID
                if (!jid.match(/^\d+@s\.whatsapp\.net$/)) {
                    throw new Error('Formato de JID inválido');
                }

                // Tenta obter o status com timeout
                const statusResult = await Promise.race([
                    sock.fetchStatus(jid).catch(err => err), // Captura erros do fetchStatus
                    new Promise((_, reject) => setTimeout(() => reject('Timeout'), 5000))
                ]);

                // Verifica se ocorreu um erro no fetchStatus
                if (statusResult instanceof Error) {
                    throw statusResult;
                }

                // Verifica se o status existe e contém alguma das palavras-chave
                if (Array.isArray(statusResult) && statusResult.length > 0) {
                    const status = statusResult[0]?.status?.status; // Ajuste para o formato correto
                    if (status && typeof status === 'string') {
                        const statusLower = status.toLowerCase();
                        // Verifica se alguma palavra-chave está no status
                        const contemPalavraChave = palavrasChave.some(palavra => statusLower.includes(palavra));
                        if (contemPalavraChave) {
                            resultados.push(jid); // Adiciona o JID completo para remover
                        }
                    }
                }

            } catch (error) {
                // Registra erros apenas nos logs (não envia ao grupo)
                if (error.message?.includes("undefined")) {
                    errors.push(`⚠️ Erro interno (${jid}): Problema ao acessar status`);
                } else if (error === 'Timeout') {
                    errors.push(`⏳ Tempo esgotado: ${jid}`);
                } else if (error?.output?.statusCode === 404) {
                    errors.push(`🔒 Privacidade restrita: ${jid}`);
                } else {
                    errors.push(`⚠️ Erro desconhecido (${jid}): ${error.message || error}`);
                }
                continue;
            }
        }

        // Prepara resposta final
        let resposta = '';

        // Armazena os resultados temporariamente associados ao grupo
        resultadosTemp[from] = resultados;

        // Adiciona resultados válidos
        if (resultados.length > 0) {
            resposta += '*📱 Participantes Concorrentes no Grupo:*\n\n';
            resultados.forEach((numero, index) => {
                resposta += `${index + 1} - ${numero.split('@')[0]}\n`; // Formato simplificado
            });

            resposta += '\n👉 Para remover um participante, use o comando `@remove X`, onde X é o número do participante na lista acima.';
        } else {
            resposta += '❌ Nenhum participante encontrado com as palavras-chave no status.';
        }

        // Envia a mensagem com a lista de participantes
        await sock.sendMessage(from, { text: resposta });

        // Exibe os erros apenas nos logs (não envia ao grupo)
        if (errors.length > 0) {
            console.error('⚠️ Problemas durante a verificação:');
            errors.forEach(err => console.error(err));
        }

    } catch (error) {
        console.error('🚨 Erro crítico:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro grave. Tente novamente mais tarde.' });
    }
};

// Exporta a variável global para ser usada em outros arquivos
exports.resultadosTemp = resultadosTemp;