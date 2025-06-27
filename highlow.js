const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const { checkParticipation, checkBetAmount } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('highlow')
    .setDescription(`次の数字が高いか低いか予想します。当たりは賭け金×${config.games.highlow.multiplier}倍。`)
    .addStringOption(opt =>
      opt.setName('choice')
         .setDescription('High (高い) か Low (低い) を選択')
         .setRequired(true)
         .addChoices({ name: 'High (高い)', value: 'high' }, { name: 'Low (低い)', value: 'low' })
    )
    .addIntegerOption(opt =>
      opt.setName('points')
         .setDescription(`賭けるポイント数 (1～${config.general.maxBet})`)
         .setRequired(true)
    ),

  async execute(interaction) {
    const userId  = interaction.user.id;
    const guildId = interaction.guild.id;
    const choice  = interaction.options.getString('choice');
    const bet     = interaction.options.getInteger('points');

    const cd = isOnCooldown(userId, 'highlow', config.cooldowns.highlow);
    if (cd.active) {
      return interaction.reply({ content: `クールダウン中です。あと ${cd.remaining}秒 待ってください。`, ephemeral: true });
    }

    const user = checkParticipation(userId, guildId);
    if (!user) {
      return interaction.reply({ content: 'まず `/join` で参加してください。', ephemeral: true });
    }

    if (!checkBetAmount(bet, config.general.maxBet)) {
      return interaction.reply({ content: `賭けられるのは1～${config.general.maxBet}ポイントまでです。`, ephemeral: true });
    }
    if (user.points < bet) {
      return interaction.reply({ content: `所持ポイントが足りません。あなたの所持ポイント: ${user.points}`, ephemeral: true });
    }

    await interaction.deferReply();

    const baseNum = Math.floor(Math.random() * 100) + 1;
    let nextNum;
    do {
      nextNum = Math.floor(Math.random() * 100) + 1;
    } while (baseNum === nextNum);

    const isWin = (choice === 'high' && nextNum > baseNum) || (choice === 'low' && nextNum < baseNum);
    const resultPts = isWin ? Math.floor(bet * config.games.highlow.multiplier) : 0;
    const delta = resultPts - bet;

    db.addPoints(userId, guildId, delta);
    db.addTransaction(userId, guildId, 'highlow', bet, resultPts);

    const embed = new MessageEmbed()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('📈 ハイ＆ロー 📉')
      .addField('基準値', `**${baseNum}**`, true)
      .addField('あなたの選択', choice === 'high' ? '🔼 High' : '🔽 Low', true)
      .addField('結果', `**${nextNum}**`, true)
      .setFooter({ text: `現在の所持ポイント: ${user.points + delta}pt` });

    if (isWin) {
      embed.setColor('GREEN').setDescription(`🎉 **勝利！**\n**${resultPts}**ポイントを獲得しました！`);
    } else {
      embed.setColor('RED').setDescription(`💸 **敗北…**\n**${bet}**ポイントを失いました…`);
    }

    await interaction.editReply({ embeds: [embed] });
  }
};