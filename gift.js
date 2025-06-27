const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkParticipation } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js'); // 追加
const db = require('../db.js');
const config = require('../config.json'); // 追加

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('他ユーザーにポイントをギフトします。')
    .addUserOption(opt =>
      opt.setName('user')
         .setDescription('ギフトの受取人')
         .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('points')
         .setDescription('送るポイント数')
         .setRequired(true)),

  async execute(interaction) {
    const senderId = interaction.user.id;
    const guildId  = interaction.guild.id;
    const target    = interaction.options.getUser('user');
    const pts       = interaction.options.getInteger('points');

    // クールダウンチェックを追加
    const cd = isOnCooldown(senderId, 'gift', config.cooldowns.gift);
    if (cd.active) {
      return interaction.reply({
        content: `クールダウン中です。あと ${cd.remaining}秒 待ってください。`,
        ephemeral: true
      });
    }

    // 自分自身にギフトできないようにする
    if (senderId === target.id) {
        return interaction.reply({ content: '自分自身にポイントをギフトすることはできません。', ephemeral: true });
    }
    
    // BOTにギフトできないようにする
    if (target.bot) {
        return interaction.reply({ content: 'BOTにポイントをギフトすることはできません。', ephemeral: true });
    }

    // 送信者チェック
    const sender = checkParticipation(senderId, guildId);
    if (!sender) {
      return interaction.reply({ content: 'まず `/join` でランキングに参加してください。', ephemeral: true });
    }
    // 受信者チェック
    const rec = checkParticipation(target.id, guildId);
    if (!rec) {
      return interaction.reply({ content: '対象ユーザーはまだランキングに参加していません。', ephemeral: true });
    }
    // ポイントチェック
    if (pts <= 0) {
      return interaction.reply({ content: '1ポイント以上を指定してください。', ephemeral: true });
    }
    if (sender.points < pts) {
      return interaction.reply({ content: `所持ポイントが足りません。あなたの所持ポイント: ${sender.points}`, ephemeral: true });
    }

    // ポイント移動
    db.addPoints(senderId, guildId, -pts);
    db.addPoints(target.id, guildId, pts);

    // 送信者へ通知
    await interaction.reply({
      content: `🎁 <@${target.id}> に ${pts}ポイントをギフトしました！\nあなたの残高: ${sender.points - pts}`,
      ephemeral: true
    });

    // 受信者へ DM 通知
    try {
      await target.send(`🎉 ${interaction.user.username} さんから ${pts}ポイントのギフトを受け取りました！`);
    } catch (e) {
      console.error(`Gift DM failed to ${target.tag}:`, e.message);
      // DMが送れなくても処理は続行するが、コンソールにエラーは残す
    }
  },
};