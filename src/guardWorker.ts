import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
  TextChannel
} from 'discord.js';

import {
  createCampChannelCommand,
  createRaidChannelCommand,
  editCampChannelCommand,
  editRaidChannelCommand,
  executeInteraction,
  roleStatsCommand,
  toValhallaCommand
} from '@/commands';
import { lurkerGuard } from '@/features/lurkerGuard';
import { roleClaim } from '@/features/roleClaim';
import { ClientWithCommands } from '@/types';
import {
  DISCORD_ALLOW_BOTS,
  DISCORD_GUARD_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_NEWCOMERS_CHANNEL_ID,
  DISCORD_UNLOCK_CHANNELS_ID
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';
import { DiscordAPIError } from 'discord.js';

export const setupGuardWorker = () => {
  const client: ClientWithCommands = new Client({
    partials: [Partials.Message, Partials.Reaction, Partials.Channel],
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildInvites
    ]
  });

  client.commands = new Collection();
  client.commands.set(toValhallaCommand.name, toValhallaCommand);
  client.commands.set(createRaidChannelCommand.name, createRaidChannelCommand);
  client.commands.set(createCampChannelCommand.name, createCampChannelCommand);
  client.commands.set(editRaidChannelCommand.name, editRaidChannelCommand);
  client.commands.set(editCampChannelCommand.name, editCampChannelCommand);
  client.commands.set(roleStatsCommand.name, roleStatsCommand);

  client.on(Events.ClientReady, () => {
    if (!client.user) return;
    console.log(`RaidGuild Guard logged in as ${client.user.tag}`);

    roleClaim(client);

    const guild = client.guilds.resolve(DISCORD_GUILD_ID);
    if (!guild) return;

    lurkerGuard(client, guild);
  });

  client.on(Events.GuildMemberAdd, member => {
    try {
      const newComersChannel = member.guild.channels.cache.get(
        DISCORD_NEWCOMERS_CHANNEL_ID
      ) as TextChannel | undefined;
      if (!newComersChannel) return;

      if (member.user.bot && DISCORD_ALLOW_BOTS === 'false') {
        discordLogger(`Kicked unauthorized bot, <@${member.id}>`, client);
        member.kick();
        return;
      }

      if (member.user.bot && DISCORD_ALLOW_BOTS === 'true') {
        discordLogger(`Bot <@${member.id}> has entered the tavern`, client);
        return;
      }

      newComersChannel.send({
        content: `Welcome, <@${member.id}>! Please verify yourself at <#${DISCORD_UNLOCK_CHANNELS_ID}> if you don't have access to our public channels.`
      });
    } catch (err) {
      console.log(err);
      discordLogger('Error caught in entry check.', client);
    }
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = (interaction.client as ClientWithCommands).commands?.get(
      interaction.commandName
    );

    if (!command) {
      console.log(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      await interaction.deferReply();
      await executeInteraction(interaction);
    } catch (error) {
      // Handle Discord API errors gracefully
      const discordError = error as DiscordAPIError; // Type assertion for the error
      
      if (discordError && discordError.code === 10062) {
        console.log(`Interaction expired for command: ${interaction.commandName}`);
        
        // If possible, try to send a message to the channel instead
        try {
          if (interaction.channel) {
            await interaction.channel.send({
              embeds: [{
                title: 'Command Timeout',
                description: 'Sorry, I couldn\'t respond to your command in time. Please try again.',
                color: 0xff3864
              }]
            });
          }
        } catch (followUpError) {
          console.error('Failed to send fallback message:', followUpError);
        }
      } else {
        // Log the error but don't crash
        console.error(`Error handling interaction for command ${interaction.commandName}:`, error);
        discordLogger(`Error in command execution: ${interaction.commandName}`, interaction.client);
      }
    }
  });

  client.login(DISCORD_GUARD_TOKEN);
};