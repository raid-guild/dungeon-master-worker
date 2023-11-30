import {
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  User
} from 'discord.js';

import {
  queryCommand,
  tipXpAttendanceCommand,
  tipXpCommand,
  tipXpMcCommand
} from '@/commands';
import { setupGuardWorker } from '@/guardWorker';
import {
  queryInteraction,
  tipXpAttendanceInteraction,
  tipXpInteraction,
  tipXpMcInteraction
} from '@/interactions';
import { MC_XP_TIP_AMOUNT } from '@/interactions/cs/tipXpMc';
import { dropExp, getMcTipProposal, updateLatestXpMcTip } from '@/lib';
import { McTipData } from '@/lib/dbHelpers';
import { ClientWithCommands } from '@/types';
import {
  DISCORD_ALLOWED_PARENT_CHANNEL_IDS,
  DISCORD_DM_TOKEN,
  EXPLORER_URL,
  RAIDGUILD_GAME_ADDRESS,
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
  client.commands.set(queryCommand.name, queryCommand);
  client.commands.set(tipXpCommand.name, tipXpCommand);
  client.commands.set(tipXpAttendanceCommand.name, tipXpAttendanceCommand);
  client.commands.set(tipXpMcCommand.name, tipXpMcCommand);

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
      tipXpCommand.name,
      tipXpAttendanceCommand.name,
      tipXpMcCommand.name
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
      case tipXpCommand.name:
        await tipXpInteraction(client, interaction);
        break;
      case tipXpAttendanceCommand.name:
        await tipXpAttendanceInteraction(client, interaction);
        break;
      case tipXpMcCommand.name:
        await tipXpMcInteraction(client, interaction);
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
          .setTitle('MC XP Tipping Proposal Expired!')
          .setDescription(
            `The XP tipping proposal has expired. Please create a new proposal.`
          )
          .setColor('#ff3864')
          .setTimestamp();

        await reaction.message.channel.send({ embeds: [embed] });
        return;
      }

      let embed = new EmbedBuilder()
        .setTitle('MC XP Tipping Pending...')
        .setColor('#ff3864')
        .setTimestamp();

      const txMessage = await reaction.message.channel.send({
        embeds: [embed]
      });

      let data: Omit<
        McTipData,
        'senderDiscordId' | 'gameAddress' | 'timestamp'
      > & {
        lastSenderDiscordId: string;
        newSenderDiscordId: string;
      } = {
        lastSenderDiscordId: mcTipProposal.senderDiscordId,
        newSenderDiscordId: mcTipProposal.senderDiscordId,
        txHash: '',
        tipPending: true
      };
      await updateLatestXpMcTip(client, 'latestXpMcTips', data);

      const tx = await dropExp(client, [receivingAddress], MC_XP_TIP_AMOUNT);
      if (!tx) {
        data = {
          lastSenderDiscordId: mcTipProposal.senderDiscordId,
          newSenderDiscordId: mcTipProposal.senderDiscordId,
          txHash: '',
          tipPending: false
        };
        await updateLatestXpMcTip(client, 'latestXpMcTips', data);
        return;
      }

      const txHash = tx.hash;

      embed = new EmbedBuilder()
        .setTitle('MC XP Tipping Transaction Pending...')
        .setURL(`${EXPLORER_URL}/tx/${txHash}`)
        .setDescription(
          `Transaction is pending. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
        )
        .setColor('#ff3864')
        .setTimestamp();
      await txMessage.edit({ embeds: [embed] });

      const txReceipt = await tx.wait();

      if (!txReceipt.status) {
        data = {
          lastSenderDiscordId: mcTipProposal.senderDiscordId,
          newSenderDiscordId: mcTipProposal.senderDiscordId,
          txHash,
          tipPending: false
        };
        await updateLatestXpMcTip(client, 'latestXpMcTips', data);

        embed = new EmbedBuilder()
          .setTitle('MC XP Tipping Transaction Failed!')
          .setURL(`${EXPLORER_URL}/tx/${txHash}`)
          .setDescription(
            `Transaction failed. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
          )
          .setColor('#ff3864')
          .setTimestamp();

        await txMessage.edit({ embeds: [embed] });
        return;
      }

      const viewGameMessage = `\n---\nView the game at https://play.raidguild.org/games/gnosis/${RAIDGUILD_GAME_ADDRESS}`;

      embed = new EmbedBuilder()
        .setTitle('MC XP Tipping Succeeded!')
        .setURL(`${EXPLORER_URL}/tx/${txHash}`)
        .setDescription(
          `<@${receivingDiscordId}>'s character received ${MC_XP_TIP_AMOUNT} XP for MC'ing this meeting.${viewGameMessage}`
        )
        .setColor('#ff3864')
        .setTimestamp();

      data = {
        lastSenderDiscordId: mcTipProposal.senderDiscordId,
        newSenderDiscordId: mcTipProposal.senderDiscordId,
        txHash,
        tipPending: false
      };

      await updateLatestXpMcTip(client, 'latestXpMcTips', data);
      await txMessage.edit({ embeds: [embed] });
    } catch (error) {
      discordLogger(error, client);
    }
  });

  client.login(DISCORD_DM_TOKEN);
};

setupDungeonMasterWorker();
setupGuardWorker();
