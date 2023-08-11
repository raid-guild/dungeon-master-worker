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
export const DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES =
  process.env.DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES ?? 900000;
export const DISCORD_ALLOW_BOTS = process.env.DISCORD_ALLOW_BOTS ?? false;
export const DISCORD_UNLOCK_CHANNELS_ID =
  process.env.DISCORD_UNLOCK_CHANNELS_ID ?? '';
export const DISCORD_NEWCOMERS_CHANNEL_ID =
  process.env.DISCORD_NEWCOMERS_CHANNEL_ID ?? '';
export const DISCORD_ALLOWED_PARENT_CHANNEL_IDS =
  process.env.DISCORD_ALLOWED_PARENT_CHANNEL_IDS?.split(',') ?? [];

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export const HASURA_GRAPHQL_ENDPOINT =
  process.env.HASURA_GRAPHQL_ENDPOINT ?? '';
export const HASURA_GRAPHQL_ADMIN_SECRET =
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? '';
