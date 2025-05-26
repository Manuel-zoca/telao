const pagamentosConfirmados = new Map();
const mensagensProcessadas = new Set();

function marcarPagamentoConfirmadoTemporariamente(remetente, tempoEmMs = 5 * 60 * 1000) {
  pagamentosConfirmados.set(remetente, true);
  setTimeout(() => {
    pagamentosConfirmados.delete(remetente);
    console.log(`⌛ Tempo expirado para ${remetente}`);
  }, tempoEmMs);
}

function detectarTipoPagamento(texto, numero) {
  const textoLower = texto.toLowerCase();
  if (
    (textoLower.includes("confirmado") && textoLower.includes("transferiste") && textoLower.includes("m-pesa")) ||
    textoLower.includes("dinis") || 
    textoLower.includes("continua a transferir") || 
    textoLower.includes("m-pesa")
  ) {
    return "M-Pesa";
  }
  if (
    (textoLower.includes("id da transacao") && textoLower.includes("transferiste") && textoLower.includes("e-mola")) ||
    textoLower.includes("manuel zoca") || 
    textoLower.includes("obrigado!") || 
    textoLower.includes("e-mola")
  ) {
    return "E-Mola";
  }

  const prefixo = numero.slice(0, 2);
  if (["84", "85"].includes(prefixo)) return "M-Pesa";
  if (["86", "87"].includes(prefixo)) return "E-Mola";
  return "Desconhecido";
}

function extrairNumeroLocal(text) {
  const textoSemEspacos = text.replace(/[\s\-\.]/g, '');
  const match = textoSemEspacos.match(/(?:\+?258)?(8\d{8})/);
  return match ? match[1] : null;
}

exports.handleMensagemPix = async (sock, msg) => {
  try {
    const from = msg.key.remoteJid;
    const messageId = msg.key.id;
    const remetente = msg.participant || msg.key.participant || msg.key.remoteJid;
    const numeroFormatado = remetente.replace(/[@:\s].*/g, "");
    const chaveUnica = `${from}:${remetente}:${messageId}`;

    if (mensagensProcessadas.has(chaveUnica)) return;
    mensagensProcessadas.add(chaveUnica);

    const botJid = sock.user?.id || sock.authState.creds?.me?.id;
    if (remetente === botJid) {
      mensagensProcessadas.delete(chaveUnica);
      return;
    }

    const gruposPermitidos = [
        "120363401150279870@g.us",
        "120363252308434038@g.us",
        "120363417514741662@g.us"
      ];
      
    if (!gruposPermitidos.includes(from)) return;

    let messageText = '';
    let isImageMessage = false;
    let quotedMessage = {};

    if (msg.message?.imageMessage) {
      isImageMessage = true;
      messageText = msg.message.imageMessage.caption || '';
      quotedMessage = { imageMessage: msg.message.imageMessage };
    } else {
      messageText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      quotedMessage = {
        conversation: messageText
      };
    }

    const textoLower = messageText.toLowerCase();
    const regexNumero = /\b(8[4-7]\d{7})\b/;
    const numeroMatch = messageText.match(regexNumero);
    const numeroTransferido = numeroMatch ? numeroMatch[1] : null;

    const valorMatch = messageText.match(/transferiste\s+([\d.,]+)\s*mt/i);
    const valorTransferido = valorMatch ? valorMatch[1].replace(',', '.') : null;

    const idMatch = messageText.match(/\b([A-Z]{2,3}[0-9A-Z.\-]{6,15})\b/);
    const idTransacao = idMatch ? idMatch[1] : null;

    const isPixMessage = /transferiste\s+\d+(\.\d+)?mt/i.test(textoLower);
    const isComprovativo =
      textoLower.includes("transferiste") ||
      textoLower.includes("confirmado") ||
      textoLower.includes("obrigado") ||
      (isImageMessage && (regexNumero.test(messageText) || messageText.length === 0));

      if (!isPixMessage && !isComprovativo && !isImageMessage) {
        console.log(`🚫 Ignorado: sem palavras-chave e não é imagem - "${textoLower}"`);
        mensagensProcessadas.delete(chaveUnica);
        return;
      }

    const numerosValidos = ['872960710', '848619531'];

    // Verifica todos os números de telefone encontrados no texto (com ou sem prefixo 258)
    const todosNumeros = [...messageText.matchAll(/(?:\+?258)?(8\d{8})/g)].map(match => match[1]);

    // Valida se ao menos UM dos números encontrados corresponde a um dos válidos
    const contemNumeroValido = todosNumeros.some(n => numerosValidos.includes(n));
    if (!contemNumeroValido) {
      // ❌ Reage imediatamente à mensagem
      await sock.sendMessage(from, {
        react: { text: "❌", key: msg.key }
      });

      // ⏳ Aguarda 20 segundos antes de enviar a rejeição
      await new Promise(resolve => setTimeout(resolve, 20000));

      // 🚫 Mensagem de rejeição após o atraso + citação
      await sock.sendMessage(from, {
        text: `🚫 *Comprovante rejeitado!*\n\nO número para qual foi feita a transferência *é inválido*.\n\n📱 Apenas aceitamos transferências para:\n- *848619531* 📱 (Dinis Marta)\n- *872960710* 💸 (Manuel Zoca)\n\n❗️Tentativas de fraude resultarão em *banimento imediato*!`,
        contextInfo: {
          quotedMessage,
          participant: remetente
        }
      });

      console.log(`🚫 Rejeitado: comprovativo enviado para número inválido:`, todosNumeros);
      return;
    }

    // ✅ Reage com check e cita a mensagem
    await sock.sendMessage(from, {
      react: {
        text: "✅",
        key: { remoteJid: from, participant: remetente, id: messageId }
      }
    });
    console.log(`✅ Reagiu à mensagem ${isImageMessage ? 'de imagem' : 'de texto'} de ${numeroFormatado}`);

    const tipoPagamento = detectarTipoPagamento(messageText, numeroFormatado);

    await new Promise(resolve => setTimeout(resolve, 20000));

    let mensagem = `✅ *Comprovante recebido!*`;
    if (valorTransferido) mensagem += `\n\n💰 Valor transferido: *${valorTransferido} MT*\n`;
    if (idTransacao) mensagem += `\n>ID da transação: *${idTransacao}*\n`;

    mensagem += `\n🔄 Enviaremos os megas em *1 minuto*... Por favor, aguarde a confirmação.`;

    // 📩 Resposta final com menção à mensagem original
    await sock.sendMessage(from, {
      text: mensagem,
      mentions: [remetente],
      contextInfo: {
        quotedMessage,
        participant: remetente
      }
    });

    console.log(`📨 Confirmação enviada para ${numeroFormatado}`);
    marcarPagamentoConfirmadoTemporariamente(remetente);

  } catch (error) {
    console.error("❌ Erro ao processar mensagem PIX:", error);
    const chaveUnica = `${msg.key.remoteJid}:${msg.key.participant || msg.key.remoteJid}:${msg.key.id}`;
    mensagensProcessadas.delete(chaveUnica);
  }
};