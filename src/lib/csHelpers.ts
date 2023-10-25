import axios from 'axios';
import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { ClientWithCommands } from '@/types';
import {
  CHARACTER_SHEETS_SUBGRAPH_URL,
  RAIDGUILD_GAME_ADDRESS
} from '@/utils/constants';
import { logError } from '@/utils/logger';

if (!RAIDGUILD_GAME_ADDRESS || !CHARACTER_SHEETS_SUBGRAPH_URL) {
  throw new Error(
    'Missing envs RAIDGUILD_GAME_ADDRESS or CHARACTER_SHEETS_SUBGRAPH_URL'
  );
}

export const getCharacterAccountByPlayerAddress = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction,
  playerAddress: string
): Promise<string | null> => {
  try {
    const query = `
      query CharacterAccountQuery {
        characters(where: { game: "${RAIDGUILD_GAME_ADDRESS}", player: "${playerAddress}"}) {
          account
        }
      }
    `;

    const response = await axios({
      url: CHARACTER_SHEETS_SUBGRAPH_URL,
      method: 'post',
      data: {
        query
      }
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    const accountAddress = response.data.data.characters[0].account as
      | string
      | undefined;

    if (!accountAddress) {
      throw new Error(
        `ERROR: there is no character account address associated with that Discord handle`
      );
    }
    return accountAddress;
  } catch (err) {
    logError(
      client,
      interaction,
      err,
      'There was an error finding a character account address associated with that Discord handle in CharacterSheets!'
    );
    return null;
  }
};
