const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const { checkParticipation, checkBetAmount } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription(`コインの表裏を予想します。当たりは賭け金×${config.games.coinflip.multiplier}倍。`)
    .addStringOption(opt =>
      opt.setName('choice')
         .setDescription('表 または 裏')
         .setRequired(true)
         .addChoices({ name: '表', value: '表' }, { name: '裏', value: '裏' })
    )
    .addIntegerOption(opt =>
      opt.setName('points')
         .setDescription(`賭けるポイント数 (1～${config.general.maxBet})`)
         .setRequired(true)
    ),

  async execute(interaction) {
    const userId   = interaction.user.id;
    const guildId  = interaction.guild.id;
    const choice   = interaction.options.getString('choice');
    const bet      = interaction.options.getInteger('points');

    const cd = isOnCooldown(userId, 'coinflip', config.cooldowns.coinflip);
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

    const flip = Math.random() < 0.5 ? '表' : '裏';
    const isWin = choice === flip;
    const resultPts = isWin ? Math.floor(bet * config.games.coinflip.multiplier) : 0;
    const delta = resultPts - bet;

    db.addPoints(userId, guildId, delta);
    db.addTransaction(userId, guildId, 'coinflip', bet, resultPts);

    const embed = new MessageEmbed()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('🪙 コインフリップ 🪙')
      .addField('結果', `コインは **${flip}** でした！`, true)
      .addField('あなたの選択', choice, true)
      .addField('賭け金', `${bet}pt`, true)
      .setFooter({ text: `現在の所持ポイント: ${user.points + delta}pt` });

    if (isWin) {
      embed.setColor('GREEN').setDescription(`🎉 **勝利！**\n**${resultPts}**ポイントを獲得しました！`);
    } else {
      embed.setColor('RED').setDescription(`💸 **敗北…**\n**${bet}**ポイントを失いました…`);
    }

    await interaction.editReply({ embeds: [embed] });
  }
};