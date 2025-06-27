const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const { checkParticipation, checkBetAmount, getRouletteResult } = require('../utils/helpers.js');
const { isOnCooldown } = require('../utils/cooldowns.js');
const db = require('../db.js');

const mult = config.games.roulette.multipliers;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('ルーレットをプレイします。')
    .addSubcommand(sub => sub
      .setName('color')
      .setDescription(`色に賭けます (赤/黒, ${mult.color}倍)`)
      .addStringOption(opt => opt.setName('color').setDescription('賭ける色').setRequired(true).addChoices({ name: '🟥 Red (赤)', value: 'red' }, { name: '⬛ Black (黒)', value: 'black' }))
      .addIntegerOption(opt => opt.setName('points').setDescription(`賭けるポイント (1～${config.general.maxBet})`).setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('parity')
      .setDescription(`偶数か奇数かに賭けます (${mult.parity}倍)`)
      .addStringOption(opt => opt.setName('parity').setDescription('賭ける対象').setRequired(true).addChoices({ name: '🔵 Even (偶数)', value: 'even' }, { name: '⚪️ Odd (奇数)', value: 'odd' }))
      .addIntegerOption(opt => opt.setName('points').setDescription(`賭けるポイント (1～${config.general.maxBet})`).setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('number')
      .setDescription(`特定の数字に賭けます (0-36, ${mult.number}倍)`)
      .addIntegerOption(opt => opt.setName('number').setDescription('賭ける数字 (0-36)').setRequired(true).setMinValue(0).setMaxValue(36))
      .addIntegerOption(opt => opt.setName('points').setDescription(`賭けるポイント (1～${config.general.maxBet})`).setRequired(true))
    ),

  async execute(interaction) {
    const userId  = interaction.user.id;
    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();
    const bet = interaction.options.getInteger('points');

    const cd = isOnCooldown(userId, 'roulette', config.cooldowns.roulette);
    if (cd.active) {
      return interaction.reply({ content: `クールダウン中です。あと ${cd.remaining}秒 待ってください。`, ephemeral: true });
    }

    const user = checkParticipation(userId, guildId);
    if (!user) { return interaction.reply({ content: 'まず `/join` で参加してください。', ephemeral: true }); }

    if (!checkBetAmount(bet, config.general.maxBet)) { return interaction.reply({ content: `賭けられるのは1～${config.general.maxBet}ポイントまでです。`, ephemeral: true }); }
    if (user.points < bet) { return interaction.reply({ content: `所持ポイントが足りません。あなたの所持ポイント: ${user.points}`, ephemeral: true }); }

    await interaction.deferReply();

    const roll = Math.floor(Math.random() * 37); // 0-36
    const result = getRouletteResult(roll);
    let isWin = false;
    let multiplier = 0;
    let choiceStr = '';

    if (subcommand === 'color') {
      const choice = interaction.options.getString('color');
      isWin = result.color === choice;
      multiplier = mult.color;
      choiceStr = `色: ${choice === 'red' ? '🟥' : '⬛'}`;
    } else if (subcommand === 'parity') {
      const choice = interaction.options.getString('parity');
      isWin = result.parity === choice;
      multiplier = mult.parity;
      choiceStr = `偶奇: ${choice === 'even' ? '🔵' : '⚪️'}`;
    } else if (subcommand === 'number') {
      const choice = interaction.options.getInteger('number');
      isWin = roll === choice;
      multiplier = mult.number;
      choiceStr = `数字: **${choice}**`;
    }

    const resultPts = isWin ? Math.floor(bet * multiplier) : 0;
    const delta = resultPts - bet;

    db.addPoints(userId, guildId, delta);
    db.addTransaction(userId, guildId, `roulette-${subcommand}`, bet, resultPts);

    const colorEmoji = { red: '🟥', black: '⬛', green: '🟩' }[result.color];
    const resultStr = `${colorEmoji} **${roll}**`;

    const embed = new MessageEmbed()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('🎡 ルーレット 🎡')
      .addField('結果', resultStr, true)
      .addField('あなたの賭け', choiceStr, true)
      .addField('賭け金', `${bet}pt`, true)
      .setFooter({ text: `現在の所持ポイント: ${user.points + delta}pt` });

    if (isWin) {
      embed.setColor('GREEN').setDescription(`🎉 **大当たり！**\n**${resultPts}**ポイントを獲得しました！`);
    } else {
      embed.setColor('RED').setDescription(`💥 **ハズレ…**\n**${bet}**ポイントを失いました…`);
    }

    await interaction.editReply({ embeds: [embed] });
  }
};