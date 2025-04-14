import { CacheType, CommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
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
import { sendMessageWithFallback } from '@/utils/discord-utils';

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
        
        // Use the sendMessageWithFallback utility if the channel is available
        if (interaction.channel && interaction.channel instanceof TextChannel) {
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('Command Timeout')
            .setDescription('Sorry, I couldn\'t respond to your command in time. Please try again.')
            .setColor('#ff3864');
            
          await sendMessageWithFallback(interaction, interaction.channel, timeoutEmbed);
        }
      } else {
        console.error(`Error executing command ${commandName}:`, error);
        discordLogger(`Error executing command ${commandName}: ${error}`, interaction.client);
        
        // Use sendMessageWithFallback for error response
        if (interaction.channel && interaction.channel instanceof TextChannel) {
          const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('An error occurred while processing your command.')
            .setColor('#ff3864');
            
          await sendMessageWithFallback(interaction, interaction.channel, errorEmbed, true);
        }
      }
    }
  };
