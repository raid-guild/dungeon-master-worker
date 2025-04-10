import { Request, Response } from 'express';
import { Client, PermissionFlagsBits, TextChannel, CategoryChannel, GuildChannel } from 'discord.js';
import { discordLogger } from '@/utils/logger';
import { DISCORD_VALHALLA_CATEGORY_ID } from '@/utils/constants';

interface ValhallaCallbackRequestBody {
  channelId: string;
  guildId: string;
  success: boolean;
  archiveUrl?: string;
}

// Define a type for sanitized error details
interface SanitizedErrorDetails {
  message: string;
  name: string;
  type: string;
  stack?: string;
}

// Helper function to safely sanitize errors
function sanitizeError(error: unknown): SanitizedErrorDetails {
  return {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Unknown',
    type: typeof error,
    stack: error instanceof Error ? error.stack : undefined
  };
}

// Function to generate a unique channel name in case of duplicates
const generateUniqueChannelName = (name: string, category: CategoryChannel) => {
  // Get all channels in the Valhalla category
  const valhallaChannels = category.children.cache;
  
  // Check if there's already a channel with this name
  if (!valhallaChannels.some((ch: GuildChannel) => ch.name === name)) {
    return name; // No duplicate, return original name
  }
  
  // Find a unique name by appending a number
  let counter = 1;
  let newName = `${name}-${counter}`;
  
  while (valhallaChannels.some((ch: GuildChannel) => ch.name === newName)) {
    counter++;
    newName = `${name}-${counter}`;
  }
  
  return newName;
};

