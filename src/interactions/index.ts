import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { executeQueryInteraction } from '@/commands';
import {
  checkUserNeedsCooldown,
  dropExp,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordHandles,
  updateLatestXpTip
} from '@/lib';
import { ClientWithCommands } from '@/types';
import { EXPLORER_URL } from '@/utils/constants';
import { discordLogger, logError } from '@/utils/logger';

export const queryInteraction = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
) => {
  const prompt = interaction.options.get('prompt')?.value as string;

  if (!prompt) {
    await interaction.followUp({
      content: 'You must provide a prompt!'
    });
    return;
  }

  try {
    await executeQueryInteraction(interaction, prompt);
  } catch (error) {
    logError(
      client,
      interaction,
      error,
      `Original query: ${prompt}\n\nThere was an error while generating a response!`
    );
  }
};

export const tipXpInteraction = async (
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
  const recipientIds = recipientArray.map(r => r.replace(/<@!?(\d+)>/, '$1'));

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

  const tx = await dropExp(client, interaction, accountAddresses);
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
    m => !discordTagsWithoutCharacterAccounts?.includes(m?.user.tag as string)
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
      `**<@${senderId}>** tipped 5 XP to the characters of ${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.${dmFailureMessage}${csFailureMessage}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await updateLatestXpTip(client, senderId, interaction.user.tag, txHash);

  await interaction.editReply({
    embeds: [embed]
  });
};
