import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { executeQueryInteraction } from '@/commands';
import {
  dropExp,
  getCharacterAccountsByPlayerAddresses,
  getPlayerAddressesByDiscordHandles
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
    .setTitle('XP tipping transaction pending...')
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
      .setTitle('XP tipping transaction failed!')
      .setURL(`${EXPLORER_URL}/tx/${txHash}`)
      .setDescription(
        `Transaction failed. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    await interaction.editReply({
      content: '',
      embeds: [embed]
    });
    return;
  }

  const senderId = interaction.user.id;

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
    .setTitle('XP tipping succeeded!')
    .setURL(`${EXPLORER_URL}/tx/${txHash}`)
    .setDescription(
      `**<@${senderId}>** tipped 5 XP to the characters of ${discordIdsSuccessfullyTipped.map(
        id => `<@${id}>`
      )}.${dmFailureMessage}${csFailureMessage}`
    )
    .setColor('#ff3864')
    .setTimestamp();

  await interaction.editReply({
    content: '',
    embeds: [embed]
  });
};
