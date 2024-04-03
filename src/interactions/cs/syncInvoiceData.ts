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
  getCharacterAccountsByPlayerAddresses,
  getInvoiceXpDistroData,
  getIsInvoiceProviderRaidGuild,
  getRaidDataFromInvoiceAddresses,
  giveClassXp,
  rollCharacterSheets
} from '@/lib';
import { dbPromise } from '@/lib/mongodb';
import { ClientWithCommands, InvoiceDocument } from '@/types';
import { EXPLORER_URL } from '@/utils/constants';
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

  const dbClient = await dbPromise;
  let previousInvoiceDocuments: InvoiceDocument[] = [];

  try {
    previousInvoiceDocuments = (await dbClient
      .collection('invoices')
      .find({
        invoiceAddress: {
          $in: formattedInvoiceDocuments.map(
            invoiceDocument => invoiceDocument.invoiceAddress
          )
        }
      })
      .toArray()) as InvoiceDocument[];
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
  }

  const invoiceXpDistroData = getInvoiceXpDistroData(
    formattedInvoiceDocuments,
    previousInvoiceDocuments as InvoiceDocument[]
  );

  if (invoiceXpDistroData.length === 0) {
    return;
  }

  const allPayoutInfo = await getRaidDataFromInvoiceAddresses(
    client,
    invoiceXpDistroData
  );

  if (!allPayoutInfo) {
    return;
  }

  const discordTagToEthAddressMap: Record<string, string> =
    allPayoutInfo.reduce((acc, payoutInfo) => {
      acc[payoutInfo.discordTag as string] = payoutInfo.playerAddress;
      return acc;
    }, {} as Record<string, string>);

  const [discordTagToCharacterAccountMap1] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap
    );

  if (!discordTagToCharacterAccountMap1) {
    return;
  }

  const allPayoutInfoWithoutAccountAddresses = allPayoutInfo.filter(
    payoutInfo => !discordTagToCharacterAccountMap1[payoutInfo.discordTag ?? '']
  );

  let tx = null;

  if (allPayoutInfoWithoutAccountAddresses.length > 0) {
    tx = await rollCharacterSheets(
      client,
      allPayoutInfoWithoutAccountAddresses
    );

    if (!tx) return;

    const txHash = tx.hash;

    embed = new EmbedBuilder()
      .setTitle('Character Creation Transaction Pending...')
      .setURL(`${EXPLORER_URL}/tx/${txHash}`)
      .setDescription(
        `Transaction is pending. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });

    const txReceipt = await tx.wait();

    if (!txReceipt.status) {
      embed = new EmbedBuilder()
        .setTitle('Class XP Transaction Failed!')
        .setURL(`${EXPLORER_URL}/tx/${txHash}`)
        .setDescription(
          `Transaction failed. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
        )
        .setColor('#ff3864')
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });
      return;
    }
  }

  const [discordTagToCharacterAccountMap2] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap
    );

  if (!discordTagToCharacterAccountMap2) {
    return;
  }

  const allPayoutInfoWithAccountAddresses = allPayoutInfo.map(payoutInfo => {
    return {
      ...payoutInfo,
      accountAddress:
        discordTagToCharacterAccountMap2[payoutInfo.discordTag ?? ''] ?? null
    };
  });

  if (allPayoutInfoWithAccountAddresses.length === 0) {
    return;
  }

  const finalPayoutInfo = allPayoutInfoWithAccountAddresses.filter(
    payoutInfo => payoutInfo.accountAddress !== null
  );

  tx = await giveClassXp(client, finalPayoutInfo);

  if (!tx) return;

  const txHash = tx.hash;

  embed = new EmbedBuilder()
    .setTitle('Class XP Transaction Pending...')
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `Transaction is pending. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed]
  });

  const txReceipt = await tx.wait();

  if (!txReceipt.status) {
    embed = new EmbedBuilder()
      .setTitle('Class XP Transaction Failed!')
      .setURL(`${EXPLORER_URL}/tx/${txHash}`)
      .setDescription(
        `Transaction failed. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });
    return;
  }

  const updatedInvoiceDocuments = formattedInvoiceDocuments.map(
    invoiceDocument => {
      return {
        ...invoiceDocument,
        secondarySplitRecipients: invoiceDocument.secondarySplitRecipients.map(
          recipient => {
            return {
              ...recipient,
              xpReceived: finalPayoutInfo.some(
                payoutInfo =>
                  payoutInfo.invoiceAddress ===
                    invoiceDocument.invoiceAddress &&
                  payoutInfo.playerAddress === recipient.address &&
                  payoutInfo.classKey !== null
              )
            };
          }
        )
      };
    }
  );

  const updates = updatedInvoiceDocuments.map(invoiceDocument => {
    return {
      updateOne: {
        filter: { invoiceAddress: invoiceDocument.invoiceAddress },
        update: { $set: invoiceDocument },
        upsert: true
      }
    };
  });

  let result = null;

  try {
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
