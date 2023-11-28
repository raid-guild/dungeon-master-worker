import { getAddress } from 'viem';

import { dbPromise } from '@/lib/mongodb';
import { ClientWithCommands } from '@/types';
import { COOLDOWN_TIME, RAIDGUILD_GAME_ADDRESS } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const checkUserNeedsCooldown = async (
  client: ClientWithCommands,
  tableName: string,
  senderId?: string
): Promise<{
  needsCooldown: boolean;
  endTime: string;
  lastSenderDiscordId: string;
  proposalActive?: boolean;
  proposalExpiration?: number;
}> => {
  try {
    const gameAddress = getAddress(RAIDGUILD_GAME_ADDRESS);
    const dbClient = await dbPromise;
    const result = await dbClient
      .collection(tableName)
      .findOne(
        senderId ? { senderDiscordId: senderId, gameAddress } : { gameAddress }
      );
    if (!result) {
      return { needsCooldown: false, endTime: '', lastSenderDiscordId: '' };
    }

    const { timestamp, senderDiscordId, txHash, proposalExpiration } = result;
    const now = Date.now();

    if (!txHash && proposalExpiration && now > Number(proposalExpiration)) {
      return {
        needsCooldown: false,
        endTime: '',
        lastSenderDiscordId: senderDiscordId,
        proposalActive: false,
        proposalExpiration: Number(proposalExpiration)
      };
    }

    if (!txHash && proposalExpiration && now < Number(proposalExpiration)) {
      return {
        needsCooldown: false,
        endTime: '',
        lastSenderDiscordId: senderDiscordId,
        proposalActive: true,
        proposalExpiration: Number(proposalExpiration)
      };
    }

    if (now - timestamp > COOLDOWN_TIME) {
      return {
        needsCooldown: false,
        endTime: '',
        lastSenderDiscordId: senderDiscordId
      };
    }

    const endTime = new Date(timestamp + COOLDOWN_TIME).toLocaleString();
    return {
      needsCooldown: true,
      endTime,
      lastSenderDiscordId: senderDiscordId
    };
  } catch (err) {
    discordLogger(
      `Error checking if user needs cooldown: ${JSON.stringify({
        senderId
      })}`,
      client
    );
    return { needsCooldown: true, endTime: '', lastSenderDiscordId: '' };
  }
};

export const updateLatestXpTip = async (
  client: ClientWithCommands,
  collectionName: string,
  data: {
    lastSenderDiscordId: string;
    newSenderDiscordId: string;
    senderDiscordTag: string;
    chainId: string;
    txHash?: string;
    messageId?: string;
  }
) => {
  const { lastSenderDiscordId, newSenderDiscordId, senderDiscordTag, txHash } =
    data;
  try {
    const gameAddress = getAddress(RAIDGUILD_GAME_ADDRESS);
    const dbClient = await dbPromise;
    const result = await dbClient.collection(collectionName).findOneAndUpdate(
      {
        senderDiscordId: lastSenderDiscordId,
        gameAddress
      },
      {
        $set: {
          ...data,
          senderDiscordId: newSenderDiscordId,
          timestamp: Date.now()
        }
      },
      {
        upsert: true
      }
    );
    if (!result) {
      throw new Error();
    }
  } catch (err) {
    discordLogger(
      `Error saving to ${collectionName} table in db: ${JSON.stringify({
        newSenderDiscordId,
        senderDiscordTag,
        txHash,
        timestamp: Date.now()
      })}`,
      client
    );
  }
};
