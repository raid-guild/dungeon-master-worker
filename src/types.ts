import { Client, Collection } from 'discord.js';
import { ObjectId } from 'mongodb';

export type ClientWithCommands = Client & {
  commands?: Collection<string, unknown>;
};

export type Invoice = {
  id: string;
  provider: string;
  providerReceiver: string;
  releases: { amount: string }[];
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

export type InvoiceDocument = {
  _id: ObjectId;
  chainId: string;
  gameId: string;
  address: string;
  amount: string;
  providerReceiver: string;
  primarySplitId: string;
  primarySplitRecipients: string[];
  secondarySplitId: string;
  secondarySplitRecipients: string[];
};
