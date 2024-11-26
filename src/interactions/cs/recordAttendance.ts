import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  VoiceBasedChannel
} from 'discord.js';
import { Address, getAddress } from 'viem';

import { CHARACTER_SHEETS_CONFIG } from '@/config';
import {
  checkUserNeedsCooldown,
  dropAttendanceBadges,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordTags,
  updateLatestXpTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import { ENVIRONMENT } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const recordAttendanceInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  let embed = new EmbedBuilder();

  const TABLE_NAME = 'latestAttendanceRecord';
  const MINIMUM_ATTENDEES = 6;

  if (!CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl) {
    discordLogger('Missing explorerUrl config variable', client);
    return;
  }

  const channelId = interaction.channel?.id;
  if (!channelId) return;

  const voiceChannel = interaction.guild?.channels.cache.get(
    channelId
  ) as VoiceBasedChannel;
  if (!voiceChannel.isVoiceBased()) {
    embed = new EmbedBuilder()
      .setTitle('Not a Voice Channel')
      .setDescription(`You must be in a voice channel to record attendance.`)
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const senderId = interaction.user.id;
  let {
    channelId: lastChannelId,
    endTime,
    lastSenderDiscordId,
    needsCooldown
  } = await checkUserNeedsCooldown(client, TABLE_NAME, 'main');

  if (!needsCooldown) {
    const {
      channelId: lastCohortChannelId,
      endTime: cohortEndTime,
      lastSenderDiscordId: lastCohortSenderDiscordId,
      needsCooldown: cohortNeedsCooldown
    } = await checkUserNeedsCooldown(client, TABLE_NAME, 'cohort7');

    if (cohortNeedsCooldown) {
      needsCooldown = cohortNeedsCooldown;
      endTime = cohortEndTime;
      lastChannelId = lastCohortChannelId;
      lastSenderDiscordId = lastCohortSenderDiscordId;
    }
  }

  if (needsCooldown && lastChannelId === channelId) {
    embed = new EmbedBuilder()
      .setTitle('Attendance Recording Cooldown')
      .setDescription(
        `All members must wait ${
          endTime
            ? `until ${endTime} to record attendance again.`
            : '24 hours between attendance recording.'
        } `
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const { members } = voiceChannel;
  const discordMembers = members.map(m => m);

  if (discordMembers.length < MINIMUM_ATTENDEES) {
    embed = new EmbedBuilder()
      .setTitle('Not Enough Attendees')
      .setDescription(
        `There must be at least ${MINIMUM_ATTENDEES} attendees in the voice channel to record attendance.`
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

  if (
    !discordTagToEthAddressMap?.main ||
    !discordTagToEthAddressMap.main[interaction.user.tag]
  ) {
    embed = new EmbedBuilder()
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

  if (!discordTagToEthAddressMap.main) return;
  const playerAddresses = Object.values(discordTagToEthAddressMap.main);
  if (!playerAddresses) return;

  const [
    discordTagToMainCharacterAccountMap,
    discordTagsWithoutMainCharacterAccounts
  ] = await getCharacterAccountsByPlayerAddresses(
    client,
    discordTagToEthAddressMap.main,
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress,
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.subgraphUrl,
    interaction
  );

  const [
    discordTagToCohortCharacterAccountMap,
    discordTagsWithoutCohortCharacterAccounts
  ] = await getCharacterAccountsByPlayerAddresses(
    client,
    discordTagToEthAddressMap.cohort7,
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].cohort7.gameAddress,
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].cohort7.subgraphUrl,
    interaction
  );

  if (
    !(
      discordTagToMainCharacterAccountMap &&
      discordTagToCohortCharacterAccountMap
    )
  )
    return;
  const mainAccountAddresses = Object.values(
    discordTagToMainCharacterAccountMap
  );
  const cohortAccountAddresses = Object.values(
    discordTagToCohortCharacterAccountMap
  );

  if ([...mainAccountAddresses, ...cohortAccountAddresses].length === 0) {
    embed = new EmbedBuilder()
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

  embed = new EmbedBuilder()
    .setTitle('Recording Attendance...')
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });

  let mainTx = null;

  if (mainAccountAddresses.length > 0) {
    mainTx = await dropAttendanceBadges(
      client,
      'main',
      mainAccountAddresses as Address[]
    );
  }

  let url = '';
  let description = '';

  if (mainTx) {
    url = `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${mainTx.hash}`;
    description = `Transaction is pending.\n\nView the main game transaction here: ${url}`;
  }

  embed = new EmbedBuilder()
    .setTitle('Attendance Recording Tx Pending...')
    .setURL(url)
    .setDescription(description)
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed]
  });

  if (mainTx) {
    const txReceipt = await mainTx.wait();

    if (!txReceipt.status) {
      embed = new EmbedBuilder()
        .setTitle('Main Attendance Recording Tx Failed!')
        .setURL(
          `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${mainTx.hash}`
        )
        .setDescription(
          `Transaction failed. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${mainTx.hash}`
        )
        .setColor('#ff3864')
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });
      return;
    }
  }

  if (!mainTx) return;

  const viewGameMessage = `\n---\nView the game at https://play.raidguild.org (click "All Games" to find cohort games)`;

  const discordMembersSuccessfullyTipped = discordMembers.filter(
    m =>
      !discordTagsWithoutMainCharacterAccounts?.includes(
        m?.user.tag as string
      ) &&
      !discordTagsWithoutEthAddress?.main.includes(m?.user.tag as string) &&
      !discordTagsWithoutCohortCharacterAccounts?.includes(
        m?.user.tag as string
      ) &&
      !discordTagsWithoutEthAddress?.cohort7.includes(m?.user.tag as string)
  );
  const discordIdsSuccessfullyTipped = discordMembersSuccessfullyTipped.map(
    m => m?.user.id
  );

  embed = new EmbedBuilder()
    .setTitle('Attendance Recording Succeeded!')
    .setURL(
      `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${mainTx?.hash}`
    )
    .setDescription(
      `**<@${senderId}>** gave an attendance badge to all characters in this voice channel:\n${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.${viewGameMessage}\n---\nIf you did not receive a badge, you are either not a member of RaidGuild, not in DungeonMaster, or not in CharacterSheets.`
    )
    .setColor('#ff3864')
    .setTimestamp();

  if (mainTx) {
    const gameAddress = getAddress(
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress
    );

    const data = {
      channelId,
      lastSenderDiscordId,
      newSenderDiscordId: senderId,
      senderDiscordTag: interaction.user.tag,
      gameAddress,
      chainId: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId,
      txHash: mainTx.hash,
      message: ''
    };

    await updateLatestXpTip(client, TABLE_NAME, 'main', data);
  }

  await interaction.editReply({
    embeds: [embed]
  });
};
