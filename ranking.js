const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('現在のポイントランキングTOP10を表示します。'),
    async execute(interaction) {
        const ranking = db.getRanking(interaction.guild.id, 10);

        if (ranking.length === 0) {
            await interaction.reply('まだ誰もランキングに参加していません。 `/join` で参加しよう！');
            return;
        }

        const embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('🏆 ポイントランキング 🏆')
            .setDescription('サーバー内での活動に基づいたポイントランキングです。')
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        const rankingText = await Promise.all(ranking.map(async (user, index) => {
            const rank = index + 1;
            const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || `**${rank}**`;
            // ユーザーが見つからない場合も考慮
            const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);
            const displayName = member ? member.displayName : user.username;

            return `${medal} ${displayName} - **${user.points}** ポイント`;
        }));

        embed.addField('Top 10', rankingText.join('\n'));

        await interaction.reply({ embeds: [embed] });
    },
};