// check-commands.js
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Fetching registered slash commands...');

    const commands = await rest.get(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    );

    console.log('Registered commands:', JSON.stringify(commands, null, 2));
  } catch (error) {
    console.error('Error fetching commands:', error);
  }
})();
