import { Client, Collection } from 'discord.js';

export type ClientWithCommands = Client & {
  commands?: Collection<string, unknown>;
};

export type Invoice = {
  id: string;
  provider: string;
  providerReceiver: string;
};

export type Split = {
  id: string;
  recipients: { account: { id: string } }[];
};

export type InvoiceWithSplits = Invoice & {
  primarySplit: {
    id: string;
    recipients: string[];
  };
  secondarySplit?: {
    id: string;
    recipients: string[];
  };
};
