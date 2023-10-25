import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { executeQueryInteraction } from '@/commands';
import { getPlayerAddressByDiscordHandle } from '@/lib';
import { dropExp, getCharacterAccountByPlayerAddress } from '@/lib/csHelpers';
import { ClientWithCommands } from '@/types';
import { EXPLORER_URL } from '@/utils/constants';
import { discordLogger, logError } from '@/utils/logger';

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

  const playerAddress = await getPlayerAddressByDiscordHandle(
    client,
    interaction,
    discordMember
  );
  if (!playerAddress) return;

  const accountAddress = await getCharacterAccountByPlayerAddress(
    client,
    interaction,
    playerAddress
  );
  if (!accountAddress) return;

  const tx = await dropExp(client, interaction, accountAddress);
  if (!tx) return;

  const txHash = tx.hash;

  if (EXPLORER_URL) {
    await interaction.followUp({
      content: `Transaction is pending. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
    });
  } else {
    discordLogger('Missing EXPLORER_URL env', client);
  }

  const txReceipt = await tx.wait();

  if (!txReceipt.status) {
    await interaction.followUp({
      content: `Transaction failed!`
    });
    return;
  }

  await interaction.followUp({
    content: `Transaction succeeded! <@${discordMember.id}> has been tipped 5 XP!`
  });
};
