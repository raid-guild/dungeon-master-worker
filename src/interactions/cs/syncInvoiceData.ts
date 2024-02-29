import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { getIsInvoiceProviderRaidGuild } from '@/lib';
import { ClientWithCommands } from '@/types';

const TEMP_INVOICE_ADDRESS = '0xe7645f30f48767d9d503a79870a6239b952e5176';

export const syncInvoiceDataInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  let embed = new EmbedBuilder()
    .setTitle('Syncing...')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({
    embeds: [embed]
  });

  const isInvoiceProviderRaidGuild = await getIsInvoiceProviderRaidGuild(
    client,
    TEMP_INVOICE_ADDRESS
  );

  if (!isInvoiceProviderRaidGuild) {
    return;
  }

  embed = new EmbedBuilder()
    .setTitle('Sync Complete!')
    .setColor('#ff3864')
    .setTimestamp();

  setTimeout(async () => {
    await interaction.editReply({ embeds: [embed] });
  }, 3000);
};
