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

export const CHAIN_ID = process.env.CHAIN_ID ?? '';
export const RAIDGUILD_GAME_ADDRESS = process.env.RAIDGUILD_GAME_ADDRESS ?? '';
export const CHARACTER_SHEETS_SUBGRAPH_URL =
  process.env.CHARACTER_SHEETS_SUBGRAPH_URL ?? '';

export const NPC_SAFE_ADDRESS = process.env.NPC_SAFE_ADDRESS ?? '';
export const NPC_SAFE_OWNER_KEY = process.env.NPC_SAFE_OWNER_KEY ?? '';
export const RPC_URL = process.env.RPC_URL ?? '';
export const EXPLORER_URL = process.env.EXPLORER_URL ?? '';
export const XP_ADDRESS = process.env.XP_ADDRESS ?? '';
export const CLASS_ADDRESS = process.env.CLASS_ADDRESS ?? '';
export const PINATA_JWT = process.env.PINATA_JWT ?? '';

export const SMART_INVOICE_SUBGRAPH_URL =
  process.env.SMART_INVOICE_SUBGRAPH_URL ?? '';
export const RAIDGUILD_DAO_ADDRESS = process.env.RAIDGUILD_DAO_ADDRESS ?? '';
export const SPLIT_SUBGRAPH_URL = process.env.SPLIT_SUBGRAPH_URL ?? '';

export const COOLDOWN_TIME = process.env.COOLDOWN_TIME
  ? Number(process.env.COOLDOWN_TIME)
  : 24 * 60 * 60 * 1000;

export const TIP_PROPOSAL_REACTION_THRESHOLD = process.env
  .TIP_PROPOSAL_REACTION_THRESHOLD
  ? Number(process.env.TIP_PROPOSAL_REACTION_THRESHOLD)
  : 5;

export const WXDAI_CONTRACT_ADDRESS =
  '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d';
