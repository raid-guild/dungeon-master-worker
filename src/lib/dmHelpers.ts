import axios from 'axios';
import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';

import { ClientWithCommands, InvoiceXpDistroDocument } from '@/types';
import {
  GOOGLE_SHEETS_API_KEY,
  GOOGLE_SHEETS_PROJECT_ID,
  HASURA_GRAPHQL_ADMIN_SECRET,
  HASURA_GRAPHQL_ENDPOINT
} from '@/utils/constants';
import { discordLogger, logError } from '@/utils/logger';

export const getPlayerAddressesByDiscordTags = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction,
  discordMembers: GuildMember[]
): Promise<
  [
    Record<'main' | 'cohort7', Record<string, string>> | null,
    Record<'main' | 'cohort7', string[]> | null
  ]
> => {
  try {
    if (!HASURA_GRAPHQL_ENDPOINT || !HASURA_GRAPHQL_ADMIN_SECRET) {
      throw new Error(
        'Missing envs HASURA_GRAPHQL_ENDPOINT or HASURA_GRAPHQL_ADMIN_SECRET'
      );
    }

    if (!GOOGLE_SHEETS_API_KEY || !GOOGLE_SHEETS_PROJECT_ID) {
      throw new Error(
        'Missing envs GOOGLE_SHEETS_API_KEY or GOOGLE_SHEETS_PROJECT_ID'
      );
    }

    const discordUsernames = discordMembers.map(m => m?.user.tag);
    const query = `
      query MemberQuery {
        members(where: { contact_info: { discord: { _in: ${JSON.stringify(
          discordUsernames
        )}}}}) {
          eth_address
          contact_info {
            discord
          }
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

    const { members } = response.data.data;

    const discordTagToEthAddressMap: Record<
      'main' | 'cohort7',
      Record<string, string>
    > = members.reduce(
      (
        acc: Record<'main' | 'cohort7', Record<string, string>>,
        member: { eth_address: string; contact_info: { discord: string } }
      ) => {
        const { discord } = member.contact_info;
        const { eth_address: ethAddress } = member;
        acc.main[discord] = ethAddress.toLowerCase();
        return acc;
      },
      { main: {}, cohort7: {} }
    );

    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_PROJECT_ID}/values/Cohort%20Game%20Players?alt=json&key=${GOOGLE_SHEETS_API_KEY}`;

    const cohortMappingResponse = await axios.get(apiUrl);
    const cohortMappingValues = cohortMappingResponse.data as {
      values: [string, string, string][];
    };

    discordUsernames.forEach(discordTag => {
      const cohortMappingEntry = cohortMappingValues.values.find(
        entry => entry[0] === discordTag
      );
      const [, ethAddress] = cohortMappingEntry || [];
      if (ethAddress) {
        discordTagToEthAddressMap.cohort7[discordTag] =
          ethAddress.toLowerCase();
      }
    });

    const discordTagsWithoutEthAddress: Record<'main' | 'cohort7', string[]> =
      discordUsernames.reduce(
        (acc: Record<'main' | 'cohort7', string[]>, discordTag: string) => {
          if (!discordTagToEthAddressMap.main[discordTag]) {
            acc.main.push(discordTag);
          }

          if (!discordTagToEthAddressMap.cohort7[discordTag]) {
            acc.cohort7.push(discordTag);
          }

          return acc;
        },
        { main: [], cohort7: [] }
      );

    return [discordTagToEthAddressMap, discordTagsWithoutEthAddress];
  } catch (err) {
    logError(
      client,
      interaction,
      err,
      `There was an error querying ETH addresses in DungeonMaster using Discord handles!`
    );
    return [null, null];
  }
};

export const getRaidDataFromInvoiceAddresses = async (
  client: ClientWithCommands,
  invoiceXpDistroData: Omit<InvoiceXpDistroDocument, '_id'>[]
): Promise<Omit<InvoiceXpDistroDocument, '_id'>[] | null> => {
  try {
    if (!HASURA_GRAPHQL_ADMIN_SECRET || !HASURA_GRAPHQL_ENDPOINT) {
      throw new Error(
        'Missing envs HASURA_GRAPHQL_ADMIN_SECRET or HASURA_GRAPHQL_ENDPOINT'
      );
    }

    const invoiceAddresses = invoiceXpDistroData.map(
      distroData => distroData.invoiceAddress
    );

    const query = `
      query RaidsQuery {
        raids(where: { invoice_address: { _in: ${JSON.stringify(
          invoiceAddresses
        )}}}) {
          invoice_address
          raid_channel_id
          cleric {
            eth_address
            contact_info {
              discord
            }
          }
          hunter {
            eth_address
            contact_info {
              discord
            }
          }
          raid_parties {
            member {
              eth_address
              contact_info {
                discord
              }
            }
            raider_class_key
          }
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

    const { raids } = response.data.data as {
      raids: {
        invoice_address: string;
        raid_channel_id: string;
        cleric: { eth_address: string; contact_info: { discord: string } };
        hunter: { eth_address: string; contact_info: { discord: string } };
        raid_parties: {
          member: { eth_address: string; contact_info: { discord: string } };
          raider_class_key: string;
        }[];
      }[];
    };

    const invoiceXpDistroDataWithRaidData = invoiceXpDistroData.map(
      distroData => {
        const raidData = raids.find(
          raid => raid.invoice_address === distroData.invoiceAddress
        );

        if (!raidData) return distroData;

        const { playerAddress } = distroData;
        const raidPartyMember = raidData.raid_parties.find(
          party => party.member.eth_address === playerAddress
        );

        if (playerAddress === raidData.cleric?.eth_address) {
          return {
            ...distroData,
            raidChannelId: raidData.raid_channel_id,
            discordTag: raidData.cleric.contact_info.discord,
            classKey: 'ACCOUNT_MANAGER'
          };
        }

        if (playerAddress === raidData.hunter?.eth_address) {
          return {
            ...distroData,
            raidChannelId: raidData.raid_channel_id,
            discordTag: raidData.hunter.contact_info.discord,
            classKey: 'BIZ_DEV'
          };
        }

        if (!raidPartyMember) {
          return {
            ...distroData,
            raidChannelId: raidData.raid_channel_id
          };
        }

        return {
          ...distroData,
          raidChannelId: raidData.raid_channel_id,
          discordTag: raidPartyMember.member.contact_info.discord,
          classKey: raidPartyMember.raider_class_key
        };
      }
    );

    return invoiceXpDistroDataWithRaidData;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};
