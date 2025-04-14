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
 * @returns A Promise that resolves when the message is sent
 */
export async function sendMessageWithFallback(
  interaction: CommandInteraction,
  channel: TextChannel,
  embed: EmbedBuilder,
  ephemeral: boolean = false
): Promise<void> {
  try {
    await interaction.followUp({ embeds: [embed], ephemeral });
  } catch (error) {
    const discordError = error as DiscordAPIError;
    
    // Check for interaction expiration error (10062)
    if (discordError && discordError.code === 10062) {
      // Interaction expired, try to send as a regular message
      await channel.send({ embeds: [embed] });
    } else {
      // Log other errors but don't throw to prevent cascading failures
      console.error('Error sending message:', error);
      
      // Try to send the message directly to the channel as a last resort
      try {
        await channel.send({ embeds: [embed] });
      } catch (channelError) {
        console.error('Failed to send fallback message to channel:', channelError);
      }
    }
  }
}

/**
 * Creates a standard error embed with consistent styling
 * 
 * @param title The error title
 * @param description The error description
 * @returns An EmbedBuilder with the error styling
 */
export function createErrorEmbed(
  title: string,
  description: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#ff3864')
    .setTimestamp();
}

/**
 * Handles common Discord API errors with appropriate fallbacks
 * 
 * @param error The error to handle
 * @param interaction The interaction that caused the error
 * @param errorMessage A custom error message to display
 */
export async function handleDiscordError(
  error: unknown,
  interaction: CommandInteraction,
  errorMessage: string = 'An error occurred while processing your command.'
): Promise<void> {
  const discordError = error as DiscordAPIError;
  
  if (discordError && discordError.code === 10062) {
    // Interaction expired
    console.log(`Interaction expired for command: ${interaction.commandName}`);
    
    if (interaction.channel && interaction.channel instanceof TextChannel) {
      const timeoutEmbed = createErrorEmbed(
        'Command Timeout',
        'Sorry, I couldn\'t respond to your command in time. Please try again.'
      );
      
      await interaction.channel.send({ embeds: [timeoutEmbed] });
    }
  } else {
    // Other errors
    console.error(`Error in command ${interaction.commandName}:`, error);
    
    if (interaction.channel && interaction.channel instanceof TextChannel) {
      const errorEmbed = createErrorEmbed('Error', errorMessage);
      
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        } catch (replyError) {
          await interaction.channel.send({ embeds: [errorEmbed] });
        }
      } else {
        try {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } catch (followUpError) {
          await interaction.channel.send({ embeds: [errorEmbed] });
        }
      }
    }
  }
}