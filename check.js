const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkParticipation } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js'); // 追加
const db = require('../db.js');
const config = require('../config.json'); // 追加

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('現在のポイント残高とランキング順位を確認します。'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    // クールダウンチェックを追加
    const cd = isOnCooldown(userId, 'check', config.cooldowns.check);
    if (cd.active) {
      return interaction.reply({
        content: `クールダウン中です。あと ${cd.remaining}秒 待ってください。`,
        ephemeral: true
      });
    }

    const user = checkParticipation(userId, guildId);
    if (!user) {
      return interaction.reply({
        content: 'まず `/join` でランキングに参加してください。',
        ephemeral: true
      });
    }
    const ranking = db.getRanking(guildId, 10000); // サーバーメンバーが多い場合を考慮して上限を増やす
    const rank = ranking.findIndex(u => u.user_id === userId) + 1;
    
    return interaction.reply({
      content: `💰 現在のポイント: **${user.points}**\n🏆 ランキング順位: **${rank > 0 ? `${rank}位` : 'ランク外'}**`,
      ephemeral: true
    });
  },
};