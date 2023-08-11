import { TextChannel } from 'discord.js';

import { ClientWithCommands } from '@/types';
import { DISCORD_COMMAND_CENTER_ID, DISCORD_GUILD_ID } from '@/utils/constants';

export const discordLogger = (
  errorMessage: unknown,
  client: ClientWithCommands
) => {
  try {
    const guild = client.guilds.cache.get(DISCORD_GUILD_ID);

    if (!guild) {
      console.error('Error logging: guild not found');
      return;
    }

    const commandCenterChannel = guild.channels.cache.get(
      DISCORD_COMMAND_CENTER_ID
    );

    if (!commandCenterChannel) {
      console.error('Error logging: command center channel not found');
      return;
    }
    (commandCenterChannel as unknown as TextChannel).send({
      content: String(errorMessage)
    });
  } catch (err) {
    console.log(err);
  }
};
