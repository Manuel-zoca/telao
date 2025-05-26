// Verifica se a mensagem foi enviada em um grupo
function isGroupMessage(msg) {
    return msg.from.endsWith('@g.us');
}

// Verifica se a mensagem contém palavras-chave específicas
function containsKeyword(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
}

module.exports = { isGroupMessage, containsKeyword };
