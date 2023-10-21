import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { executeQueryInteraction, executeTipXpInteraction } from '@/commands';
import { getPlayerAddressByDiscordHandle } from '@/lib';
import { ClientWithCommands } from '@/types';
import { logError } from '@/utils/logger';

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
    logError(
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
  const memberId = (interaction.options.get('member')?.value ?? '') as string;
  const discordMember = interaction.guild?.members.cache.get(memberId);
  const discordUsername = discordMember?.user.tag;

  if (!discordUsername) {
    await interaction.followUp({
      content: 'Could not find Discord user!'
    });
    return;
  }

  const ethAddress = await getPlayerAddressByDiscordHandle(
    client,
    interaction,
    discordUsername
  );

  console.log(`ethAddress: ${ethAddress}`);

  try {
    await executeTipXpInteraction(interaction);
  } catch (error) {
    logError(
      client,
      interaction,
      error,
      'There was an error while giving an XP tip!'
    );
  }
};
