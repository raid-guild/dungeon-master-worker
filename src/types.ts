import { Client, Collection } from 'discord.js';
import { ObjectId } from 'mongodb';

export enum TRANSACTION_STATUS {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

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
      amount: string;
      address: string;
    }[];
  };
};

export type InvoiceXpDistroDocument = {
  _id: ObjectId;
  raidChannelId: string;
  chainId: string;
  invoiceAddress: string;
  gameId: string;
  playerAddress: string;
  accountAddress: string;
  discordTag: string;
  classKey: string;
  amount: string;
  transactionHash: string;
  transactionStatus: string;
  createdAt: Date;
  updatedAt: Date;
};
