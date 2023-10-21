import axios from 'axios';
import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { ClientWithCommands } from '@/types';
import {
  HASURA_GRAPHQL_ADMIN_SECRET,
  HASURA_GRAPHQL_ENDPOINT
} from '@/utils/constants';
import { logError } from '@/utils/logger';

if (!HASURA_GRAPHQL_ENDPOINT || !HASURA_GRAPHQL_ADMIN_SECRET) {
  throw new Error(
    'Missing envs HASURA_GRAPHQL_ENDPOINT or HASURA_GRAPHQL_ADMIN_SECRET'
  );
}

export const getPlayerAddressByDiscordHandle = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction,
  handle: string
): Promise<string> => {
  try {
    const query = `
      query RaidQuery {
        members(where: { contact_info: { discord: { _eq: ${handle}}}}) {
          eth_address
        }
      }
    `;

    const headers = {
      'x-hasura-admin-secret': HASURA_GRAPHQL_ADMIN_SECRET
    };

    const response = await axios({
      url: HASURA_GRAPHQL_ENDPOINT,
      method: 'post',
      headers,
      data: {
        query
      }
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    const ethAddress = response.data.data.members[0].eth_address as
      | string
      | undefined;

    if (!ethAddress) {
      throw new Error(`ERROR: no eth address found for ${handle}`);
    }
    return ethAddress;
  } catch (err) {
    logError(client, interaction, err, err as string);
    return '';
  }
};
