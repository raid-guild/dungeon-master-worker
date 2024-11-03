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
import { completeJesterTip } from '@/interactions/cs/tipJester/completeJesterTip';
import {
  checkUserNeedsCooldown,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordTags,
  updateLatestXpMcTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import {
  ENVIRONMENT,
  JESTER_TABLE_NAME,
  JESTER_TIP_AMOUNT,
  TIP_PROPOSAL_REACTION_THRESHOLD
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

const MINIMUM_ATTENDEES = 6;
const PROPOSAL_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

export const tipJesterInteraction = async (
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
  const {
    endTime,
    lastSenderDiscordId,
    needsCooldown,
    proposalActive,
    proposalExpiration
  } = await checkUserNeedsCooldown(client, JESTER_TABLE_NAME, 'main');

  if (proposalActive) {
    const embed = new EmbedBuilder()
      .setTitle('<:jester:1222930129999626271> Jester Tip Proposal')
      .setDescription(
        `There is already a proposal to tip the Jester for this meeting. However, that proposal will expire at ${new Date(
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
      .setTitle('<:jester:1222930129999626271> Jester Tip Cooldown')
      .setDescription(
        `All members must wait ${
          endTime
            ? `until ${endTime} to tip the Jester again.`
            : '24 hours between Jester tipping.'
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
      .setDescription(`You must be in a voice channel to tip the Jester.`)
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
        `There must be at least ${MINIMUM_ATTENDEES} attendees in the voice channel to tip the Jester.`
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
      .setDescription(`You are only able to tip one recipient as Jester.`)
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
    meetingMcDiscordMembers as GuildMember[]
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

  const jesterTipData = {
    lastSenderDiscordId,
    newSenderDiscordId: senderId,
    senderDiscordTag: interaction.user.tag,
    gameAddress: getAddress(
      CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress
    ),
    chainId: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId,
    txHash: '',
    messageId: '',
    proposalExpiration: newProposalExpiration,
    receivingDiscordId: meetingMcDiscordMembers[0]?.id,
    receivingAddress: accountAddresses[0],
    tipPending: false
  };

  const isSyncSteward = senderId === process.env.DISCORD_SYNC_STEWARD_ID;

  if (isSyncSteward && interaction.channel) {
    await updateLatestXpMcTip(client, JESTER_TABLE_NAME, jesterTipData);
    await completeJesterTip(
      client,
      {
        ...jesterTipData,
        senderDiscordId: senderId
      },
      {
        interaction: interaction as ChatInputCommandInteraction
      }
    );
  } else {
    const embed = new EmbedBuilder()
      .setTitle('<:jester:1222930129999626271> Jester Tip Proposal')
      .setDescription(
        `<@${senderId}> is proposing to tip ${JESTER_TIP_AMOUNT} Jester XP to <@${
          meetingMcDiscordMembers[0]?.id
        }> for jestering this meeting.\n\nTo approve this tip, please react with an emoji. **${TIP_PROPOSAL_REACTION_THRESHOLD} emoji reactions from unique users are required for the tip to succeed**.\n\nThis proposal will expire at ${new Date(
          newProposalExpiration
        ).toLocaleString()}.`
      )
      .setColor('#ff3864')
      .setTimestamp();

    const message = await interaction.followUp({
      embeds: [embed]
    });
    await message.react('1222930129999626271');

    jesterTipData.messageId = message.id;

    await interaction.followUp({
      content: '@here ^^^'
    });
    await updateLatestXpMcTip(client, JESTER_TABLE_NAME, jesterTipData);
  }
};
