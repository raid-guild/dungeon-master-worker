import {
  CacheType,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';
import axios from 'axios';

import { DISCORD_VALHALLA_CATEGORY_ID } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const toValhallaCommand = new SlashCommandBuilder()
  .setName('to-valhalla')
  .setDescription('Exports channel history and sends a channel to Valhalla');

export const toValhallaExecute = async (
  interaction: CommandInteraction<CacheType>
) => {
  if (!interaction.channel) {
    console.error('Error: interaction channel not found');
    return;
  }
  try {
    const channel = interaction.channel as TextChannel;
    
    if (channel.parentId === DISCORD_VALHALLA_CATEGORY_ID) {
      const embed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription('This is already in Valhalla!');

      await interaction.followUp({ embeds: [embed] });
      return;
    }
    
    // Initial response to user
    const embed = new EmbedBuilder()
      .setColor('#ff3864')
      .setDescription('Starting export process for this channel. This may take a few minutes...');

    await interaction.followUp({ embeds: [embed] });
    
    // Call the Discord Exporter service to start the export
    try {
      const exportResponse = await axios.post(process.env.DISCORD_EXPORTER_URL || 'https://discord-exporter-latest.onrender.com/export', {
        channelId: channel.id,
        guildId: interaction.guildId
      });
      
      if (exportResponse.status !== 202) {
        throw new Error(`Export request failed with status: ${exportResponse.status}`);
      }
      
      const updateEmbed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription('Export has been initiated. The channel will be moved to Valhalla once the export is complete.');
      
      await interaction.followUp({ embeds: [updateEmbed] });
      
    } catch (error) {
      console.error('Error initiating export:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription('There was an error starting the export process. The channel has NOT been moved to Valhalla.');
      
      await interaction.followUp({ embeds: [errorEmbed] });
      discordLogger(`Error exporting channel ${channel.name}: ${error}`, interaction.client);
    }
  } catch (err) {
    console.error(err);
    discordLogger('Error caught in valhalla command.', interaction.client);
  }
};