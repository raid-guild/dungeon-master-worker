import dotenv from 'dotenv';

dotenv.config();

export const DISCORD_DM_TOKEN = process.env.DISCORD_DM_TOKEN ?? '';
export const DISCORD_GUARD_TOKEN = process.env.DISCORD_GUARD_TOKEN ?? '';
export const DISCORD_DM_CLIENT_ID = process.env.DISCORD_DM_CLIENT_ID ?? '';
export const DISCORD_GUARD_CLIENT_ID =
  process.env.DISCORD_GUARD_CLIENT_ID ?? '';
export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID ?? '';
export const DISCORD_COMMAND_CENTER_ID =
  process.env.DISCORD_COMMAND_CENTER_ID ?? '';
export const DISCORD_START_HERE_CHANNEL_ID =
  process.env.DISCORD_START_HERE_CHANNEL_ID ?? '';
export const DISCORD_VALHALLA_CATEGORY_ID =
  process.env.DISCORD_VALHALLA_CATEGORY_ID ?? '';
export const DISCORD_RAIDS_CATEGORY_ID =
  process.env.DISCORD_RAIDS_CATEGORY_ID ?? '';
export const DISCORD_CAMPS_CATEGORY_ID =
  process.env.DISCORD_CAMPS_CATEGORY_ID ?? '';
export const DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES =
  process.env.DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES ?? 900000;
export const DISCORD_ALLOW_BOTS = process.env.DISCORD_ALLOW_BOTS ?? false;
export const DISCORD_UNLOCK_CHANNELS_ID =
  process.env.DISCORD_UNLOCK_CHANNELS_ID ?? '';
export const DISCORD_NEWCOMERS_CHANNEL_ID =
  process.env.DISCORD_NEWCOMERS_CHANNEL_ID ?? '';
export const DISCORD_ALLOWED_PARENT_CHANNEL_IDS =
  process.env.DISCORD_ALLOWED_PARENT_CHANNEL_IDS?.split(',') ?? [];
export const DISCORD_MEMBER_ROLE_ID = process.env.DISCORD_MEMBER_ROLE_ID ?? '';

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export const HASURA_GRAPHQL_ENDPOINT =
  process.env.HASURA_GRAPHQL_ENDPOINT ?? '';
export const HASURA_GRAPHQL_ADMIN_SECRET =
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? '';

export const RAIDGUILD_GAME_ADDRESS = process.env.RAIDGUILD_GAME_ADDRESS ?? '';
export const CHARACTER_SHEETS_SUBGRAPH_URL =
  process.env.CHARACTER_SHEETS_SUBGRAPH_URL ?? '';

export const NPC_SAFE_ADDRESS = process.env.NPC_SAFE_ADDRESS ?? '';
export const NPC_SAFE_OWNER_KEY = process.env.NPC_SAFE_OWNER_KEY ?? '';
export const RPC_URL = process.env.RPC_URL ?? '';
export const EXPLORER_URL = process.env.EXPLORER_URL ?? '';
export const XP_ADDRESS = process.env.XP_ADDRESS ?? '';
