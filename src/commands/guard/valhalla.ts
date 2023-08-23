import {
  CacheType,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';

import { DISCORD_VALHALLA_CATEGORY_ID } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const toValhallaCommand = new SlashCommandBuilder()
  .setName('to-valhalla')
  .setDescription('Sends a channel to Valhalla');

export const toValhallaExecute = async (
  interaction: CommandInteraction<CacheType>
) => {
  if (!interaction.channel) {
    console.error('Error: interaction channel not found');
    return;
  }
  try {
    if (
      (interaction.channel as TextChannel).parentId ===
      DISCORD_VALHALLA_CATEGORY_ID
    ) {
      const embed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription('This is already in Valhalla!');

      await interaction.followUp({ embeds: [embed] });
    } else {
      (interaction.channel as TextChannel).setParent(
        DISCORD_VALHALLA_CATEGORY_ID
      );

      const embed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription('Command executed');

      await interaction.followUp({ embeds: [embed] });
    }
  } catch (err) {
    console.error(err);
    discordLogger('Error caught in valhalla command.', interaction.client);
  }
};
