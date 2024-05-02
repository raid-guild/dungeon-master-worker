import { EmbedBuilder, TextChannel } from 'discord.js';

import { JESTER_TIP_AMOUNT } from '@/interactions/cs/tipJester';
import { giveClassExp, updateLatestXpMcTip } from '@/lib';
import { JesterTipData } from '@/lib/dbHelpers';
import { ClientWithCommands } from '@/types';
import { EXPLORER_URL } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const completeJesterTip = async (
  client: ClientWithCommands,
  jesterTipProposal: Omit<JesterTipData, 'timestamp'>,
  channel: TextChannel
) => {
  try {
    const { receivingAddress, receivingDiscordId, senderDiscordId } =
      jesterTipProposal;

    if (!receivingAddress) throw new Error('No receiving address found!');

    let embed = new EmbedBuilder()
      .setTitle('<:jester:1222930129999626271> Jester Tip Pending...')
      .setColor('#ff3864')
      .setTimestamp();

    const txMessage = await channel.send({
      embeds: [embed]
    });

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
    await updateLatestXpMcTip(client, 'latestXpMcTips', data);

    const tx = await giveClassExp(client, receivingAddress, '14');
    if (!tx) {
      data = {
        lastSenderDiscordId: senderDiscordId,
        newSenderDiscordId: senderDiscordId,
        txHash: '',
        tipPending: false
      };
      await updateLatestXpMcTip(client, 'latestXpMcTips', data);
      return;
    }

    const txHash = tx.hash;

    embed = new EmbedBuilder()
      .setTitle(
        '<:jester:1222930129999626271> Jester Tip Transaction Pending...'
      )
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
        lastSenderDiscordId: senderDiscordId,
        newSenderDiscordId: senderDiscordId,
        txHash,
        tipPending: false
      };
      await updateLatestXpMcTip(client, 'latestXpMcTips', data);

      embed = new EmbedBuilder()
        .setTitle(
          '<:jester:1222930129999626271> Jester Tip Transaction Failed!'
        )
        .setURL(`${EXPLORER_URL}/tx/${txHash}`)
        .setDescription(
          `Transaction failed. View your transaction here:\n${EXPLORER_URL}/tx/${txHash}`
        )
        .setColor('#ff3864')
        .setTimestamp();

      await txMessage.edit({ embeds: [embed] });
      return;
    }

    const viewGameMessage = `\n---\nView the game at https://play.raidguild.org`;

    embed = new EmbedBuilder()
      .setTitle('<:jester:1222930129999626271> Jester Tip Succeeded!')
      .setURL(`${EXPLORER_URL}/tx/${txHash}`)
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

    await updateLatestXpMcTip(client, 'latestXpMcTips', data);
    await txMessage.edit({ embeds: [embed] });
  } catch (error) {
    discordLogger(error, client);
  }
};
