import axios from 'axios';

import {
  ClientWithCommands,
  Invoice,
  InvoiceDocument,
  InvoiceWithSplits
} from '@/types';
import {
  RAIDGUILD_DAO_ADDRESS,
  SMART_INVOICE_SUBGRAPH_URL
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const getIsInvoiceProviderRaidGuild = async (
  client: ClientWithCommands,
  invoiceAddress: string
) => {
  if (!SMART_INVOICE_SUBGRAPH_URL) {
    throw new Error('Missing env SMART_INVOICE_SUBGRAPH_URL');
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
): Promise<Invoice[]> => {
  try {
    if (!SMART_INVOICE_SUBGRAPH_URL) {
      throw new Error('Missing env SMART_INVOICE_SUBGRAPH_URL');
    }

    if (!RAIDGUILD_DAO_ADDRESS) {
      throw new Error('Missing env RAIDGUILD_DAO_ADDRESS');
    }

    const query = `
    query InvoiceQuery {
      invoices(where: { provider: "${RAIDGUILD_DAO_ADDRESS}" }) {
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
    return [];
  }
};

export const formatInvoiceDocument = (
  invoice: InvoiceWithSplits
): Omit<InvoiceDocument, '_id'> => {
  return {
    address: invoice.id,
    amount: invoice.releases
      .reduce((acc, release) => acc + BigInt(release.amount), BigInt(0))
      .toString(),

    providerReceiver: invoice.providerReceiver,
    primarySplitId: invoice.primarySplit.id,
    primarySplitRecipients: invoice.primarySplit.recipients,
    secondarySplitId: invoice.secondarySplit?.id ?? '',
    secondarySplitRecipients: invoice.secondarySplit?.recipients ?? []
  };
};
