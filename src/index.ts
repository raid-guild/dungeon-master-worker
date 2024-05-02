import {
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  User,
  TextChannel
} from 'discord.js';

import {
  propsCommand,
  queryCommand,
  syncInvoiceDataCommand,
  tipJesterCommand,
  tipXpAttendanceCommand
} from '@/commands';
import { setupGuardWorker } from '@/guardWorker';
import {
  propsInteraction,
  queryInteraction,
  syncInvoiceDataInteraction,
  tipXpAttendanceInteraction,
  tipJesterInteraction
} from '@/interactions';
import { completeJesterTip } from '@/interactions';
import { getMcTipProposal } from '@/lib';
import { ClientWithCommands } from '@/types';
import {
  DISCORD_ALLOWED_PARENT_CHANNEL_IDS,
  DISCORD_DM_TOKEN,
  TIP_PROPOSAL_REACTION_THRESHOLD
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

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
  client.commands.set(syncInvoiceDataCommand.name, syncInvoiceDataCommand);
  client.commands.set(tipJesterCommand.name, tipJesterCommand);
  client.commands.set(tipXpAttendanceCommand.name, tipXpAttendanceCommand);

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
      tipJesterCommand.name,
      tipXpAttendanceCommand.name
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
      case tipJesterCommand.name:
        await tipJesterInteraction(client, interaction);
        break;
      case tipXpAttendanceCommand.name:
        await tipXpAttendanceInteraction(client, interaction);
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
      const message = await reaction.message.fetch();
      const reactions = message.reactions.cache;
      const reactionUsers = await Promise.all(
        reactions.map(r => r.users.fetch())
      );
      const getUserIdsFromCollection = (collection: Collection<string, User>) =>
        Array.from(collection.keys());
      const arrayOfUserIds = reactionUsers.map(getUserIdsFromCollection).flat();
      const uniqueUsersCount = new Set(arrayOfUserIds).size;

      const mcTipProposal = await getMcTipProposal(client);

      if (
        uniqueUsersCount < TIP_PROPOSAL_REACTION_THRESHOLD ||
        reaction.message.id !== mcTipProposal?.messageId
      )
        return;

      const {
        receivingDiscordId,
        receivingAddress,
        txHash: alreadyExistingTxHash,
        proposalExpiration,
        tipPending
      } = mcTipProposal;

      if (alreadyExistingTxHash || tipPending) return;
      if (!receivingDiscordId)
        throw new Error('No receiving Discord ID found!');
      if (!receivingAddress) throw new Error('No receiving address found!');
      if (!proposalExpiration) throw new Error('No proposal expiration found!');

      if (Date.now() > proposalExpiration) {
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

      await completeJesterTip(
        client,
        mcTipProposal,
        reaction.message.channel as TextChannel
      );
    } catch (error) {
      discordLogger(error, client);
    }
  });

  client.login(DISCORD_DM_TOKEN);
};

setupDungeonMasterWorker();
setupGuardWorker();
