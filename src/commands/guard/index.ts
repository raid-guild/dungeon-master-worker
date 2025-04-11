import { CacheType, CommandInteraction } from 'discord.js';
import { DiscordAPIError } from '@/types';

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
  roleStatsCommand,
  roleStatsExecute
} from '@/commands/guard/role-stats';
import {
  toValhallaCommand,
  toValhallaExecute
} from '@/commands/guard/valhalla';
import { discordLogger } from '@/utils/logger';

export {
  createCampChannelCommand,
  createRaidChannelCommand,
  editCampChannelCommand,
  editRaidChannelCommand,
  roleStatsCommand,
  toValhallaCommand
};

export const executeInteraction = async (
  interaction: CommandInteraction<CacheType>
) => {
  const { commandName } = interaction;

  try {
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
      case roleStatsCommand.name:
        await roleStatsExecute(interaction);
        break;
      default:
        console.error(`Command ${commandName} not found`);
        break;
    }
  } catch (error) {
    // Handle Discord API errors gracefully
    const discordError = error as DiscordAPIError;
    
    if (discordError && discordError.code === 10062) {
      console.log(`Interaction expired for command: ${commandName}`);
      
      // If possible, try to send a message to the channel instead
      try {
        if (interaction.channel) {
          await interaction.channel.send({
            embeds: [{
              title: 'Command Timeout',
              description: 'Sorry, I couldn\'t respond to your command in time. Please try again.',
              color: 0xff3864
            }]
          });
        }
      } catch (followUpError) {
        console.error('Failed to send fallback message:', followUpError);
      }
    } else {
      console.error(`Error executing command ${commandName}:`, error);
      discordLogger(`Error executing command ${commandName}: ${error}`, interaction.client);
      
      // Try to respond with an error message if interaction is still valid
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: 'An error occurred while processing your command.',
            ephemeral: true 
          });
        } else if (interaction.deferred) {
          await interaction.followUp({
            content: 'An error occurred while processing your command.',
            ephemeral: true
          });
        }
      } catch (responseError) {
        console.error('Failed to send error response:', responseError);
      }
    }
  }
};