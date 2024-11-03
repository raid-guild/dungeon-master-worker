import axios from 'axios';

import { CHARACTER_SHEETS_CONFIG } from '@/config';
import {
  ClientWithCommands,
  Invoice,
  InvoiceWithSplits,
  InvoiceXpDistroDocument,
  TRANSACTION_STATUS
} from '@/types';
import {
  ENVIRONMENT,
  RAIDGUILD_DAO_ADDRESS,
  SMART_INVOICE_SUBGRAPH_URL,
  WXDAI_CONTRACT_ADDRESS
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const getIsInvoiceProviderRaidGuild = async (
  client: ClientWithCommands,
  invoiceAddress: string
) => {
  if (!CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.subgraphUrl) {
    throw new Error('Missing subgraphUrl config variable');
  }

  if (!RAIDGUILD_DAO_ADDRESS) {
    throw new Error('Missing env RAIDGUILD_DAO_ADDRESS');
  }

  try {
    const query = `
    query InvoiceQuery {
      invoices(where: { id: "${invoiceAddress}" }) {
        provider
      }
    }
  `;

    const response = await axios.post(SMART_INVOICE_SUBGRAPH_URL, {
      query
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    const invoice = response.data.data.invoices[0];
    const { provider } = invoice;

    return provider === RAIDGUILD_DAO_ADDRESS;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};

export const getAllRaidGuildInvoices = async (
  client: ClientWithCommands
): Promise<Invoice[] | null> => {
  try {
    if (!SMART_INVOICE_SUBGRAPH_URL) {
      throw new Error('Missing env SMART_INVOICE_SUBGRAPH_URL');
    }

    if (!RAIDGUILD_DAO_ADDRESS) {
      throw new Error('Missing env RAIDGUILD_DAO_ADDRESS');
    }

    if (!CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId) {
      throw new Error('Missing chainId config variable');
    }

    if (!CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress) {
      throw new Error('Missing gameAddress config variable');
    }

    const query = `
    query InvoiceQuery {
      invoices(where: { provider: "${RAIDGUILD_DAO_ADDRESS}", token: "${WXDAI_CONTRACT_ADDRESS}" }) {
        id
        providerReceiver
        releases {
          amount
        }
      }
    }
  `;

    const response = await axios.post(SMART_INVOICE_SUBGRAPH_URL, {
      query
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data.invoices;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};

export const formatInvoiceXpDistributionDocuments = (
  invoices: InvoiceWithSplits[],
  xpAlreadyReceived: Record<string, Record<string, bigint>>
) => {
  const newDocuments: Omit<InvoiceXpDistroDocument, '_id'>[] = [];
  const xpOwed: Record<string, Record<string, bigint>> = {};

  invoices.forEach(invoice => {
    invoice.secondarySplit?.recipients.forEach(recipient => {
      if (!xpOwed[invoice.id]) {
        xpOwed[invoice.id] = {};
      }

      if (!xpOwed[invoice.id][recipient.address]) {
        xpOwed[invoice.id][recipient.address] = BigInt(0);
      }

      xpOwed[invoice.id][recipient.address] += BigInt(recipient.amount);
    });
  });

  Object.entries(xpOwed).forEach(([invoiceAddress, recipients]) => {
    Object.entries(recipients).forEach(([address, amount]) => {
      let amountToReceive = amount;
      if (
        xpAlreadyReceived[invoiceAddress] &&
        xpAlreadyReceived[invoiceAddress][address]
      ) {
        amountToReceive -= xpAlreadyReceived[invoiceAddress][address];
      }

      if (amount > BigInt(0)) {
        newDocuments.push({
          chainId: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.chainId,
          raidChannelId: '',
          invoiceAddress,
          gameId: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress,
          playerAddress: address,
          accountAddress: '',
          discordTag: '',
          classKey: '',
          amount: amountToReceive.toString(),
          transactionHash: '',
          transactionStatus: TRANSACTION_STATUS.PENDING,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });
  });

  return newDocuments;
};
