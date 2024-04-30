import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import axios from 'axios';
import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { ethers } from 'ethers';
import { Address, encodeFunctionData, formatEther, parseAbi } from 'viem';

import { uploadToPinata } from '@/lib/pinata';
import { ClientWithCommands, InvoiceXpDistroDocument } from '@/types';
import {
  CHARACTER_SHEETS_SUBGRAPH_URL,
  CLASS_ADDRESS,
  NPC_SAFE_ADDRESS,
  NPC_SAFE_OWNER_KEY,
  RAIDGUILD_GAME_ADDRESS,
  RPC_URL,
  XP_ADDRESS
} from '@/utils/constants';
import { discordLogger, logError } from '@/utils/logger';

if (!RAIDGUILD_GAME_ADDRESS || !CHARACTER_SHEETS_SUBGRAPH_URL) {
  throw new Error(
    'Missing envs RAIDGUILD_GAME_ADDRESS or CHARACTER_SHEETS_SUBGRAPH_URL'
  );
}

export const getCharacterAccountsByPlayerAddresses = async (
  client: ClientWithCommands,
  discordTagToEthAddressMap: Record<string, string>,
  interaction?:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction
): Promise<[Record<string, string> | null, string[] | null]> => {
  try {
    const playerAddresses = Object.values(discordTagToEthAddressMap);
    const formattedAddresses = playerAddresses.map(address => {
      return address.toLowerCase();
    });
    const query = `
      query CharacterAccountQuery {
        characters(where: { game: "${RAIDGUILD_GAME_ADDRESS}", player_in: ${JSON.stringify(
      formattedAddresses
    )}}) {
          account
          player
        }
      }
    `;

    const response = await axios({
      url: CHARACTER_SHEETS_SUBGRAPH_URL,
      method: 'post',
      data: {
        query
      }
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    const discordTagToCharacterAccountMap =
      response.data.data.characters.reduce(
        (
          acc: Record<string, string>,
          character: { account: string; player: string }
        ) => {
          const discordTag = Object.keys(discordTagToEthAddressMap).find(
            tag => discordTagToEthAddressMap[tag] === character.player
          );
          if (discordTag) {
            acc[discordTag] = character.account;
          }
          return acc;
        },
        {}
      );

    const discordTagsWithoutCharacterAccounts = Object.keys(
      discordTagToEthAddressMap
    ).filter(
      tag => !Object.keys(discordTagToCharacterAccountMap).includes(tag)
    );
    return [
      discordTagToCharacterAccountMap,
      discordTagsWithoutCharacterAccounts
    ];
  } catch (err) {
    if (interaction) {
      logError(
        client,
        interaction,
        err,
        'There was an error finding a character account address associated with that Discord handle in CharacterSheets!'
      );
    } else {
      discordLogger(JSON.stringify(err), client);
    }
    return [null, null];
  }
};

if (
  !(
    NPC_SAFE_ADDRESS &&
    NPC_SAFE_OWNER_KEY &&
    RPC_URL &&
    XP_ADDRESS &&
    CLASS_ADDRESS
  )
) {
  throw new Error(
    'Missing envs NPC_SAFE_ADDRESS or NPC_SAFE_OWNER_KEY or RPC_URL or XP_ADDRESS'
  );
}

export const getNpcGnosisSafe = async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerSigner = new ethers.Wallet(NPC_SAFE_OWNER_KEY, provider);

  const ethAdapterOwner = new EthersAdapter({
    ethers,
    signerOrProvider: ownerSigner
  });

  const safe = await Safe.create({
    ethAdapter: ethAdapterOwner,
    safeAddress: NPC_SAFE_ADDRESS
  });

  return safe;
};

const buildDropExpTransactionData = (
  accountAddress: string,
  amount: string
) => {
  const abi = parseAbi([
    'function dropExp(address character, uint256 amount) public'
  ]);

  const data = encodeFunctionData({
    abi,
    functionName: 'dropExp',
    args: [accountAddress as Address, BigInt(amount)]
  });

  const dropExpTransactionData: SafeTransactionDataPartial = {
    to: XP_ADDRESS,
    data,
    value: '0'
  };

  return dropExpTransactionData;
};

export const dropExp = async (
  client: ClientWithCommands,
  accountAddresses: string[],
  amount: string
) => {
  const safe = await getNpcGnosisSafe();

  const safeTransactionData = accountAddresses.map(accountAddress => {
    return buildDropExpTransactionData(accountAddress, amount);
  });

  try {
    const safeTx = await safe.createTransaction({
      safeTransactionData
    });

    const txRes = await safe.executeTransaction(safeTx);
    const tx = txRes.transactionResponse;

    if (!tx) throw new Error('Could not submit transaction');

    return tx;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};

const CLASS_KEY_TO_ID_MAP: Record<string, string> = {
  FRONTEND_DEV: '1',
  SMART_CONTRACTS: '2',
  COMMUNITY: '3',
  RECORD_KEEPER: '4',
  LEGAL: '5',
  BACKEND_DEV: '6',
  PROJECT_MANAGEMENT: '7',
  BIZ_DEV: '8',
  OPERATIONS: '9',
  TREASURY: '10',
  ACCOUNT_MANAGER: '11',
  DESIGN: '12'
};

const buildGiveClassXpTransactionData = (
  distroDoc: Omit<InvoiceXpDistroDocument, '_id'>
) => {
  const abi = parseAbi([
    'function giveClassExp(address characterAccount, uint256 classId, uint256 amountOfExp) public'
  ]);

  const accountAddress = distroDoc.accountAddress as Address;
  const classId = CLASS_KEY_TO_ID_MAP[distroDoc.classKey as string];
  const amount = formatEther(BigInt(distroDoc.amount));
  const amountAsInteger = Math.ceil(Number(amount));

  const data = encodeFunctionData({
    abi,
    functionName: 'giveClassExp',
    args: [accountAddress, BigInt(classId), BigInt(amountAsInteger)]
  });

  const giveClassExpTransactionData: SafeTransactionDataPartial = {
    to: CLASS_ADDRESS,
    data,
    value: '0'
  };

  return giveClassExpTransactionData;
};

export const giveClassXp = async (
  client: ClientWithCommands,
  distroDocs: Omit<InvoiceXpDistroDocument, '_id'>[]
) => {
  const safe = await getNpcGnosisSafe();

  const safeTransactionData = distroDocs.map(distroDoc => {
    return buildGiveClassXpTransactionData(distroDoc);
  });

  try {
    const safeTx = await safe.createTransaction({
      safeTransactionData
    });

    const txRes = await safe.executeTransaction(safeTx);
    const tx = txRes.transactionResponse;

    if (!tx) throw new Error('Could not submit transaction');

    return tx;
  } catch (err) {
    console.log(err);
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};

const buildRollCharacterTransactionData = async (
  distroDoc: Omit<InvoiceXpDistroDocument, '_id'>
) => {
  try {
    const characterMetadata: {
      name: string;
      description: string;
      image: string;
    } = {
      name: distroDoc.discordTag as string,
      description: '(no bio)',
      image: `ipfs://QmWxR5ghwhE9dF62Q1QwgQZqJSncmfE6XrDLetXwiFq6Wz`
    };

    const fileContents = Buffer.from(JSON.stringify(characterMetadata));

    const cid = await uploadToPinata(fileContents, 'characterMetadata.json');
    if (!cid) {
      throw new Error('Could not upload to IPFS');
    }

    const abi = parseAbi([
      'function rollCharacterSheet(address player,string calldata _tokenURI) external returns (uint256)'
    ]);

    const playerAddress = distroDoc.playerAddress as Address;

    const data = encodeFunctionData({
      abi,
      functionName: 'rollCharacterSheet',
      args: [playerAddress, cid]
    });

    const rollCharacterSheetTransactionData: SafeTransactionDataPartial = {
      to: RAIDGUILD_GAME_ADDRESS,
      data,
      value: '0'
    };

    return rollCharacterSheetTransactionData;
  } catch (err) {
    return null;
  }
};

export const rollCharacterSheets = async (
  client: ClientWithCommands,
  distroDocs: Omit<InvoiceXpDistroDocument, '_id'>[]
) => {
  const safe = await getNpcGnosisSafe();

  try {
    const safeTransactionData = await Promise.all(
      distroDocs.map(async distroDoc => {
        const txData = await buildRollCharacterTransactionData(distroDoc);
        return txData;
      })
    );

    if (safeTransactionData.includes(null)) {
      throw new Error('Could not build transaction data');
    }

    const safeTx = await safe.createTransaction({
      safeTransactionData: safeTransactionData as SafeTransactionDataPartial[]
    });

    const txRes = await safe.executeTransaction(safeTx);
    const tx = txRes.transactionResponse;

    if (!tx) throw new Error('Could not submit transaction');

    return tx;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};
