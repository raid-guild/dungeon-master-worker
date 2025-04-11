import bodyParser from 'body-parser';
import {
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageReaction,
  Partials,
  User
} from 'discord.js';
import express, { Request, Response } from 'express';

import {
  propsCommand,
  queryCommand,
  recordAttendanceCommand,
  syncInvoiceDataCommand,
  tipJesterCommand,
  tipScribeCommand
} from '@/commands';
import {
  toValhallaCommand,
  toValhallaExecute
} from '@/commands/guard/valhalla';
import valhallaCallbackHandler from '@/controllers/valhalla-callback';
import { setupGuardWorker } from '@/guardWorker';
import {
  completeJesterTip,
  propsInteraction,
  queryInteraction,
  recordAttendanceInteraction,
  syncInvoiceDataInteraction,
  tipJesterInteraction,
  tipScribeInteraction
} from '@/interactions';
import { getMcTipProposal } from '@/lib';
import { ClientWithCommands } from '@/types';
import {
  DISCORD_ALLOWED_PARENT_CHANNEL_IDS,
  DISCORD_DM_TOKEN,
  TIP_PROPOSAL_REACTION_THRESHOLD
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

// Set up Express server for callback endpoint
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

export const setupDungeonMasterWorker = () => {
  const client: ClientWithCommands = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction]
  });
  client.commands = new Collection();
  client.commands.set(propsCommand.name, propsCommand);
  client.commands.set(queryCommand.name, queryCommand);
  client.commands.set(recordAttendanceCommand.name, recordAttendanceCommand);
  client.commands.set(syncInvoiceDataCommand.name, syncInvoiceDataCommand);
  client.commands.set(tipJesterCommand.name, tipJesterCommand);
  client.commands.set(tipScribeCommand.name, tipScribeCommand);
  client.commands.set(toValhallaCommand.name, toValhallaCommand);

  // Set up the callback endpoint for export completion
  app.post('/valhalla-callback', (req: Request, res: Response) => {
    valhallaCallbackHandler(req, res, client);
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', botConnected: client.isReady() });
  });

  client.once(Events.ClientReady, c => {
    console.log(`Discord DM bot ready! Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = (interaction.client as ClientWithCommands).commands?.get(
      interaction.commandName
    ) as { name: string } | undefined;

    if (!command) {
      console.log(`Command ${interaction.commandName} not found`);
      return;
    }

    const channelId = interaction.channel?.id;
    const channel = interaction.guild?.channels.cache.get(channelId ?? '');
    const allowedAnywhereCommands = [
      propsCommand.name,
      recordAttendanceCommand.name,
      tipJesterCommand.name,
      tipScribeCommand.name,
      toValhallaCommand.name
    ];

    if (
      channel?.parentId &&
      !DISCORD_ALLOWED_PARENT_CHANNEL_IDS.includes(channel.parentId) &&
      !allowedAnywhereCommands.includes(command.name)
    ) {
      await interaction.reply({
        content: 'You cannot use DungeonMaster in this channel!',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    switch (command.name) {
      case queryCommand.name:
        await queryInteraction(client, interaction);
        break;
      case syncInvoiceDataCommand.name:
        await syncInvoiceDataInteraction(client, interaction);
        break;
      case propsCommand.name:
        await propsInteraction(client, interaction);
        break;
      case recordAttendanceCommand.name:
        await recordAttendanceInteraction(client, interaction);
        break;
      case tipJesterCommand.name:
        await tipJesterInteraction(client, interaction);
        break;
      case tipScribeCommand.name:
        await tipScribeInteraction(client, interaction);
        break;
      case toValhallaCommand.name: // Add this case
        await toValhallaExecute(interaction);
        break;
      default:
        await interaction.followUp({
          content: 'Command not found!'
        });
        break;
    }
  });

  client.on(Events.MessageReactionAdd, async reaction => {
    try {
      // If the reaction is partial, fetch the complete reaction
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          console.error('Error fetching reaction:', error);
          return;
        }
      }

      const message = await reaction.message.fetch();
      const reactions = message.reactions.cache;
      const reactionUsers = await Promise.all(
        reactions.map((r: MessageReaction) => r.users.fetch())
      );

      const getUserIdsFromCollection = (collection: Collection<string, User>) =>
        Array.from(collection.keys());
      const arrayOfUserIds = reactionUsers.map(getUserIdsFromCollection).flat();
      const uniqueUsersCount = new Set(arrayOfUserIds).size;

      const mcTipProposal = await getMcTipProposal(client);

      if (
        !mcTipProposal ||
        uniqueUsersCount < TIP_PROPOSAL_REACTION_THRESHOLD ||
        reaction.message.id !== mcTipProposal.messageId
      )
        return;

      // Make sure the mcTipProposal is not null
      if (mcTipProposal.txHash || mcTipProposal.tipPending) return;
      if (!mcTipProposal.receivingDiscordId)
        throw new Error('No receiving Discord ID found!');
      if (!mcTipProposal.receivingAddress)
        throw new Error('No receiving address found!');
      if (!mcTipProposal.proposalExpiration)
        throw new Error('No proposal expiration found!');

      if (Date.now() > mcTipProposal.proposalExpiration) {
        const embed = new EmbedBuilder()
          .setTitle(
            '<:jester:1222930129999626271> Jester Tipping Proposal Expired!'
          )
          .setDescription(
            `The Jester XP tipping proposal has expired. Please create a new proposal.`
          )
          .setColor('#ff3864')
          .setTimestamp();

        await reaction.message.channel.send({ embeds: [embed] });
        return;
      }

      await completeJesterTip(client, mcTipProposal, {
        reaction: reaction as MessageReaction
      });
    } catch (error) {
      discordLogger(error, client);
    }
  });

  client.login(DISCORD_DM_TOKEN);

  // Start the Express server after client setup
  app.listen(PORT, () => {
    console.log(`Callback server running on port ${PORT}`);
  });
};

setupDungeonMasterWorker();
setupGuardWorker();
