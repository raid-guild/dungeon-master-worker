import axios from 'axios';
import { getAddress } from 'viem';

import {
  ClientWithCommands,
  Invoice,
  InvoiceDocument,
  InvoiceWithSplits,
  InvoiceXpDistroData
} from '@/types';
import {
  CHAIN_ID,
  RAIDGUILD_DAO_ADDRESS,
  RAIDGUILD_GAME_ADDRESS,
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

    if (!CHAIN_ID) {
      throw new Error('Missing env CHAIN_ID');
    }

    if (!RAIDGUILD_GAME_ADDRESS) {
      throw new Error('Missing env RAIDGUILD_GAME_ADDRESS');
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
  const bigIntAmount = invoice.releases.reduce(
    (acc, release) => acc + BigInt(release.amount),
    BigInt(0)
  );
  return {
    chainId: CHAIN_ID,
    gameId: getAddress(RAIDGUILD_GAME_ADDRESS),
    invoiceAddress: invoice.id,
    amount: bigIntAmount.toString(),

    providerReceiver: invoice.providerReceiver,
    primarySplitId: invoice.primarySplit.id,
    primarySplitRecipients: invoice.primarySplit.recipients,
    secondarySplitId: invoice.secondarySplit?.id ?? '',
    secondarySplitRecipients:
      invoice.secondarySplit?.recipients.map(r => {
        // Ownership is the percentage of the split multiplied by 10,000. So 50% would be 500000
        return {
          amount: (
            (bigIntAmount * BigInt(r.ownership)) /
            BigInt(1000000)
          ).toString(),
          address: r.address
        };
      }) ?? []
  };
};

export const getInvoiceXpDistroData = (
  currentInvoices: Omit<InvoiceDocument, '_id'>[],
  previousInvoices: InvoiceDocument[]
) => {
  return currentInvoices
    .map(currentInvoice => {
      const previousInvoice = previousInvoices.find(
        prevInvoice =>
          prevInvoice.invoiceAddress === currentInvoice.invoiceAddress
      );

      if (!previousInvoice) {
        return {
          amountDiff: currentInvoice.amount,
          recipients: currentInvoice.secondarySplitRecipients
        };
      }

      const originalAmount = previousInvoice.amount;
      const newAmount = currentInvoice.amount;
      const amountDiff = (
        BigInt(newAmount) - BigInt(originalAmount)
      ).toString();

      return {
        amountDiff,
        recipients: currentInvoice.secondarySplitRecipients
      };
    })
    .filter(invoice => invoice.amountDiff !== '0') as InvoiceXpDistroData[];
};
