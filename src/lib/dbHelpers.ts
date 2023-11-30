import { WithId } from 'mongodb';
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
        err
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
    txHash: string;
    message: string;
  }
) => {
  const {
    lastSenderDiscordId,
    newSenderDiscordId,
    senderDiscordTag,
    chainId,
    txHash,
    message
  } = data;

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
          senderDiscordId: newSenderDiscordId,
          senderDiscordTag,
          gameAddress,
          chainId,
          txHash,
          message,
          timestamp: Date.now()
        }
      },
      {
        returnDocument: 'after',
        upsert: true
      }
    );
    if (!result) {
      throw new Error('Tip data could not be updated!');
    }
  } catch (err) {
    discordLogger(
      `Error saving to ${collectionName} table in db: ${JSON.stringify(err)}`,
      client
    );
  }
};

export type McTipData = {
  senderDiscordId: string;
  gameAddress: string;
  timestamp: number;
  txHash: string;
  tipPending: boolean;
  senderDiscordTag?: string;
  chainId?: string;
  messageId?: string;
  proposalExpiration?: number;
  receivingDiscordId?: string;
  receivingAddress?: string;
};

export const updateLatestXpMcTip = async (
  client: ClientWithCommands,
  collectionName: string,
  data: Omit<McTipData, 'senderDiscordId' | 'gameAddress' | 'timestamp'> & {
    lastSenderDiscordId: string;
    newSenderDiscordId: string;
  }
) => {
  const {
    lastSenderDiscordId,
    newSenderDiscordId,
    senderDiscordTag,
    chainId,
    txHash,
    messageId,
    proposalExpiration,
    receivingDiscordId,
    receivingAddress: _receivingAddress,
    tipPending
  } = data;

  try {
    const gameAddress = getAddress(RAIDGUILD_GAME_ADDRESS);

    const updates: McTipData = {
      senderDiscordId: newSenderDiscordId,
      gameAddress,
      txHash,
      tipPending,
      timestamp: Date.now()
    };

    if (senderDiscordTag) {
      updates.senderDiscordTag = senderDiscordTag;
    }

    if (chainId) {
      updates.chainId = chainId;
    }

    if (messageId) {
      updates.messageId = messageId;
    }

    if (proposalExpiration) {
      updates.proposalExpiration = proposalExpiration;
    }

    if (receivingDiscordId) {
      updates.receivingDiscordId = receivingDiscordId;
    }

    if (_receivingAddress) {
      const receivingAddress = getAddress(_receivingAddress);
      updates.receivingAddress = receivingAddress;
    }

    const dbClient = await dbPromise;
    const result = await dbClient.collection(collectionName).findOneAndUpdate(
      {
        senderDiscordId: lastSenderDiscordId,
        gameAddress
      },
      {
        $set: updates
      },
      {
        returnDocument: 'after',
        upsert: true
      }
    );

    if (!result) {
      throw new Error('Tip data could not be updated!');
    }
  } catch (err) {
    discordLogger(
      `Error saving to ${collectionName} table in db: ${JSON.stringify(err)}`,
      client
    );
  }
};

export const getMcTipProposal = async (
  client: ClientWithCommands
): Promise<WithId<McTipData> | null> => {
  try {
    const gameAddress = getAddress(RAIDGUILD_GAME_ADDRESS);
    const dbClient = await dbPromise;
    const result = await dbClient
      .collection('latestXpMcTips')
      .findOne({ gameAddress });
    if (!result) {
      return null;
    }
    return result as WithId<McTipData>;
  } catch (err) {
    discordLogger(`Error getting latestXpMcTips: ${err}`, client);
    return null;
  }
};
