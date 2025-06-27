// helpers.js
const db = require('./db.js');

function checkParticipation(userId, guildId) {
    return db.getUser(userId, guildId) || null;
}

function checkBetAmount(points, max) {
    return Number.isInteger(points) && points > 0 && points <= max;
}

// ルーレットの出目から結果を判定するヘルパー関数
function getRouletteResult(number) {
    if (number === 0) {
        return { color: 'green', parity: 'none' };
    }
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const color = redNumbers.includes(number) ? 'red' : 'black';
    const parity = number % 2 === 0 ? 'even' : 'odd';
    return { color, parity };
}


module.exports = {
    checkParticipation,
    checkBetAmount,
    getRouletteResult
};