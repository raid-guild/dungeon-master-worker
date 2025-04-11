import { CommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';

import { DiscordAPIError } from '@/types';

/**
 * Sends a message using interaction.followUp with fallback to regular channel message
 * if the interaction has expired.
 *
 * @param interaction The Discord command interaction
 * @param channel The text channel to use as fallback
 * @param embed The embed to send
 * @param ephemeral Whether the message should be ephemeral (only applies to interaction response)
 */
export async function sendMessageWithFallback(
  interaction: CommandInteraction,
  channel: TextChannel,
  embed: EmbedBuilder,
  ephemeral = false
): Promise<void> {
  try {
    await interaction.followUp({ embeds: [embed], ephemeral });
  } catch (error) {
    const discordError = error as DiscordAPIError;

    if (discordError && discordError.code === 10062) {
      // Interaction expired, try to send as a regular message
      await channel.send({ embeds: [embed] });
    } else {
      console.error('Error sending message:', error);
      throw error; // Re-throw for further handling
    }
  }
}
