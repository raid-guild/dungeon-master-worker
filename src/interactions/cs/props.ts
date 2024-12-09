import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { createPublicClient, http } from 'viem';

import { CHAINS, CHARACTER_SHEETS_CONFIG } from '@/config';
import {
  checkUserNeedsCooldown,
  dropExp,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordTags,
  updateLatestXpTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import { ENVIRONMENT } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

const TIP_AMOUNT = '10';
const TABLE_NAME = 'latestProps';

export const propsInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  if (!CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl) {
    discordLogger('Missing explorerUrl config variable', client);
    return;
  }

  const senderId = interaction.user.id;
  const { needsCooldown, endTime } = await checkUserNeedsCooldown(
    client,
    TABLE_NAME,
    'main',
    senderId
  );

  if (needsCooldown) {
    const embed = new EmbedBuilder()
      .setTitle('Props Cooldown')
      .setDescription(
        `You must wait ${
          endTime
            ? `until ${endTime} to give props again.`
            : '24 hours between giving props.'
        } `
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const recipients = (interaction.options.get('recipients')?.value ??
    '') as string;
  const recipientArray = recipients.split(' ');
  const recipientIdsWithDuplicates = recipientArray.map(r =>
    r.replace(/<@!?(\d+)>/, '$1')
  );
  const recipientIds = [...new Set(recipientIdsWithDuplicates)];

  const discordMembers = recipientIds.map(id =>
    interaction.guild?.members.cache.get(id)
  );

  const discordUsernames = discordMembers.map(m => m?.user.tag);

  if (discordMembers.some(m => !m) || discordUsernames.some(m => !m)) {
    await interaction.followUp({
      content: 'Some discord handles were not formatted correctly!'
    });
    return;
  }

  const [senderTagToEthAddressMap] = await getPlayerAddressesByDiscordTags(
    client,
    interaction,
    [interaction.member as GuildMember]
  );

  if (
    !senderTagToEthAddressMap?.main ||
    !senderTagToEthAddressMap.main[interaction.user.tag]
  ) {
    const embed = new EmbedBuilder()
      .setTitle('Not a Member')
      .setDescription(
        `You are not a member of RaidGuild! If you think this is an error, ensure that your Discord handle is registered correctly in DungeonMaster.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const [discordTagToEthAddressMap, discordTagsWithoutEthAddress] =
    await getPlayerAddressesByDiscordTags(
      client,
      interaction,
      discordMembers as GuildMember[]
    );

  if (!discordTagToEthAddressMap?.main) return;
  const playerAddresses = Object.values(discordTagToEthAddressMap.main);
  if (!playerAddresses) return;

  const [discordTagToCharacterAccountMap, discordTagsWithoutCharacterAccounts] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap.main,
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress,
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.subgraphUrl,
      interaction
    );
  if (!discordTagToCharacterAccountMap) return;
  const accountAddresses = Object.values(discordTagToCharacterAccountMap);

  if (accountAddresses.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('No Characters Found')
      .setDescription(
        `No characters were found for the following users: ${discordMembers.map(
          m => `<@${m?.id}>`
        )}.\n---\nIf you think this is an error, ensure that your Discord handle and ETH address are registered correctly in DungeonMaster.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  let embed = new EmbedBuilder()
    .setTitle('Props Pending...')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });

  const txHash = await dropExp(client, accountAddresses, TIP_AMOUNT);
  if (!txHash) return;

  embed = new EmbedBuilder()
    .setTitle('Props XP Transaction Pending...')
    .setURL(
      `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
    )
    .setDescription(
      `Transaction is pending. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed]
  });

  const publicClient = createPublicClient({
    chain: CHAINS[CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId],
    transport: http()
  });

  const txReceipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    timeout: 120000
  });

  if (!txReceipt.status) {
    embed = new EmbedBuilder()
      .setTitle('Props XP Transaction Failed!')
      .setURL(
        `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setDescription(
        `Transaction failed. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });
    return;
  }

  const discordMembersSuccessfullyTipped = discordMembers.filter(
    m =>
      !discordTagsWithoutCharacterAccounts?.includes(m?.user.tag as string) &&
      !discordTagsWithoutEthAddress?.main.includes(m?.user.tag as string)
  );
  const discordIdsSuccessfullyTipped = discordMembersSuccessfullyTipped.map(
    m => m?.user.id
  );

  const discordMembersNotInDm = discordMembers.filter(m =>
    discordTagsWithoutEthAddress?.main.includes(m?.user.tag as string)
  );
  const discordIdsNotInDm = discordMembersNotInDm.map(m => m?.user.id);

  const discordMembersNotInCs = discordMembers.filter(m =>
    discordTagsWithoutCharacterAccounts?.includes(m?.user.tag as string)
  );
  const discordIdsNotInCs = discordMembersNotInCs.map(m => m?.user.id);

  const message = (interaction.options.get('message')?.value ?? '') as string;
  const reasonMessage = message ? `\n---\nReason: **${message}**` : '';

  const viewGameMessage = `\n---\nView the game at https://play.raidguild.org`;

  const dmFailureMessage =
    discordIdsNotInDm.length > 0
      ? `\n---\nThe following users were not found in DungeonMaster: ${discordIdsNotInDm.map(
          id => `<@${id}>`
        )}.`
      : '';

  const csFailureMessage =
    discordIdsNotInCs.length > 0
      ? `\n---\nThe following users were not found in CharacterSheets: ${discordIdsNotInCs.map(
          id => `<@${id}>`
        )}.`
      : '';

  embed = new EmbedBuilder()
    .setTitle('Props Succeeded!')
    .setURL(
      `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
    )
    .setDescription(
      `**<@${senderId}>** tipped ${TIP_AMOUNT} XP to the characters of ${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.${reasonMessage}${viewGameMessage}${dmFailureMessage}${csFailureMessage}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  const data = {
    channelId: interaction.channelId,
    lastSenderDiscordId: senderId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    chainId: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId,
    txHash,
    message
  };

  await updateLatestXpTip(client, TABLE_NAME, 'main', data);

  await interaction.editReply({
    embeds: [embed]
  });
};
