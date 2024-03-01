import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import {
  formatInvoiceDocument,
  getAllInvoicesWithPrimarySplit,
  getAllInvoicesWithSecondarySplit,
  getAllRaidGuildInvoices,
  getIsInvoiceProviderRaidGuild
} from '@/lib';
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

  const allRaidGuildInvoices = await getAllRaidGuildInvoices(client);

  if (allRaidGuildInvoices.length === 0) {
    return;
  }

  const allInvoicesWithSplitProviderReceiver =
    await getAllInvoicesWithPrimarySplit(client, allRaidGuildInvoices);

  if (allInvoicesWithSplitProviderReceiver.length === 0) {
    return;
  }

  const allInvoicesWithSecondarySplitRecipients =
    await getAllInvoicesWithSecondarySplit(
      client,
      allInvoicesWithSplitProviderReceiver
    );

  if (allInvoicesWithSecondarySplitRecipients.length === 0) {
    return;
  }

  const formattedInvoiceDocuments = allInvoicesWithSecondarySplitRecipients.map(
    formatInvoiceDocument
  );

  console.log(formattedInvoiceDocuments);

  embed = new EmbedBuilder()
    .setTitle('Sync Complete!')
    .setColor('#ff3864')
    .setTimestamp();

  setTimeout(async () => {
    await interaction.editReply({ embeds: [embed] });
  }, 3000);
};
