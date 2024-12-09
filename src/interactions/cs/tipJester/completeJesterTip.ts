import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageReaction
} from 'discord.js';
import { createPublicClient, http } from 'viem';

import { CHAINS, CHARACTER_SHEETS_CONFIG } from '@/config';
import { giveClassExp, updateLatestXpMcTip } from '@/lib';
import { JesterTipData } from '@/lib/dbHelpers';
import { ClientWithCommands } from '@/types';
import {
  ENVIRONMENT,
  JESTER_TABLE_NAME,
  JESTER_TIP_AMOUNT
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const completeJesterTip = async (
  client: ClientWithCommands,
  jesterTipProposal: Omit<JesterTipData, 'timestamp'>,
  {
    interaction,
    reaction
  }: {
    interaction?: ChatInputCommandInteraction;
    reaction?: MessageReaction;
  }
) => {
  try {
    const { receivingAddress, receivingDiscordId, senderDiscordId } =
      jesterTipProposal;

    if (!receivingAddress) throw new Error('No receiving address found!');

    let embed = new EmbedBuilder()
      .setTitle('<:jester:1222930129999626271> Jester Tip Pending...')
      .setColor('#ff3864')
      .setTimestamp();

    let proposalMessage = null;
    if (interaction) {
      await interaction.followUp({ embeds: [embed] });
    } else if (reaction) {
      proposalMessage = await reaction.message.channel.send({
        embeds: [embed]
      });
    }

    let data: Omit<
      JesterTipData,
      'senderDiscordId' | 'gameAddress' | 'timestamp'
    > & {
      lastSenderDiscordId: string;
      newSenderDiscordId: string;
    } = {
      lastSenderDiscordId: senderDiscordId,
      newSenderDiscordId: senderDiscordId,
      txHash: '',
      tipPending: true
    };
    await updateLatestXpMcTip(client, JESTER_TABLE_NAME, data);

    const txHash = await giveClassExp(client, receivingAddress, '14');
    if (!txHash) {
      data = {
        lastSenderDiscordId: senderDiscordId,
        newSenderDiscordId: senderDiscordId,
        txHash: '',
        tipPending: false
      };
      await updateLatestXpMcTip(client, JESTER_TABLE_NAME, data);
      return;
    }

    embed = new EmbedBuilder()
      .setTitle(
        '<:jester:1222930129999626271> Jester Tip Transaction Pending...'
      )
      .setURL(
        `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setDescription(
        `Transaction is pending. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    if (proposalMessage) {
      await proposalMessage.edit({ embeds: [embed] });
    } else if (interaction) {
      await interaction.editReply({ embeds: [embed] });
    }

    const publicClient = createPublicClient({
      chain: CHAINS[CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId],
      transport: http()
    });

    const txReceipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 120000
    });

    if (!txReceipt.status) {
      data = {
        lastSenderDiscordId: senderDiscordId,
        newSenderDiscordId: senderDiscordId,
        txHash,
        tipPending: false
      };
      await updateLatestXpMcTip(client, JESTER_TABLE_NAME, data);

      embed = new EmbedBuilder()
        .setTitle(
          '<:jester:1222930129999626271> Jester Tip Transaction Failed!'
        )
        .setURL(
          `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
        )
        .setDescription(
          `Transaction failed. View your transaction here:\n${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
        )
        .setColor('#ff3864')
        .setTimestamp();

      if (proposalMessage) {
        await proposalMessage.edit({ embeds: [embed] });
      } else if (interaction) {
        await interaction.editReply({ embeds: [embed] });
      }
      return;
    }

    const viewGameMessage = `\n---\nView the game at https://play.raidguild.org`;

    embed = new EmbedBuilder()
      .setTitle('<:jester:1222930129999626271> Jester Tip Succeeded!')
      .setURL(
        `${CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.explorerUrl}/tx/${txHash}`
      )
      .setDescription(
        `<@${receivingDiscordId}>'s character received ${JESTER_TIP_AMOUNT} Jester XP for MC'ing this meeting.${viewGameMessage}`
      )
      .setColor('#ff3864')
      .setTimestamp();

    data = {
      lastSenderDiscordId: senderDiscordId,
      newSenderDiscordId: senderDiscordId,
      txHash,
      tipPending: false
    };

    await updateLatestXpMcTip(client, JESTER_TABLE_NAME, data);

    if (proposalMessage) {
      await proposalMessage.edit({ embeds: [embed] });
    } else if (interaction) {
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    discordLogger(error, client);
  }
};
