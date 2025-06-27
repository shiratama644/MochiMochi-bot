const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../db.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('ランキングシステムに参加します。'),
    async execute(interaction) {
        const user = interaction.user;
        const wasAdded = db.joinRanking(user.id, interaction.guild.id, user.username);

        if (wasAdded) {
            await interaction.reply({ content: `ようこそ！ランキングに参加しました。これからポイントを貯めていきましょう！ (初期ポイント: ${config.general.initialPoints})`, ephemeral: true });
        } else {
            await interaction.reply({ content: `あなたは既にランキングに参加しています。`, ephemeral: true });
        }
    },
};