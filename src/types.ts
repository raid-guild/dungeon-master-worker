import { Client, Collection } from 'discord.js';

export type ClientWithCommands = Client & {
  commands?: Collection<string, unknown>;
};
