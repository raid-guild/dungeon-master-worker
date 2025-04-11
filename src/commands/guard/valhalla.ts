import axios from 'axios';
import {
  CacheType,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';

import { DISCORD_VALHALLA_CATEGORY_ID } from '@/utils/constants';
import { sendMessageWithFallback } from '@/utils/discord-utils';
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

      await sendMessageWithFallback(interaction, channel, embed);
      return;
    }

    // Initial response to user
    const embed = new EmbedBuilder()
      .setColor('#ff3864')
      .setDescription(
        'Starting export process for this channel. This may take a few minutes...'
      );

    await sendMessageWithFallback(interaction, channel, embed);

    // Call the Discord Exporter service to start the export
    try {
      const exporterUrl =
        process.env.DISCORD_EXPORTER_URL ||
        'https://discord-exporter-latest.onrender.com/export';

      const exportResponse = await axios.post(
        exporterUrl,
        {
          channelId: channel.id,
          guildId: interaction.guildId
        },
        { timeout: 10000 }
      ); // Add a 10-second timeout

      if (exportResponse.status !== 202) {
        throw new Error(
          `Export request failed with status: ${exportResponse.status}`
        );
      }

      const updateEmbed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription(
          'Export has been initiated. The channel will be moved to Valhalla once the export is complete.'
        );

      await sendMessageWithFallback(interaction, channel, updateEmbed);
    } catch (error) {
      console.error('Error initiating export:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor('#ff3864')
        .setDescription(
          'There was an error starting the export process. The channel has NOT been moved to Valhalla.'
        );

      await sendMessageWithFallback(interaction, channel, errorEmbed);

      discordLogger(
        `Error exporting channel ${channel.name}: ${error}`,
        interaction.client
      );
    }
  } catch (err) {
    console.error(err);
    discordLogger('Error caught in valhalla command.', interaction.client);

    // Try to notify the user if possible
    try {
      if (interaction.channel) {
        await (interaction.channel as TextChannel).send({
          embeds: [
            {
              title: 'Error',
              description:
                'An error occurred while processing the to-valhalla command.',
              color: 0xff3864
            }
          ]
        });
      }
    } catch (notifyError) {
      console.error('Failed to notify user of error:', notifyError);
    }
  }
};
