import { dbPromise } from '@/lib/mongodb';
import { ClientWithCommands } from '@/types';
import { discordLogger } from '@/utils/logger';

// You must wait 24 hours between tips
const COOLDOWN_TIME = 24 * 60 * 60 * 1000;

export const checkUserNeedsCooldown = async (
  client: ClientWithCommands,
  tableName: string,
  senderId?: string
): Promise<{
  needsCooldown: boolean;
  endTime: string;
  lastSenderDiscordId: string;
}> => {
  try {
    const dbClient = await dbPromise;
    const result = await dbClient
      .collection(tableName)
      .findOne(senderId ? { senderId } : {});
    if (!result) {
      return { needsCooldown: false, endTime: '', lastSenderDiscordId: '' };
    }

    const { timestamp, senderDiscordId } = result;
    const now = Date.now();
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
    txHash: string;
  }
) => {
  const { lastSenderDiscordId, newSenderDiscordId, senderDiscordTag, txHash } =
    data;
  try {
    const dbClient = await dbPromise;
    const result = await dbClient.collection(collectionName).findOneAndUpdate(
      {
        senderDiscordId: lastSenderDiscordId
      },
      {
        $set: {
          senderDiscordId: newSenderDiscordId,
          senderDiscordTag,
          txHash,
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
      `Error saving latest attendance XP tip to db: ${JSON.stringify({
        newSenderDiscordId,
        senderDiscordTag,
        txHash,
        timestamp: Date.now()
      })}`,
      client
    );
  }
};
