// cooldowns.js
const cooldowns = new Map();

/**
 * @param {string} userId
 * @param {string} commandName
 * @param {number} cooldownSec
 * @returns {{ active: boolean, remaining?: number }}
 */
function isOnCooldown(userId, commandName, cooldownSec) {
  const key = `${userId}:${commandName}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  const diff = (now - last) / 1000;
  if (diff < cooldownSec) {
    return { active: true, remaining: Math.ceil(cooldownSec - diff) };
  }
  cooldowns.set(key, now);
  return { active: false };
}

module.exports = { isOnCooldown };