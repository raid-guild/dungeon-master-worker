import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';

import { executeInteraction, queryCommand } from '@/commands';
import { setupGuardWorker } from '@/guardWorker';
import { ClientWithCommands } from '@/types';
import {
  DISCORD_ALLOWED_PARENT_CHANNEL_IDS,
  DISCORD_DM_TOKEN
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const setupDungeonMasterWorker = () => {
  const client: ClientWithCommands = new Client({
    intents: [GatewayIntentBits.Guilds]
  });
  client.commands = new Collection();
  client.commands.set(queryCommand.name, queryCommand);

  client.once(Events.ClientReady, c => {
    console.log(`Discord DM bot ready! Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = (interaction.client as ClientWithCommands).commands?.get(
      interaction.commandName
    );

    if (!command) {
      console.log(`Command ${interaction.commandName} not found`);
      return;
    }

    const channelId = interaction.channel?.id;
    const channel = interaction.guild?.channels.cache.get(channelId ?? '');

    if (
      channel?.parentId &&
      !DISCORD_ALLOWED_PARENT_CHANNEL_IDS.includes(channel.parentId)
    ) {
      await interaction.reply({
        content: 'You cannot use DungeonMaster in this channel!',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    const prompt = interaction.options.get('prompt')?.value as string;

    if (!prompt) {
      await interaction.followUp({
        content: 'You must provide a prompt!'
      });
      return;
    }

    try {
      await executeInteraction(interaction, prompt);
    } catch (error) {
      console.error(error);
      discordLogger(error, client);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `
            Original query: ${prompt}\n\nThere was an error while generating a response!
          `
        });
      } else {
        discordLogger(error, client);
        await interaction.reply({
          content: `
            Original query: ${prompt}\n\nThere was an error while generating a response!
          `
        });
      }
    }
  });

  client.login(DISCORD_DM_TOKEN);
};

setupDungeonMasterWorker();
setupGuardWorker();
