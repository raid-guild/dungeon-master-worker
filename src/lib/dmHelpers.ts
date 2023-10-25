import axios from 'axios';
import {
  ChatInputCommandInteraction,
  GuildMember,
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
  discordMember: GuildMember
): Promise<string | null> => {
  try {
    const query = `
      query MemberQuery {
        members(where: { contact_info: { discord: { _eq: ${discordMember.user.tag}}}}) {
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

    const ethAddress = response.data.data.members[0]?.eth_address as
      | string
      | undefined;

    if (!ethAddress) {
      throw new Error(`No eth address found for <@${discordMember.id}>`);
    }
    return ethAddress;
  } catch (err) {
    logError(
      client,
      interaction,
      err,
      `There was an error finding an ETH address associated with <@${discordMember.id}> in DungeonMaster!`
    );
    return null;
  }
};
