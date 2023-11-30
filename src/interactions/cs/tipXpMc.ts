import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  VoiceBasedChannel
} from 'discord.js';
import { getAddress } from 'viem';

import {
  checkUserNeedsCooldown,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordHandles,
  updateLatestXpMcTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import {
  EXPLORER_URL,
  RAIDGUILD_GAME_ADDRESS,
  TIP_PROPOSAL_REACTION_THRESHOLD
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const MC_XP_TIP_AMOUNT = '50';

export const tipXpMcInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const TABLE_NAME = 'latestXpMcTips';

  const MINIMUM_ATTENDEES = 6;
  const PROPOSAL_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

  if (!EXPLORER_URL) {
    discordLogger('Missing EXPLORER_URL env', client);
    return;
  }

  const senderId = interaction.user.id;
  const {
    endTime,
    lastSenderDiscordId,
    needsCooldown,
    proposalActive,
    proposalExpiration
  } = await checkUserNeedsCooldown(client, TABLE_NAME);

  if (proposalActive) {
    const embed = new EmbedBuilder()
      .setTitle('Meeting MC XP Tip Proposal')
      .setDescription(
        `There is already a proposal to tip the MC for this meeting. However, that proposal will expire at ${new Date(
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
      .setTitle('Meeting MC XP Tipping Cooldown')
      .setDescription(
        `All members must wait ${
          endTime
            ? `until ${endTime} to tip meeting MC again.`
            : '24 hours between meeting MC tipping.'
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
  const discordAttendeeMembers = members.map(m => m);

  if (discordAttendeeMembers.length < MINIMUM_ATTENDEES) {
    const embed = new EmbedBuilder()
      .setTitle('Not Enough Attendees')
      .setDescription(
        `There must be at least ${MINIMUM_ATTENDEES} attendees in the voice channel to tip meeting MC.`
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
      .setDescription(`You are only able to tip one recipient as meeting MC.`)
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const meetingMcDiscordMembers = recipientIds.map(id =>
    interaction.guild?.members.cache.get(id)
  );

  const meetingMcDiscordUsernames = meetingMcDiscordMembers.map(
    m => m?.user.tag
  );

  if (
    meetingMcDiscordMembers.some(m => !m) ||
    meetingMcDiscordUsernames.some(m => !m)
  ) {
    await interaction.followUp({
      content: 'Discord handle was not formatted correctly!'
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
        `You are not a member of RaidGuild! If you think this is an error, ensure that your Discord handle and ETH address are registered correctly in DungeonMaster.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const [discordTagToEthAddressMap] = await getPlayerAddressesByDiscordHandles(
    client,
    interaction,
    meetingMcDiscordMembers as GuildMember[]
  );

  if (!discordTagToEthAddressMap) return;
  const playerAddresses = Object.values(discordTagToEthAddressMap);
  if (!playerAddresses) return;

  const [discordTagToCharacterAccountMap] =
    await getCharacterAccountsByPlayerAddresses(
      client,
      interaction,
      discordTagToEthAddressMap
    );
  if (!discordTagToCharacterAccountMap) return;
  const accountAddresses = Object.values(discordTagToCharacterAccountMap);
  if (!accountAddresses) return;

  if (accountAddresses.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('No Characters Found')
      .setDescription(
        `No characters were found for the following user: <@${meetingMcDiscordMembers[0]?.id}>.\n---\nIf you think this is an error, ensure that your Discord handle and ETH address are registered correctly in DungeonMaster.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed]
    });
    return;
  }

  const newProposalExpiration = Date.now() + PROPOSAL_EXPIRATION_TIME;
  const embed = new EmbedBuilder()
    .setTitle('Meeting MC XP Tip Proposal')
    .setDescription(
      `<@${senderId}> is proposing to tip ${MC_XP_TIP_AMOUNT} XP to <@${
        meetingMcDiscordMembers[0]?.id
      }> for MC'ing this meeting.\n\nTo approve this tip, please react with an emoji. **${TIP_PROPOSAL_REACTION_THRESHOLD} emoji reactions are required for the tip to succeed**.\n\nThis proposal will expire at ${new Date(
        newProposalExpiration
      ).toLocaleString()}.`
    )
    .setColor('#ff3864')
    .setTimestamp();

  const message = await interaction.followUp({
    embeds: [embed]
  });

  const gameAddress = getAddress(RAIDGUILD_GAME_ADDRESS);

  const data = {
    lastSenderDiscordId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    gameAddress,
    chainId: '5',
    txHash: '',
    messageId: message.id,
    proposalExpiration: newProposalExpiration,
    receivingDiscordId: meetingMcDiscordMembers[0]?.id,
    receivingAddress: accountAddresses[0],
    tipPending: false
  };

  await updateLatestXpMcTip(client, TABLE_NAME, data);
};
