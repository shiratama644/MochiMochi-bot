const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkParticipation } = require('../utils/helpers.js');
const { getLastClaim, setLastClaim, addPoints } = require('../db.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('24時間ごとにデイリーボーナスを受け取ります。'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const now = Date.now();

    const user = checkParticipation(userId, guildId);
    if (!user) {
      return interaction.reply({ content: 'まず `/join` でランキングに参加してください。', ephemeral: true });
    }

    try {
      const row = getLastClaim(userId, guildId);
      if (row && now - row.last_claim < 24 * 60 * 60 * 1000) {
        const remain = 24 * 60 * 60 * 1000 - (now - row.last_claim);
        const h = Math.floor(remain / 3600000);
        const m = Math.floor((remain % 3600000) / 60000);
        return interaction.reply({ content: `🕒 まだ受け取れません。あと ${h}時間 ${m}分 お待ちください。`, ephemeral: true });
      }

      let bonus = config.general.dailyBonus;
      let message = `🎁 デイリーボーナスを受け取りました！\n獲得ポイント: **${bonus}**`;
      if (user.points <= 0) {
        bonus += config.general.dailyRescueBonus;
        message = `🆘 ポイントが0でしたね…お助けボーナス！\n**${bonus}**ポイントを受け取りました！これでまた遊べます！`;
      }

      addPoints(userId, guildId, bonus);
      setLastClaim(userId, guildId, now);

      return interaction.reply({ content: message, ephemeral: true });

    } catch (err) {
      console.error('[/daily] エラー詳細:', err);
      return interaction.reply({ content: '⚠️ デイリーボーナス取得中にエラーが発生しました。', ephemeral: true });
    }
  },
};