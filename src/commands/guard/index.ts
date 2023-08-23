import { CacheType, CommandInteraction } from 'discord.js';

import {
  createCampChannelCommand,
  createCampChannelExecute
} from '@/commands/guard/create-camp-channel';
import {
  createRaidChannelCommand,
  createRaidChannelExecute
} from '@/commands/guard/create-raid-channel';
import {
  toValhallaCommand,
  toValhallaExecute
} from '@/commands/guard/valhalla';

export {
  createCampChannelCommand,
  createRaidChannelCommand,
  toValhallaCommand
};

export const executeInteraction = async (
  interaction: CommandInteraction<CacheType>
) => {
  const { commandName } = interaction;

  switch (commandName) {
    case toValhallaCommand.name:
      await toValhallaExecute(interaction);
      break;
    case createRaidChannelCommand.name:
      await createRaidChannelExecute(interaction);
      break;
    case createCampChannelCommand.name:
      await createCampChannelExecute(interaction);
      break;
    default:
      console.error(`Command ${commandName} not found`);
      break;
  }
};
