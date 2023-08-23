import {
  CacheType,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';

import { DISCORD_RAIDS_CATEGORY_ID } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const editRaidChannelCommand = new SlashCommandBuilder()
  .setName('edit-raid-channel')
  .setDescription('Adds new member to a raid channel')
  .addChannelOption(option =>
    option
      .setName('raid-channel')
      .setDescription('The name of the raid channel to update')
      .setRequired(true)
  )
  .addUserOption(option =>
    option
      .setName('non-member')
      .setDescription(
        'Anyone who is not a member and needs access to the channel'
      )
      .setRequired(true)
  );

export const editRaidChannelExecute = async (
  interaction: CommandInteraction<CacheType>
) => {
  try {
    const channelId = interaction.options.get('raid-channel')?.value as string;
    const nonMember = interaction.options.getUser('non-member');

    const channel = interaction.guild?.channels.cache.get(
      channelId
    ) as TextChannel;

    if (!channel) {
      const embed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription(`Channel ${channelId} not found.`);
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      return;
    }

    if (!nonMember) {
      const embed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription(`User ${nonMember} not found.`);
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      return;
    }

    if (channel.parentId !== DISCORD_RAIDS_CATEGORY_ID) {
      const embed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription(`Mentioned channel, ${channel} is not a raid channel.`);
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      return;
    }

    channel.permissionOverwrites.create(nonMember.id, {
      SendMessages: true,
      ViewChannel: true
    });

    const embed = new EmbedBuilder()
      .setColor('#ff3864')
      .setDescription(`Added ${nonMember} to ${channel}.`);
    await interaction.followUp({ embeds: [embed], ephemeral: true });
    discordLogger(
      `${interaction.user} added ${nonMember} to ${channel}.`,
      interaction.client
    );
  } catch (err) {
    console.error(err);
    discordLogger('Error caught in edit raid channel.', interaction.client);
  }
};
