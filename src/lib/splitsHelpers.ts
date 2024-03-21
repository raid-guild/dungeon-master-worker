import axios from 'axios';

import { ClientWithCommands, Invoice, InvoiceWithSplits, Split } from '@/types';
import { SPLIT_SUBGRAPH_URL } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const getAllInvoicesWithPrimarySplit = async (
  client: ClientWithCommands,
  allRaidGuildInvoices: Invoice[]
): Promise<InvoiceWithSplits[]> => {
  try {
    if (!SPLIT_SUBGRAPH_URL) {
      throw new Error('Missing env SPLIT_SUBGRAPH_URL');
    }

    const allProviderReceiverAddresses = allRaidGuildInvoices.map(
      invoice => invoice.providerReceiver
    );

    const formattedProviderReceiverAddresses = allProviderReceiverAddresses
      .map(address => `"${address}"`)
      .join(', ');

    const query = `
    query SplitQuery {
      splits(where: { id_in: [${formattedProviderReceiverAddresses}] }) {
        id
        recipients {
          account {
            id
          }
        }
      }
    }
  `;

    const response = await axios.post(SPLIT_SUBGRAPH_URL, {
      query
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    const proverRecipientsThatAreSplits = response.data.data.splits.map(
      (s: Split) => s.id
    );
    const allInvoicesWithSplitProviderReceiver = allRaidGuildInvoices.filter(
      invoice =>
        proverRecipientsThatAreSplits.includes(invoice.providerReceiver)
    );

    return allInvoicesWithSplitProviderReceiver.map(invoice => {
      const split = response.data.data.splits.find(
        (s: Split) => s.id === invoice.providerReceiver
      ) as Split;

      return {
        ...invoice,
        primarySplit: {
          id: split.id,
          recipients: split.recipients.map(recipient => recipient.account.id)
        }
      };
    });
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return [];
  }
};

export const getAllInvoicesWithSecondarySplit = async (
  client: ClientWithCommands,
  allInvoicesWithPrimarySplit: InvoiceWithSplits[]
) => {
  try {
    if (!SPLIT_SUBGRAPH_URL) {
      throw new Error('Missing env SPLIT_SUBGRAPH_URL');
    }

    const allPrimarySplitRecipients = allInvoicesWithPrimarySplit.map(
      invoice => invoice.primarySplit.recipients
    );

    const formattedPrimarySplitRecipients = allPrimarySplitRecipients
      .flat()
      .map(id => `"${id}"`)
      .join(', ');

    const query = `
    query SplitQuery {
      splits(where: { id_in: [${formattedPrimarySplitRecipients}] }) {
        id
        recipients {
          ownership
          account {
            id
          }
        }
      }
    }
  `;

    const response = await axios.post(SPLIT_SUBGRAPH_URL, {
      query
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    const existingSecondarySplits = response.data.data.splits.map(
      (split: Split) => split.id
    );

    const allInvoicesWithSecondarySplit = allInvoicesWithPrimarySplit.filter(
      invoice => {
        const primaryRecipients = invoice.primarySplit.recipients;
        return primaryRecipients.some(id =>
          existingSecondarySplits.includes(id)
        );
      }
    );

    return allInvoicesWithSecondarySplit.map(invoice => {
      const primaryRecipients = invoice.primarySplit.recipients;
      const secondarySplit = response.data.data.splits.find(
        (split: { id: string; recipients: { account: { id: string } }[] }) =>
          primaryRecipients.includes(split.id)
      );
      return {
        ...invoice,
        secondarySplit: {
          id: secondarySplit.id,
          recipients: secondarySplit.recipients.map(
            (recipient: { ownership: string; account: { id: string } }) => ({
              // Ownership is the percentage of the split multiplied by 10,000. So 50% would be 500000
              ownership: recipient.ownership,
              address: recipient.account.id
            })
          )
        }
      };
    });
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return [];
  }
};
