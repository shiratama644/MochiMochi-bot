const Database = require('better-sqlite3');
const config = require('./config.json'); // configを読み込む
let db;

try {
    db = new Database('.data/ranking.db');
    console.log('Successfully connected to the database.');
} catch (error) {
    console.error('Failed to connect to the database. Please check file permissions and path.', error);
    process.exit(1);
}

function setupDatabase() {
    try {
        db.prepare(`
          CREATE TABLE IF NOT EXISTS users (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            points INTEGER DEFAULT 0,
            username TEXT,
            PRIMARY KEY (user_id, guild_id)
          )
        `).run();
        db.prepare(`
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id   TEXT    NOT NULL,
            guild_id  TEXT    NOT NULL,
            command   TEXT    NOT NULL,
            amount    INTEGER NOT NULL,
            result    INTEGER NOT NULL,
            timestamp INTEGER NOT NULL
          )
        `).run();
        db.prepare(`
          CREATE TABLE IF NOT EXISTS daily_claims (
            user_id   TEXT NOT NULL,
            guild_id  TEXT NOT NULL,
            last_claim INTEGER NOT NULL,
            PRIMARY KEY (user_id, guild_id)
          )
        `).run();
        console.log('Database tables verified/created.');
    } catch (error) {
        console.error('Failed to set up the database tables.', error);
        process.exit(1);
    }
}

setupDatabase();

function getUser(userId, guildId) {
    return db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function joinRanking(userId, guildId, username) {
    const user = getUser(userId, guildId);
    if (!user) {
        // configから初期ポイントを読み込む
        db.prepare('INSERT INTO users (user_id, guild_id, points, username) VALUES (?, ?, ?, ?)')
          .run(userId, guildId, config.general.initialPoints, username);
        return true;
    }
    return false;
}

function addPoints(userId, guildId, amount) {
    const user = getUser(userId, guildId);
    if (user) {
        db.prepare('UPDATE users SET points = points + ? WHERE user_id = ? AND guild_id = ?')
          .run(amount, userId, guildId);
    }
}

function getRanking(guildId, limit = 10) {
    return db.prepare('SELECT * FROM users WHERE guild_id = ? ORDER BY points DESC LIMIT ?')
             .all(guildId, limit);
}

function getLastClaim(userId, guildId) {
  return db.prepare('SELECT last_claim FROM daily_claims WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function setLastClaim(userId, guildId, timestamp) {
  const exists = getLastClaim(userId, guildId);
  if (exists) {
    db.prepare('UPDATE daily_claims SET last_claim = ? WHERE user_id = ? AND guild_id = ?').run(timestamp, userId, guildId);
  } else {
    db.prepare('INSERT INTO daily_claims (user_id, guild_id, last_claim) VALUES (?, ?, ?)').run(userId, guildId, timestamp);
  }
}

function addTransaction(userId, guildId, command, amount, result) {
  const ts = Date.now();
  db.prepare(`
    INSERT INTO transactions (user_id, guild_id, command, amount, result, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, guildId, command, amount, result, ts);
}

module.exports = {
    getUser,
    joinRanking,
    addPoints,
    getRanking,
    getLastClaim,
    setLastClaim,
    addTransaction
};