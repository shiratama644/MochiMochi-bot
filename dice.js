const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const { checkParticipation, checkBetAmount } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription(`サイコロの出目を予想します。当たりは賭け金×${config.games.dice.multiplier}倍。`)
    .addIntegerOption(opt =>
      opt.setName('guess')
         .setDescription('予想する出目 (1～6)')
         .setRequired(true)
         .setMinValue(1)
         .setMaxValue(6)
    )
    .addIntegerOption(opt =>
      opt.setName('points')
         .setDescription(`賭けるポイント数 (1～${config.general.maxBet})`)
         .setRequired(true)
    ),

  async execute(interaction) {
    const userId  = interaction.user.id;
    const guildId = interaction.guild.id;
    const guess   = interaction.options.getInteger('guess');
    const bet     = interaction.options.getInteger('points');

    const cd = isOnCooldown(userId, 'dice', config.cooldowns.dice);
    if (cd.active) {
      return interaction.reply({ content: `クールダウン中です。あと ${cd.remaining}秒 待ってください。`, ephemeral: true });
    }

    const user = checkParticipation(userId, guildId);
    if (!user) {
      return interaction.reply({ content: 'まず `/join` でランキングに参加してください。', ephemeral: true });
    }

    if (!checkBetAmount(bet, config.general.maxBet)) {
      return interaction.reply({ content: `賭けられるのは1～${config.general.maxBet}ポイントまでです。`, ephemeral: true });
    }
    if (user.points < bet) {
      return interaction.reply({ content: `所持ポイントが足りません。あなたの所持ポイント: ${user.points}`, ephemeral: true });
    }

    await interaction.deferReply();

    const roll = Math.floor(Math.random() * 6) + 1;
    const isWin = roll === guess;
    const resultPts = isWin ? Math.floor(bet * config.games.dice.multiplier) : 0;
    const delta = resultPts - bet;

    db.addPoints(userId, guildId, delta);
    db.addTransaction(userId, guildId, 'dice', bet, resultPts);
    
    const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    const embed = new MessageEmbed()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('🎲 ダイスロール 🎲')
      .addField('結果', `${diceFaces[roll - 1]} **${roll}**`, true)
      .addField('あなたの予想', `${diceFaces[guess - 1]} **${guess}**`, true)
      .addField('賭け金', `${bet}pt`, true)
      .setFooter({ text: `現在の所持ポイント: ${user.points + delta}pt` });

    if (isWin) {
      embed.setColor('GREEN').setDescription(`🎉 **大当たり！**\n**${resultPts}**ポイントを獲得しました！`);
    } else {
      embed.setColor('RED').setDescription(`💥 **ハズレ…**\n**${bet}**ポイントを失いました…`);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};