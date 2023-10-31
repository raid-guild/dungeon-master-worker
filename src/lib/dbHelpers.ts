import { dbPromise } from '@/lib/mongodb';
import { ClientWithCommands } from '@/types';
import { discordLogger } from '@/utils/logger';

// You must wait 24 hours between tips
const COOLDOWN_TIME = 24 * 60 * 60 * 1000;

export const checkUserNeedsCooldown = async (
  client: ClientWithCommands,
  senderId: string
): Promise<{ needsCooldown: boolean; endTime: string }> => {
  try {
    const dbClient = await dbPromise;
    const result = await dbClient.collection('latestXpTips').findOne({
      tipperDiscordId: senderId
    });
    if (!result) {
      return { needsCooldown: false, endTime: '' };
    }

    const { timestamp } = result;
    const now = Date.now();
    if (now - timestamp > COOLDOWN_TIME) {
      return { needsCooldown: false, endTime: '' };
    }

    const endTime = new Date(timestamp + COOLDOWN_TIME).toLocaleString();
    return { needsCooldown: true, endTime };
  } catch (err) {
    discordLogger(
      `Error checking if user needs cooldown: ${JSON.stringify({
        senderId
      })}`,
      client
    );
    return { needsCooldown: true, endTime: '' };
  }
};

export const updateLatestXpTip = async (
  client: ClientWithCommands,
  senderId: string,
  senderTag: string,
  txHash: string
) => {
  try {
    const dbClient = await dbPromise;
    const result = await dbClient.collection('latestXpTips').findOneAndUpdate(
      {
        tipperDiscordId: senderId
      },
      {
        $set: {
          tipperDiscordId: senderId,
          discordTag: senderTag,
          txHash,
          timestamp: Date.now()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    if (!result) {
      throw new Error();
    }
  } catch (err) {
    discordLogger(
      `Error saving latest XP tip to db: ${JSON.stringify({
        senderId,
        discordTag: senderTag,
        txHash,
        timestamp: Date.now()
      })}`,
      client
    );
  }
};
