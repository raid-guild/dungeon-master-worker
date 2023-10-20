import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { executeQueryInteraction, executeTipXpInteraction } from '@/commands';
import { ClientWithCommands } from '@/types';
import { discordLogger } from '@/utils/logger';

export const handleError = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction,
  error: unknown,
  content: string
) => {
  console.error(error);
  discordLogger(error, client);
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content
    });
  } else {
    await interaction.reply({
      content
    });
  }
};

export const queryInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const prompt = interaction.options.get('prompt')?.value as string;

  if (!prompt) {
    await interaction.followUp({
      content: 'You must provide a prompt!'
    });
    return;
  }

  try {
    await executeQueryInteraction(interaction, prompt);
  } catch (error) {
    handleError(
      client,
      interaction,
      error,
      `Original query: ${prompt}\n\nThere was an error while generating a response!`
    );
  }
};

export const tipXpInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  try {
    await executeTipXpInteraction(interaction);
  } catch (error) {
    handleError(
      client,
      interaction,
      error,
      'There was an error while giving an XP tip!'
    );
  }
};
