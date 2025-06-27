const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checkParticipation, checkBetAmount } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js');
const db = require('../db.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription(`勝率${config.games.gamble.winChance * 100}%のギャンブル。当たりは賭け金×${config.games.gamble.multiplier}倍。`)
    .addIntegerOption(opt =>
      opt.setName('points')
         .setDescription(`賭けるポイント数 (1～${config.general.maxBet})`)
         .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const bet = interaction.options.getInteger('points');

    const cd = isOnCooldown(userId, 'gamble', config.cooldowns.gamble);
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

    const isWin = Math.random() < config.games.gamble.winChance;
    const resultPts = isWin ? Math.floor(bet * config.games.gamble.multiplier) : 0;
    const delta = resultPts - bet;
    
    db.addPoints(userId, guildId, delta);
    db.addTransaction(userId, guildId, 'gamble', bet, resultPts);

    const newBalance = user.points + delta;

    const embed = new MessageEmbed()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('🎲 シンプルギャンブル 🎲')
      .addField('賭け金', `${bet}pt`, true)
      .setFooter({ text: `現在の所持ポイント: ${newBalance}pt` });

    if (isWin) {
      embed.setColor('GREEN')
           .setDescription(`🎉 **勝利！**\n**${resultPts}**ポイントを獲得しました！`);
    } else {
      embed.setColor('RED')
           .setDescription(`💸 **敗北…**\n**${bet}**ポイントを失いました…`);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};