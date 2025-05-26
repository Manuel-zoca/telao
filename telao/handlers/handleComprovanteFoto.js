const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Buffer } = require('buffer');
const Tesseract = require('tesseract.js');

exports.handleComprovanteFoto = async (sock, msg) => {
  try {
    const from = msg.key.remoteJid;

    // Só continua se for imagem
    if (!msg.message?.imageMessage) return;

    const legenda = msg.message.imageMessage.caption || '';
    // Remove caracteres invisíveis e espaços extras
    const cleanLegenda = legenda.replace(/[\u200e\u200f\u2068\u2069]/g, '').trim();

    // Função para normalizar e extrair número local (9 dígitos começando com 8)
    function extrairNumeroLocal(text) {
      const textoSemEspacos = text.replace(/[\s\-\.]/g, '');
      const match = textoSemEspacos.match(/(?:\+?258)?(8\d{8})/);
      return match ? match[1] : null;
    }

    // Extrai número da legenda (quem enviou o comprovante)
    const numeroCompleto = extrairNumeroLocal(cleanLegenda);

    const prefixo = numeroCompleto ? numeroCompleto.substring(0, 2) : null;

    // Validação do prefixo só aceita 84 ou 85
    if (numeroCompleto && prefixo !== "84" && prefixo !== "85") {
      await sock.sendMessage(from, {
        react: { text: "❌", key: msg.key }
      });

      await sock.sendMessage(from, {
        text: `🤖 Número *${numeroCompleto}* inválido.\n\n🚫 Apenas números da *Vodacom (84/85)* são aceitos no comprovante.`,
      });

      console.log(`🚫 Número inválido detectado no comprovante: ${numeroCompleto}`);
      return;
    }

    // Baixa o conteúdo da imagem
    const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    // Executa OCR no buffer da imagem
    const { data: { text } } = await Tesseract.recognize(buffer, 'por', {
      logger: m => console.log(m)
    });

    // Normaliza o texto OCR
    const normalizedText = text.replace(/-\s*\n\s*/g, '').replace(/[\u200e\u200f\u2068\u2069]/g, '').trim();

    console.log('Texto extraído via OCR (normalizado):', normalizedText);

    // Extrai valor transferido
    const valorMatch = normalizedText.match(/Transferiste[\s\S]*?([\d.,]+)MT/i);
    const valorTransferido = valorMatch ? valorMatch[1].replace(',', '.') : null;

    // Extrai ID da transação
    const idMatch = normalizedText.match(/\b([A-Z]{2,3}[0-9A-Z.\-]{6,15})\b/);
    const idTransacao = idMatch ? idMatch[1] : null;

    // --- Atualização principal ---
    // Extrai o número para o qual foi feita a transferência diretamente do OCR
    function extrairNumeroDestinoOCR(text) {
      const match = text.match(/8\d{8}/);
      return match ? match[0] : null;
    }

    let numeroTransferido = null;

    const trechoNumeroTransferidoMatch = normalizedText.match(/(?:transferido para|para o número)\s*([\d\s\+\-\.]+)/i);
    if (trechoNumeroTransferidoMatch) {
      numeroTransferido = extrairNumeroLocal(trechoNumeroTransferidoMatch[1]);
    }

    if (!numeroTransferido) {
      numeroTransferido = extrairNumeroDestinoOCR(normalizedText);
    }

    const numerosValidos = ['872960710', '848619531'];

    if (!numeroTransferido) {
      await sock.sendMessage(from, {
        react: { text: "❌", key: msg.key }
      });

      await new Promise(resolve => setTimeout(resolve, 20000));

      await sock.sendMessage(from, {
        text: '🚫 Não foi possível detectar o número de destino válido no comprovante. Por favor, envie um comprovante válido.',
        contextInfo: {
          quotedMessage: { imageMessage: msg.message.imageMessage },
          participant: msg.key.participant || msg.key.remoteJid
        }
      });

      console.log('🚫 Número destino não detectado no OCR.');
      return;
    }

    if (!numerosValidos.includes(numeroTransferido)) {
      await sock.sendMessage(from, {
        react: { text: "❌", key: msg.key }
      });

      await new Promise(resolve => setTimeout(resolve, 20000));

      await sock.sendMessage(from, {
        text: `🚫 *Comprovante rejeitado!*\n\nO número para qual foi transferido o valor é *inválido*.\n\n📱 *Números aceitos para transferência:*\n\n1. 📲 *872960710* - *Manuel Zoca*\n2. 📲 *848619531* - *Dinis Marta*\n\n🔒 *Aviso:* Qualquer tentativa de envio de comprovativos falsos pode resultar em *banimento imediato!*`,
        contextInfo: {
          quotedMessage: { imageMessage: msg.message.imageMessage },
          participant: msg.key.participant || msg.key.remoteJid
        }
      });

      console.log(`🚫 Transferência para número inválido detectada: ${numeroTransferido}`);
      return;
    }
    // --- fim atualização principal ---

    // Reage na imagem com ✅
    await sock.sendMessage(from, {
      react: { text: "✅", key: msg.key }
    });
    await new Promise(resolve => setTimeout(resolve, 20000));
    // Mensagem completa para o grupo
    let mensagem = `✅ Comprovante recebido`;

    if (numeroCompleto) {
      mensagem += `\n\npara o número: *${numeroCompleto}*.`;
    } else {
      mensagem += `.\n\nPor favor, envie o número para qual deseja receber os megas.`;
    }

    if (valorTransferido) mensagem += `\n💰 Valor transferido: *${valorTransferido} MT*`;
    if (idTransacao) mensagem += `\n🆔 ID da transação: *${idTransacao}*`;

    mensagem += `\n🔄 Enviaremos os megas em 1min... Por favor, aguarde a confirmação.`;

    await sock.sendMessage(from, {
      text: mensagem,
      contextInfo: {
        quotedMessage: { imageMessage: msg.message.imageMessage },
        participant: msg.key.participant || msg.key.remoteJid
      }
    });

    // Se não tiver número na legenda, pede o número após enviar a mensagem acima
    if (!numeroCompleto) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // pequeno delay visual

      await sock.sendMessage(from, {
        text: '📲 Por favor, envie o número para qual deseja receber os megas.',
        contextInfo: {
          quotedMessage: { imageMessage: msg.message.imageMessage },
          participant: msg.key.participant || msg.key.remoteJid
        }
      });
    }

    console.log(`📷 Comprovante detectado para ${numeroCompleto || 'número não informado'} - Valor: ${valorTransferido || 'não detectado'} - ID: ${idTransacao || 'não detectado'}`);

  } catch (error) {
    console.error('❌ Erro em handleComprovanteFoto:', error);
  }
};