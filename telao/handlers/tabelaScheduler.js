const path = require('path');
const fs = require('fs');
const { handleTabela } = require('./tabelaHandler');

const gruposComHorarios = [
    {
        id: "120363252308434038@g.us",
        horarios: ["06:30", "12:43", "15:20", "19:30"],
    },
    {
        id: "120363417514741662@g.us",
        horarios: ["06:40", "12:46", "15:25", "19:35"],
    },
];

function getHoraAtual() {
    const agora = new Date();
    const horas = agora.getHours().toString().padStart(2, '0');
    const minutos = agora.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
}

const formasDePagamento = `
📱Formas de Pagamento Atualizadas📱 💳
 
1. M-PESA 📱  
   - Número: 848619531  
   - DINIS MARTA

2. E-MOLA 💸  
   - Número: 872960710  
   - MANUEL ZOCA

3. BIM 🏦  
   - Conta nº: 1059773792  
   - CHONGO MANUEL

Após efetuar o pagamento, por favor, envie o comprovante da transferência juntamente com seu contato.
`.trim();

async function verificarEnvioTabela(sock) {
    const horaAtual = getHoraAtual();

    for (const grupo of gruposComHorarios) {
        if (grupo.horarios.includes(horaAtual)) {
            console.log(`⏰ Enviando tabela automática para o grupo ${grupo.id} às ${horaAtual}`);
            
            // Envia a tabela
            await handleTabela(sock, {
                key: { remoteJid: grupo.id }
            });

            // Aguarda 10 segundos e envia formas de pagamento
            await new Promise(resolve => setTimeout(resolve, 20000));
            await sock.sendMessage(grupo.id, { text: formasDePagamento });
            console.log(`✅ Formas de pagamento enviadas ao grupo ${grupo.id}`);
            
        }
    }
}

module.exports = { verificarEnvioTabela };
