// GlitchのUptime用Expressサーバー
const express = require('express');
const app = express();
app.get('/', (req, res) => {
  res.send('Bot is running!');
});
app.listen(3000, () => {
  console.log('Express server listening on port 3000 to keep the bot alive.');
});

// --- Discord Bot 本体 ---
require('dotenv').config();
const fs = require('node:fs');
const { Client, Collection, Intents } = require('discord.js');
const db = require('./db.js');
const config = require('./config.json'); // configを読み込む

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
    ]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        client.commands.set(command.data.name, command);
    } catch (error) {
        console.error(`Error loading command ${file}:`, error);
    }
}

// --- イベントリスナー ---

client.once('ready', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (process.env.ALLOWED_CHANNEL_ID && interaction.channelId !== process.env.ALLOWED_CHANNEL_ID) {
        try {
            await interaction.reply({
                content: `このコマンドは <#${process.env.ALLOWED_CHANNEL_ID}> チャンネルでのみ使用できます。`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Failed to send channel restriction message:', error);
        }
        return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing command "${interaction.commandName}":`, error);
        const errorMessage = { content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            console.error('Failed to send error message to user:', replyError);
        }
    }
});

client.on('messageCreate', message => {
    if (message.author.bot || !message.guild) return;
    try {
        const user = db.getUser(message.author.id, message.guild.id);
        if (user) {
            // configからポイント獲得量を読み込む
            db.addPoints(message.author.id, message.guild.id, config.pointSystem.perMessage);
        }
    } catch (error) {
        console.error(`Failed to add points for message from ${message.author.tag}:`, error);
    }
});

const vcJoinTimes = new Map();
client.on('voiceStateUpdate', (oldState, newState) => {
    try {
        const userId = newState.id;
        const guildId = newState.guild.id;

        if (!oldState.channel && newState.channel) {
            vcJoinTimes.set(userId, Date.now());
        } else if (oldState.channel && !newState.channel) {
            if (vcJoinTimes.has(userId)) {
                const joinTime = vcJoinTimes.get(userId);
                const durationMinutes = Math.floor((Date.now() - joinTime) / (1000 * 60));
                vcJoinTimes.delete(userId);

                if (durationMinutes > 0) {
                    const user = db.getUser(userId, guildId);
                    if (user) {
                        // configからポイント獲得量を読み込む
                        const pointsToAdd = durationMinutes * config.pointSystem.perVcMinute;
                        db.addPoints(userId, guildId, pointsToAdd);
                        console.log(`${newState.member?.displayName || 'A user'} was in VC for ${durationMinutes} minutes, earned ${pointsToAdd} points.`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in voiceStateUpdate event:', error);
    }
});

// --- プロセス全体のエラーハンドリング ---
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);