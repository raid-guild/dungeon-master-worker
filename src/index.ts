import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';

import { queryCommand, tipXpAttendanceCommand, tipXpCommand } from '@/commands';
import { setupGuardWorker } from '@/guardWorker';
import {
  queryInteraction,
  tipXpAttendanceInteraction,
  tipXpInteraction
} from '@/interactions';
import { ClientWithCommands } from '@/types';
import {
  DISCORD_ALLOWED_PARENT_CHANNEL_IDS,
  DISCORD_DM_TOKEN
} from '@/utils/constants';

export const setupDungeonMasterWorker = () => {
  const client: ClientWithCommands = new Client({
    intents: [GatewayIntentBits.Guilds]
  });
  client.commands = new Collection();
  client.commands.set(queryCommand.name, queryCommand);
  client.commands.set(tipXpCommand.name, tipXpCommand);
  client.commands.set(tipXpAttendanceCommand.name, tipXpAttendanceCommand);

  client.once(Events.ClientReady, c => {
    console.log(`Discord DM bot ready! Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = (interaction.client as ClientWithCommands).commands?.get(
      interaction.commandName
    ) as { name: string } | undefined;

    if (!command) {
      console.log(`Command ${interaction.commandName} not found`);
      return;
    }

    const channelId = interaction.channel?.id;
    const channel = interaction.guild?.channels.cache.get(channelId ?? '');
    const allowedAnywhereCommands = [
      tipXpCommand.name,
      tipXpAttendanceCommand.name
    ];

    if (
      channel?.parentId &&
      !DISCORD_ALLOWED_PARENT_CHANNEL_IDS.includes(channel.parentId) &&
      !allowedAnywhereCommands.includes(command.name)
    ) {
      await interaction.reply({
        content: 'You cannot use DungeonMaster in this channel!',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    switch (command.name) {
      case queryCommand.name:
        await queryInteraction(client, interaction);
        break;
      case tipXpCommand.name:
        await tipXpInteraction(client, interaction);
        break;
      case tipXpAttendanceCommand.name:
        await tipXpAttendanceInteraction(client, interaction);
        break;
      default:
        await interaction.followUp({
          content: 'Command not found!'
        });
        break;
    }
  });

  client.login(DISCORD_DM_TOKEN);
};

setupDungeonMasterWorker();
setupGuardWorker();
