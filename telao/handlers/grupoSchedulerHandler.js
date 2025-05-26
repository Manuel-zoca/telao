const grupos = [
    {
        id: "120363252308434038@g.us", // ID do grupo 1
        horaFechar: "22:30",
        horaAbrir: "06:05", // Corrigido
        
    },
    {
        id: "120363417514741662@g.us", // ID do grupo 2
        horaFechar: "22:40",
        horaAbrir: "06:10",
    },
    // Adicione mais grupos conforme necessário
];

function getHoraAtual() {
    const agora = new Date();
    return agora.toTimeString().substring(0, 5); // formato "HH:MM"
}

async function verificarHorarios(sock) {
    const horaAtual = getHoraAtual();

    for (const grupo of grupos) {
        try {
            if (horaAtual === grupo.horaFechar) {
                await sock.groupSettingUpdate(grupo.id, "announcement"); // Só admins
                console.log(`🔒 Grupo ${grupo.id} fechado às ${horaAtual}`);
                await sock.sendMessage(grupo.id, { text: "🔒 Grupo temporariamente fechado. \n\n *Urgente??* CAll- 848619531" });
            }

            if (horaAtual === grupo.horaAbrir) {
                await sock.groupSettingUpdate(grupo.id, "not_announcement"); // Todos podem
                console.log(`🔓 Grupo ${grupo.id} aberto às ${horaAtual}`);
            
                // Aguarda 2 segundos para garantir que o grupo foi reaberto antes de enviar a mensagem
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(grupo.id, { text: "🔓 Grupo aberto! \n\n podemos ativar para ficar online" });
                    } catch (err) {
                        console.error(`Erro ao enviar mensagem ao abrir grupo ${grupo.id}:`, err);
                    }
                }, 2000);
            }
            
        } catch (err) {
            console.error(`Erro ao alterar configurações do grupo ${grupo.id}:`, err);
        }
    }
}
function getHoraAtual() {
    const agora = new Date();
    const horas = agora.getHours().toString().padStart(2, '0');
    const minutos = agora.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
}

function iniciarAgendamento(sock) {
    setInterval(() => verificarHorarios(sock), 60 * 1000); // A cada 1 minuto
}

module.exports = { iniciarAgendamento };
