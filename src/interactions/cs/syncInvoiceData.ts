import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import {
  formatInvoiceXpDistributionDocuments,
  getAllInvoicesWithPrimarySplit,
  getAllInvoicesWithSecondarySplit,
  getAllRaidGuildInvoices,
  getCharacterAccountsByPlayerAddresses,
  getInvoiceXpDistributions,
  // getIsInvoiceProviderRaidGuild,
  getRaidDataFromInvoiceAddresses,
  giveClassXp,
  rollCharacterSheets
} from '@/lib';
import { dbPromise } from '@/lib/mongodb';
import {
  ClientWithCommands,
  InvoiceWithSplits,
  TRANSACTION_STATUS
} from '@/types';
import { EXPLORER_URL } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

// const TEMP_INVOICE_ADDRESS = '0xe7645f30f48767d9d503a79870a6239b952e5176';

const sendErrorEmbed = async (
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const embed = new EmbedBuilder()
    .setTitle('Error')
    .setDescription('An error occurred while syncing.')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({
    embeds: [embed]
  });
};

const sendNoSyncableInvoicesEmbed = async (
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const embed = new EmbedBuilder()
    .setTitle('Sync Complete!')
    .setDescription('No invoices found.')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed]
  });
};

export const syncInvoiceDataInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  let embed = new EmbedBuilder()
    .setTitle('Syncing...')
    .setDescription('This could take a few minutes.')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({
    embeds: [embed]
  });

  // const isInvoiceProviderRaidGuild = await getIsInvoiceProviderRaidGuild(
  //   client,
  //   TEMP_INVOICE_ADDRESS
  // );

  // if (!isInvoiceProviderRaidGuild) {
  //   return;
  // }

  // 1) Get all invoices with RaidGuild as the provider
  const allRaidGuildInvoices = await getAllRaidGuildInvoices(client);

  if (!allRaidGuildInvoices) {
    await sendErrorEmbed(interaction);
    return;
  }

  if (allRaidGuildInvoices.length === 0) {
    await sendNoSyncableInvoicesEmbed(interaction);
    return;
  }

  // 2) Get all RaidGuild invoices that include an 0xSplit as a receiver
  const allInvoicesWithSplitProviderReceiver =
    await getAllInvoicesWithPrimarySplit(client, allRaidGuildInvoices);

  if (!allInvoicesWithSplitProviderReceiver) {
    await sendErrorEmbed(interaction);
    return;
  }

  if (allInvoicesWithSplitProviderReceiver.length === 0) {
    await sendNoSyncableInvoicesEmbed(interaction);
    return;
  }

  // 3) Get all RaidGuild invoices that include an 0xSplit within the first 0xSplit as a receiver
  const allInvoicesWithSecondarySplitRecipients =
    (await getAllInvoicesWithSecondarySplit(
      client,
      allInvoicesWithSplitProviderReceiver
    )) as InvoiceWithSplits[];

  if (!allInvoicesWithSecondarySplitRecipients) {
    await sendErrorEmbed(interaction);
    return;
  }

  if (allInvoicesWithSecondarySplitRecipients.length === 0) {
    await sendNoSyncableInvoicesEmbed(interaction);
    return;
  }

  const allInvoiceAddresses = allInvoicesWithSecondarySplitRecipients.map(
    invoice => invoice.id
  );

  // 4) Get all invoice XP distributions with theses invoice addresses
  const existingInvoiceXpDistributions = await getInvoiceXpDistributions(
    client,
    allInvoiceAddresses
  );

  if (!existingInvoiceXpDistributions) {
    await sendErrorEmbed(interaction);
    return;
  }

  const xpReceivedAlready = existingInvoiceXpDistributions.reduce(
    (acc, xpDistro) => {
      if (!acc[xpDistro.invoiceAddress]) {
        acc[xpDistro.invoiceAddress] = {};
      }

      if (!acc[xpDistro.invoiceAddress][xpDistro.playerAddress]) {
        acc[xpDistro.invoiceAddress][xpDistro.playerAddress] = BigInt(0);
      }

      acc[xpDistro.invoiceAddress][xpDistro.playerAddress] += BigInt(
        xpDistro.amount
      );

      return acc;
    },
    {} as Record<string, Record<string, bigint>>
  );

  // 5) Format data for database
  let newInvoiceXpDistroDocs = formatInvoiceXpDistributionDocuments(
    allInvoicesWithSecondarySplitRecipients,
    xpReceivedAlready
  );

  // 6) Get Raid data using invoice addresses
  const distroDocsWithRaidData = await getRaidDataFromInvoiceAddresses(
    client,
    newInvoiceXpDistroDocs
  );

  if (!distroDocsWithRaidData) {
    await sendErrorEmbed(interaction);
    return;
  }

  // 7) Filter out any receivers that don't have a class key in DungeonMaster or who aren't owed XP
  newInvoiceXpDistroDocs = distroDocsWithRaidData.filter(
    distroDoc =>
      distroDoc.classKey !== '' && BigInt(distroDoc.amount) > BigInt(0)
  );

  const discordTagToEthAddressMap: Record<string, string> =
    newInvoiceXpDistroDocs.reduce((acc, distroDoc) => {
      acc[distroDoc.discordTag as string] = distroDoc.playerAddress;
      return acc;
    }, {} as Record<string, string>);

  // 8) Get character accounts by player addresses
  const [discordTagToCharacterAccountMap1] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap
    );

  if (!discordTagToCharacterAccountMap1) {
    await sendErrorEmbed(interaction);
    return;
  }

  // 9) Create characters for players that don't have a character account
  const distroDocsWithoutAccountAddresses = newInvoiceXpDistroDocs.filter(
    distroDoc => !discordTagToCharacterAccountMap1[distroDoc.discordTag ?? '']
  );

  let tx = null;

  if (distroDocsWithoutAccountAddresses.length > 0) {
    tx = await rollCharacterSheets(client, distroDocsWithoutAccountAddresses);

    if (!tx) {
      await sendErrorEmbed(interaction);
      return;
    }

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

    const txReceipt = await tx.wait(2);

    if (!txReceipt.status) {
      embed = new EmbedBuilder()
        .setTitle('Character Creation Transaction Failed!')
        .setURL(`${EXPLORER_URL}/tx/${txHash}`)
        .setDescription(
          `Transaction failed. View the transaction here:\n${EXPLORER_URL}/tx/${txHash}`
        )
        .setColor('#ff3864')
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

      return;
    }

    embed = new EmbedBuilder()
      .setTitle('New Characters Created! Invoices Still Syncing...')
      .setDescription(
        `View the transaction here:\n${EXPLORER_URL}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });
  }

  // 10) Re-fetch character accounts by player addresses
  const [discordTagToCharacterAccountMap2] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap
    );

  if (!discordTagToCharacterAccountMap2) {
    await sendErrorEmbed(interaction);
    return;
  }

  // 11) Add account addresses to payout info
  newInvoiceXpDistroDocs = newInvoiceXpDistroDocs.map(distroDoc => {
    return {
      ...distroDoc,
      accountAddress:
        discordTagToCharacterAccountMap2[distroDoc.discordTag ?? ''] ?? null
    };
  });

  if (newInvoiceXpDistroDocs.length === 0) {
    await sendNoSyncableInvoicesEmbed(interaction);
    return;
  }

  newInvoiceXpDistroDocs = newInvoiceXpDistroDocs.filter(
    payoutInfo => payoutInfo.accountAddress !== ''
  );

  // 12) Give class XP to players
  tx = await giveClassXp(client, newInvoiceXpDistroDocs);

  if (!tx) {
    await sendErrorEmbed(interaction);
    return;
  }

  const txHash = tx.hash;

  newInvoiceXpDistroDocs = newInvoiceXpDistroDocs.map(distroDoc => {
    return {
      ...distroDoc,
      transactionHash: txHash
    };
  });

  embed = new EmbedBuilder()
    .setTitle('Class XP Transaction Pending...')
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `Transaction is pending. View the transaction here:\n${EXPLORER_URL}/tx/${txHash}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed]
  });

  const txReceipt = await tx.wait();

  if (!txReceipt.status) {
    newInvoiceXpDistroDocs = newInvoiceXpDistroDocs.map(distroDoc => {
      return {
        ...distroDoc,
        transactionStatus: TRANSACTION_STATUS.FAILED
      };
    });

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

  embed = new EmbedBuilder()
    .setTitle('Class XP Given! Invoices Still Syncing...')
    .setDescription(`View the transaction here:\n${EXPLORER_URL}/tx/${txHash}`)
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed]
  });

  // 13) Update invoice documents transaction status
  newInvoiceXpDistroDocs = newInvoiceXpDistroDocs.map(distroDoc => {
    return {
      ...distroDoc,
      transactionStatus: TRANSACTION_STATUS.SUCCESS
    };
  });

  // 14) Add new invoice documents to database
  let result = null;

  try {
    const dbClient = await dbPromise;
    result = await dbClient
      .collection('invoiceXpDistributions')
      .insertMany(newInvoiceXpDistroDocs);
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
  }

  if (!result) {
    await sendErrorEmbed(interaction);
    return;
  }

  embed = new EmbedBuilder()
    .setTitle('Sync Complete!')
    .setDescription(
      'Invoice data has been synced with characters. View the game at https://play.raidguild.org'
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
};
