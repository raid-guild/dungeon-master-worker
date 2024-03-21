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
import { dbPromise } from '@/lib/mongodb';
import { ClientWithCommands } from '@/types';
import { CHAIN_ID, RAIDGUILD_DAO_ADDRESS } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

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

  if (!(RAIDGUILD_DAO_ADDRESS && CHAIN_ID)) {
    embed = new EmbedBuilder()
      .setTitle('An error occurred while syncing invoice data')
      .setColor('#ff3864')
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });

    discordLogger('Missing env RAIDGUILD_DAO_ADDRESS or CHAIN_ID', client);
    return;
  }

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

  const updates = formattedInvoiceDocuments.map(invoiceDocument => {
    return {
      updateOne: {
        filter: { address: invoiceDocument.address },
        update: { $set: invoiceDocument },
        upsert: true
      }
    };
  });

  let result = null;

  try {
    const dbClient = await dbPromise;
    result = await dbClient.collection('invoices').bulkWrite(updates);
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
  }

  if (!result) {
    return;
  }

  embed = new EmbedBuilder()
    .setTitle('Sync Complete!')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
};
