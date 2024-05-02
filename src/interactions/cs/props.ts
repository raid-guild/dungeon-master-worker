import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import {
  checkUserNeedsCooldown,
  dropExp,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordTags,
  updateLatestXpTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import { CHAIN_ID, EXPLORER_URL } from '@/utils/constants';
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
  if (!EXPLORER_URL) {
    discordLogger('Missing EXPLORER_URL env', client);
    return;
  }

  const senderId = interaction.user.id;
  const { needsCooldown, endTime } = await checkUserNeedsCooldown(
    client,
    TABLE_NAME,
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
    !senderTagToEthAddressMap ||
    !senderTagToEthAddressMap[interaction.user.tag]
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

  if (!discordTagToEthAddressMap) return;
  const playerAddresses = Object.values(discordTagToEthAddressMap);
  if (!playerAddresses) return;

  const [discordTagToCharacterAccountMap, discordTagsWithoutCharacterAccounts] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap,
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

  const tx = await dropExp(client, accountAddresses, TIP_AMOUNT);
  if (!tx) return;

  const txHash = tx.hash;

  let embed = new EmbedBuilder()
    .setTitle('Props XP Transaction Pending...')
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `Transaction is pending. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({
    embeds: [embed]
  });

  const txReceipt = await tx.wait();

  if (!txReceipt.status) {
    embed = new EmbedBuilder()
      .setTitle('Props XP Transaction Failed!')
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

  const discordMembersSuccessfullyTipped = discordMembers.filter(
    m =>
      !discordTagsWithoutCharacterAccounts?.includes(m?.user.tag as string) &&
      !discordTagsWithoutEthAddress?.includes(m?.user.tag as string)
  );
  const discordIdsSuccessfullyTipped = discordMembersSuccessfullyTipped.map(
    m => m?.user.id
  );

  const discordMembersNotInDm = discordMembers.filter(m =>
    discordTagsWithoutEthAddress?.includes(m?.user.tag as string)
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
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `**<@${senderId}>** tipped ${TIP_AMOUNT} XP to the characters of ${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.${reasonMessage}${viewGameMessage}${dmFailureMessage}${csFailureMessage}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  const data = {
    lastSenderDiscordId: senderId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    chainId: CHAIN_ID,
    txHash,
    message
  };

  await updateLatestXpTip(client, TABLE_NAME, data);

  await interaction.editReply({
    embeds: [embed]
  });
};
