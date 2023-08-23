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
  editCampChannelCommand,
  editCampChannelExecute
} from '@/commands/guard/edit-camp-channel';
import {
  editRaidChannelCommand,
  editRaidChannelExecute
} from '@/commands/guard/edit-raid-channel';
import {
  toValhallaCommand,
  toValhallaExecute
} from '@/commands/guard/valhalla';

export {
  createCampChannelCommand,
  createRaidChannelCommand,
  editCampChannelCommand,
  editRaidChannelCommand,
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
    case editRaidChannelCommand.name:
      await editRaidChannelExecute(interaction);
      break;
    case editCampChannelCommand.name:
      await editCampChannelExecute(interaction);
      break;
    default:
      console.error(`Command ${commandName} not found`);
      break;
  }
};