export const valhallaCallbackController = async (
  req: Request,
  res: Response,
  client: Client
) => {
  try {
    const { channelId, guildId, success, archiveUrl } = req.body as ValhallaCallbackRequestBody;

    if (!channelId || !guildId) {
      return res.status(400).json({ error: 'Missing channelId or guildId in request body' });
    }

    // Log the callback
    discordLogger(`Received valhalla-callback for channel ${channelId}. Success: ${success}`, client);

    if (!success) {
      return res.status(200).json({ message: 'Received failed export notification' });
    }

    // Get the guild and channel
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      discordLogger(`Guild ${guildId} not found`, client);
      return res.status(404).json({ error: `Guild ${guildId} not found` });
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      discordLogger(`Channel ${channelId} not found`, client);
      return res.status(404).json({ error: `Channel ${channelId} not found` });
    }

    // Check permissions before attempting to move the channel
    if (!client.user) {
      discordLogger(`Client user is null`, client);
      return res.status(500).json({ error: 'Client user is null' });
    }

    const botMember = guild.members.cache.get(client.user.id);
    if (!botMember) {
      discordLogger(`Bot member not found in guild ${guild.name}`, client);
      return res.status(500).json({ error: 'Bot member not found in guild' });
    }

    const botPermissions = channel.permissionsFor(botMember);
    if (!botPermissions) {
      discordLogger(`Could not get permissions for bot in channel ${channel.name}`, client);
      return res.status(500).json({ error: 'Could not get permissions for bot in channel' });
    }
    
    const targetCategory = guild.channels.cache.get(DISCORD_VALHALLA_CATEGORY_ID) as CategoryChannel;
    
    // Log detailed permission and role hierarchy information
    const permissionDetails = {
      channel: {
        name: channel.name,
        id: channel.id,
        type: channel.type,
        parentId: channel.parentId
      },
      bot: {
        id: botMember.id,
        tag: botMember.user.tag,
        roles: botMember.roles.cache.map(r => ({ id: r.id, name: r.name, position: r.position })),
        highestRole: {
          id: botMember.roles.highest.id,
          name: botMember.roles.highest.name,
          position: botMember.roles.highest.position
        }
      },
      permissions: {
        administrator: botPermissions.has(PermissionFlagsBits.Administrator),
        manageChannels: botPermissions.has(PermissionFlagsBits.ManageChannels),
        manageGuild: botPermissions.has(PermissionFlagsBits.ManageGuild),
        viewChannel: botPermissions.has(PermissionFlagsBits.ViewChannel)
      },
      targetCategory: targetCategory ? {
        id: targetCategory.id,
        name: targetCategory.name,
        type: targetCategory.type
      } : null,
      targetCategoryId: DISCORD_VALHALLA_CATEGORY_ID
    };
    
    discordLogger(`Valhalla callback detailed permission check: ${JSON.stringify(permissionDetails, null, 2)}`, client);

    // Check if we can move the channel
    if (!botPermissions.has(PermissionFlagsBits.ManageChannels)) {
      discordLogger(`Bot lacks MANAGE_CHANNELS permission for channel ${channel.name}`, client);
      
      await channel.send({
        embeds: [{
          title: 'Channel Archived',
          description: `A backup of this channel has been created and can be accessed here: ${archiveUrl}\n\nThis channel could not be moved to Valhalla due to permission issues.`,
          color: 0xff3864,
          timestamp: new Date().toISOString()
        }]
      });
      
      return res.status(200).json({ 
        message: 'Archive URL sent, but channel not moved due to permission issues',
        archiveUrl
      });
    }

    if (!targetCategory) {
      discordLogger(`Valhalla category not found: ${DISCORD_VALHALLA_CATEGORY_ID}`, client);
      
      await channel.send({
        embeds: [{
          title: 'Channel Archived',
          description: `A backup of this channel has been created and can be accessed here: ${archiveUrl}\n\nThis channel could not be moved to Valhalla because the category was not found.`,
          color: 0xff3864,
          timestamp: new Date().toISOString()
        }]
      });
      
      return res.status(200).json({ 
        message: 'Archive URL sent, but channel not moved because Valhalla category not found',
        archiveUrl
      });
    }

    try {
      // Generate a unique name if needed
      const uniqueChannelName = generateUniqueChannelName(channel.name, targetCategory);
      const needsRename = uniqueChannelName !== channel.name;
      
      // Log the planned action
      discordLogger(`Attempting to move channel ${channel.name}${needsRename ? ` (will be renamed to ${uniqueChannelName})` : ''} to Valhalla category`, client);
      
      // First rename if necessary
      if (needsRename) {
        await channel.setName(uniqueChannelName);
        discordLogger(`Renamed channel from ${channel.name} to ${uniqueChannelName}`, client);
      }
      
      // Then move to Valhalla
      await channel.setParent(DISCORD_VALHALLA_CATEGORY_ID);
      
      discordLogger(`Successfully moved channel ${uniqueChannelName} to Valhalla category`, client);
      
      // Send a single message for successful archive and move
      await channel.send({
        embeds: [{
          title: 'Channel Moved to Valhalla',
          description: `This channel has been moved to Valhalla${needsRename ? ` and renamed to ${uniqueChannelName} to avoid naming conflicts` : ''}! A backup has been created and can be accessed here: ${archiveUrl}`,
          color: 0xff3864,
          timestamp: new Date().toISOString()
        }]
      });
      
      return res.status(200).json({ 
        message: 'Channel moved to Valhalla successfully',
        newChannelName: uniqueChannelName,
        renamed: needsRename,
        archiveUrl
      });
    } catch (moveError) {
      // Detailed error logging with sanitization
      const errorDetails = sanitizeError(moveError);
      
      discordLogger(`Detailed error moving channel to Valhalla: ${JSON.stringify(errorDetails, null, 2)}`, client);
      
      // Send a single message for archive but failed move
      await channel.send({
        embeds: [{
          title: 'Channel Archived',
          description: `A backup of this channel has been created and can be accessed here: ${archiveUrl}\n\nThis channel could not be moved to Valhalla due to an error: ${errorDetails.message}`,
          color: 0xff3864,
          timestamp: new Date().toISOString()
        }]
      });
      
      return res.status(200).json({ 
        message: 'Archive URL sent, but error occurred when moving channel',
        error: errorDetails,
        archiveUrl
      });
    }
  } catch (error) {
    const errorDetails = sanitizeError(error);
    
    console.error('Error in valhalla-callback:', errorDetails);
    discordLogger(`Error in valhalla-callback: ${JSON.stringify(errorDetails, null, 2)}`, client);
    return res.status(500).json({ error: 'Internal server error', details: errorDetails });
  }
};

export default valhallaCallbackController;