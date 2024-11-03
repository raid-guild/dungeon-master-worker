import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  VoiceBasedChannel
} from 'discord.js';
import { getAddress } from 'viem';

import { CHARACTER_SHEETS_CONFIG } from '@/config';
import {
  checkUserNeedsCooldown,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordTags,
  giveClassExp,
  updateLatestXpMcTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import { ENVIRONMENT } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const SCRIBE_TIP_AMOUNT = '50';
const TABLE_NAME = 'latestScribeTips';
const MINIMUM_ATTENDEES = 6;

export const tipScribeInteraction = async (
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
  const isSyncSteward = senderId === process.env.DISCORD_SYNC_STEWARD_ID;

  if (!isSyncSteward) {
    const embed = new EmbedBuilder()
      .setTitle('Unauthorized')
      .setDescription(`Only the Sync Steward is authorized to tip the Scribe.`)
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const {
    endTime,
    lastSenderDiscordId,
    needsCooldown,
    proposalActive,
    proposalExpiration
  } = await checkUserNeedsCooldown(client, TABLE_NAME);

  if (proposalActive) {
    const embed = new EmbedBuilder()
      .setTitle('<:scribe:757734310345310289> Scribe Tip Proposal')
      .setDescription(
        `There is already a proposal to tip the Scribe for this meeting. However, that proposal will expire at ${new Date(
          proposalExpiration ?? 0
        ).toLocaleString()}.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  if (needsCooldown) {
    const embed = new EmbedBuilder()
      .setTitle('<:scribe:757734310345310289> Scribe Tip Cooldown')
      .setDescription(
        `All members must wait ${
          endTime
            ? `until ${endTime} to tip the Scribe again.`
            : '24 hours between Scribe tips.'
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

  if (!voiceChannel.isVoiceBased()) {
    const embed = new EmbedBuilder()
      .setTitle('Not a Voice Channel')
      .setDescription(`You must be in a voice channel to tip the Scribe.`)
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const { members } = voiceChannel;
  const discordAttendeeMembers = members.map(m => m);

  if (discordAttendeeMembers.length < MINIMUM_ATTENDEES) {
    const embed = new EmbedBuilder()
      .setTitle('Not Enough Attendees')
      .setDescription(
        `There must be at least ${MINIMUM_ATTENDEES} attendees in the voice channel to tip the Scribe.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const recipients = (interaction.options.get('recipient')?.value ??
    '') as string;
  const recipientArray = recipients.split(' ');
  const recipientIdsWithDuplicates = recipientArray.map(r =>
    r.replace(/<@!?(\d+)>/, '$1')
  );
  const recipientIds = [...new Set(recipientIdsWithDuplicates)];

  if (recipientIds.length !== 1) {
    const embed = new EmbedBuilder()
      .setTitle('Invalid Recipient')
      .setDescription(`You are only able to tip one recipient as Scribe.`)
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const meetingScribeDiscordMembers = recipientIds.map(id =>
    interaction.guild?.members.cache.get(id)
  );

  const meetingScribeDiscordUsernames = meetingScribeDiscordMembers.map(
    m => m?.user.tag
  );

  if (
    meetingScribeDiscordMembers.some(m => !m) ||
    meetingScribeDiscordUsernames.some(m => !m)
  ) {
    await interaction.followUp({
      content: 'Discord handle was not formatted correctly!'
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
        `You are not a member of RaidGuild! If you think this is an error, ensure that your Discord handle and ETH address are registered correctly in DungeonMaster.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const [discordTagToEthAddressMap] = await getPlayerAddressesByDiscordTags(
    client,
    interaction,
    meetingScribeDiscordMembers as GuildMember[]
  );

  if (!discordTagToEthAddressMap?.main) return;
  const playerAddresses = Object.values(discordTagToEthAddressMap.main);
  if (!playerAddresses) return;

  const [discordTagToCharacterAccountMap] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      discordTagToEthAddressMap.main,
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress,
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.subgraphUrl,
      interaction
    );
  if (!discordTagToCharacterAccountMap) return;
  const accountAddresses = Object.values(discordTagToCharacterAccountMap);
  if (!accountAddresses) return;

  if (accountAddresses.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('No Characters Found')
      .setDescription(
        `No characters were found for the following user: <@${meetingScribeDiscordMembers[0]?.id}>.\n---\nIf you think this is an error, ensure that your Discord handle and ETH address are registered correctly in DungeonMaster.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const scribeTipData = {
    lastSenderDiscordId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    gameAddress: getAddress(
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress
    ),
    chainId: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId,
    txHash: '',
    messageId: '',
    receivingDiscordId: meetingScribeDiscordMembers[0]?.id,
    receivingAddress: accountAddresses[0],
    tipPending: false
  };

  if (!scribeTipData.receivingAddress)
    throw new Error('No receiving address found!');

  let embed = new EmbedBuilder()
    .setTitle('<:scribe:757734310345310289> Scribe Tip Pending...')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });

  scribeTipData.tipPending = true;
  await updateLatestXpMcTip(client, TABLE_NAME, scribeTipData);

  const tx = await giveClassExp(client, accountAddresses[0], '4');
  if (!tx) {
    scribeTipData.tipPending = false;
    await updateLatestXpMcTip(client, TABLE_NAME, scribeTipData);
    return;
  }

  const txHash = tx.hash;

  embed = new EmbedBuilder()
    .setTitle('<:scribe:757734310345310289> Scribe Tip Transaction Pending...')
    .setURL(
      `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
    )
    .setDescription(
      `Transaction is pending. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  const txReceipt = await tx.wait();

  if (!txReceipt.status) {
    scribeTipData.txHash = txHash;
    scribeTipData.tipPending = false;
    await updateLatestXpMcTip(client, TABLE_NAME, scribeTipData);

    embed = new EmbedBuilder()
      .setTitle('<:scribe:757734310345310289> Scribe Tip Transaction Failed!')
      .setURL(
        `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setDescription(
        `Transaction failed. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const viewGameMessage = `\n---\nView the game at https://play.raidguild.org`;

  embed = new EmbedBuilder()
    .setTitle('<:scribe:757734310345310289> Scribe Tip Succeeded!')
    .setURL(
      `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
    )
    .setDescription(
      `<@${scribeTipData.receivingDiscordId}>'s character received ${SCRIBE_TIP_AMOUNT} Scribe XP for documenting this meeting.${viewGameMessage}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  scribeTipData.txHash = txHash;
  scribeTipData.tipPending = false;

  await updateLatestXpMcTip(client, TABLE_NAME, scribeTipData);
  await interaction.editReply({ embeds: [embed] });
};
