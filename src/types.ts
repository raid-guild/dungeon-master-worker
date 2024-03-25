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
    recipients: {
      ownership: string;
      address: string;
    }[];
  };
};

export type InvoiceDocument = {
  _id: ObjectId;
  chainId: string;
  gameId: string;
  invoiceAddress: string;
  amount: string;
  providerReceiver: string;
  primarySplitId: string;
  primarySplitRecipients: string[];
  secondarySplitId: string;
  secondarySplitRecipients: {
    address: string;
    amount: string;
  }[];
};

export type InvoiceXpDistroData = {
  invoiceAddress: string;
  amountDiff: string;
  recipients: {
    address: string;
    amount: string;
  }[];
};

export type PayoutInfo = {
  invoiceAddress: string;
  playerAddress: string;
  amount: string;
  classKey: string | null;
  discordTag: string | null;
  accountAddress: string | null;
};
