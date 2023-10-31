import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  VoiceBasedChannel
} from 'discord.js';

import {
  checkUserNeedsCooldown,
  dropExp,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordHandles,
  updateLatestXpTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import { EXPLORER_URL } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const tipXpInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const TIP_AMOUNT = '10';
  const TABLE_NAME = 'latestXpTips';

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
      .setTitle('XP Tipping Cooldown')
      .setDescription(
        `You must wait ${
          endTime
            ? `until ${endTime} to tip again.`
            : '24 hours between tipping.'
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

  const [senderTagToEthAddressMap] = await getPlayerAddressesByDiscordHandles(
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
    await getPlayerAddressesByDiscordHandles(
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
      interaction,
      discordTagToEthAddressMap
    );
  if (!discordTagToCharacterAccountMap) return;
  const accountAddresses = Object.values(discordTagToCharacterAccountMap);
  if (!accountAddresses) return;

  const tx = await dropExp(client, interaction, accountAddresses, TIP_AMOUNT);
  if (!tx) return;

  const txHash = tx.hash;

  let embed = new EmbedBuilder()
    .setTitle('XP Tipping Transaction Pending...')
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
      .setTitle('XP Tipping Transaction Failed!')
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
    .setTitle('XP Tipping Succeeded!')
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `**<@${senderId}>** tipped ${TIP_AMOUNT} XP to the characters of ${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.${dmFailureMessage}${csFailureMessage}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  const data = {
    lastSenderDiscordId: senderId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    txHash
  };

  await updateLatestXpTip(client, 'latestXpTips', data);

  await interaction.editReply({
    embeds: [embed]
  });
};

export const tipXpAttendanceInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const TIP_AMOUNT = '20';
  const TABLE_NAME = 'latestAttendanceXpTips';
  const MINIMUM_ATTENDEES = 6;

  if (!EXPLORER_URL) {
    discordLogger('Missing EXPLORER_URL env', client);
    return;
  }

  const senderId = interaction.user.id;
  const { endTime, lastSenderDiscordId, needsCooldown } =
    await checkUserNeedsCooldown(client, TABLE_NAME);

  if (needsCooldown) {
    const embed = new EmbedBuilder()
      .setTitle('Attendance XP Tipping Cooldown')
      .setDescription(
        `All members must wait ${
          endTime
            ? `until ${endTime} to tip attendance again.`
            : '24 hours between attendance tipping.'
        } `
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const channelId = interaction.channel?.id;

  const voiceChannel = interaction.guild?.channels.cache.get(
    channelId ?? ''
  ) as VoiceBasedChannel;
  const { members } = voiceChannel;
  const discordMembers = members.map(m => m);

  if (discordMembers.length < MINIMUM_ATTENDEES) {
    const embed = new EmbedBuilder()
      .setTitle('Not Enough Attendees')
      .setDescription(
        `There must be at least ${MINIMUM_ATTENDEES} attendees in the voice channel to tip attendance.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const [senderTagToEthAddressMap] = await getPlayerAddressesByDiscordHandles(
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
    await getPlayerAddressesByDiscordHandles(
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
      interaction,
      discordTagToEthAddressMap
    );
  if (!discordTagToCharacterAccountMap) return;
  const accountAddresses = Object.values(discordTagToCharacterAccountMap);
  if (!accountAddresses) return;

  const tx = await dropExp(client, interaction, accountAddresses, TIP_AMOUNT);
  if (!tx) return;

  const txHash = tx.hash;

  let embed = new EmbedBuilder()
    .setTitle('Attendance XP Tipping Tx Pending...')
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
      .setTitle('Attendance XP Tipping Tx Failed!')
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

  embed = new EmbedBuilder()
    .setTitle('Attendance XP Tipping Succeeded!')
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `**<@${senderId}>** tipped ${TIP_AMOUNT} XP to all characters in this voice channe:\n${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.\n---\nIf you did not receive a tip, you are either not a member of RaidGuild, not in DungeonMaster, or not in CharacterSheets.`
    )
    .setColor('#ff3864')
    .setTimestamp();

  const data = {
    lastSenderDiscordId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    txHash
  };

  await updateLatestXpTip(client, TABLE_NAME, data);

  await interaction.editReply({
    embeds: [embed]
  });
};
