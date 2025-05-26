exports.handlePagamento = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid;

        // Verifica se é grupo
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos!' });
        }

        // Define as mensagens de pagamento para cada grupo
        const mensagensPorGrupo = {
            "120363417514741662@g.us": `
📱Formas de Pagamento Atualizadas📱 💳
 

1. M-PESA 📱
   - Número: 848619531
   - DINIS MARTA
   
2. E-MOLA 💸
   - Número: 872960710
   - MANUEL ZOCA

3.  BIM
 Conta nr : 1059773792
- CHONGO MANUEL


Após efetuar o pagamento, por favor, envie o comprovante da transferência juntamente com seu contato.
            `.trim(),
            "120363252308434038@g.us": `
📱Formas de Pagamento Atualizadas📱 💳
 

1. M-PESA 📱
   - Número: 848619531
   - DINIS MARTA
   
2. E-MOLA 💸
   - Número: 872960710
   - MANUEL ZOCA

3.  BIM
 Conta nr : 1059773792
- CHONGO MANUEL


Após efetuar o pagamento, por favor, envie o comprovante da transferência juntamente com seu contato.`.trim(),
            "120363401150279870@g.us": `
📱Formas de Pagamento Atualizadas📱 💳
 

1. M-PESA 📱
   - Número: 848619531
   - DINIS MARTA
   
2. E-MOLA 💸
   - Número: 872960710
   - MANUEL ZOCA

3.  BIM
 Conta nr : 1059773792
- CHONGO MANUEL


Após efetuar o pagamento, por favor, envie o comprovante da transferência juntamente com seu contato.`
        };

        // Verifica se o grupo tem uma mensagem configurada
        const mensagem = mensagensPorGrupo[from];
        if (!mensagem) {
            return sock.sendMessage(from, { text: '❌ Este grupo não está configurado para exibir formas de pagamento.' });
        }

        // Envia a mensagem de pagamento específica para o grupo
        await sock.sendMessage(from, { text: mensagem });

        // Aguarda 2 segundos antes de enviar a próxima mensagem
        await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
        console.error('🚨 Erro ao processar @Pagamentos:', error);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.' });
    }
};