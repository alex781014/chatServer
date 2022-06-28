const messages = [];

export function saveMessage(message) {
    messages.push(message);
}

export function findMessagesForUser(userId) {
    return messages.filter(({ from, to }) => from === userId || to === userId);
}
