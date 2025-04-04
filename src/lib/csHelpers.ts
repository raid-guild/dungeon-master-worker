import Safe from '@safe-global/protocol-kit';
import { MetaTransactionData } from '@safe-global/safe-core-sdk-types';
import axios from 'axios';
import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { Address, encodeFunctionData, formatEther, parseAbi } from 'viem';

import { CHARACTER_SHEETS_CONFIG } from '@/config';
import { uploadToPinata } from '@/lib/pinata';
import { ClientWithCommands, InvoiceXpDistroDocument } from '@/types';
import {
  ENVIRONMENT,
  JESTER_TIP_AMOUNT,
  NPC_SAFE_OWNER_KEY
} from '@/utils/constants';
import { discordLogger, logError } from '@/utils/logger';

if (
  !CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress ||
  !CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.subgraphUrl
) {
  throw new Error('Missing gameAddress or subgraphUrl config variables');
}

export const getCharacterAccountsByPlayerAddresses = async (
  client: ClientWithCommands,
  discordTagToEthAddressMap: Record<string, string>,
  gameAddress: string,
  subgraphUrl: string,
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
        characters(where: { game: "${gameAddress}", player_in: ${JSON.stringify(
      formattedAddresses
    )}}) {
          account
          player
        }
      }
    `;

    const response = await axios({
      url: subgraphUrl,
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
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.npcSafeAddress &&
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.rpcUrl &&
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.xpAddress &&
    CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.classesAddress
  )
) {
  throw new Error(
    'Missing npcSafeAddress, rpcUrl, xpAddress, or classesAddress config variables'
  );
}

export const getNpcSafe = async (game: 'main' | 'cohort7') => {
  const provider = CHARACTER_SHEETS_CONFIG[ENVIRONMENT][game].rpcUrl;

  if (!NPC_SAFE_OWNER_KEY) {
    throw new Error('Missing env NPC_SAFE_OWNER_KEY');
  }

  const safe = await Safe.init({
    provider,
    signer: NPC_SAFE_OWNER_KEY,
    safeAddress: CHARACTER_SHEETS_CONFIG[ENVIRONMENT][game].npcSafeAddress
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

  const dropExpTransactionData: MetaTransactionData = {
    to: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.xpAddress,
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
  const safe = await getNpcSafe('main');

  const safeTransactionData = accountAddresses.map(accountAddress => {
    return buildDropExpTransactionData(accountAddress, amount);
  });

  try {
    const safeTx = await safe.createTransaction({
      transactions: safeTransactionData
    });

    const txRes = await safe.executeTransaction(safeTx);
    return txRes.hash;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};

const buildDropLootTransactionData = (
  game: 'main' | 'cohort7',
  accountAddresses: Address[],
  itemIds: bigint[][],
  amounts: bigint[][]
) => {
  const abi = parseAbi([
    'function dropLoot(address[] calldata characters, uint256[][] calldata itemIds, uint256[][] calldata amounts) external'
  ]);

  const data = encodeFunctionData({
    abi,
    functionName: 'dropLoot',
    args: [accountAddresses, itemIds, amounts]
  });

  const dropExpTransactionData: MetaTransactionData = {
    to: CHARACTER_SHEETS_CONFIG[ENVIRONMENT][game].itemsAddress,
    data,
    value: '0'
  };

  return dropExpTransactionData;
};

export const dropAttendanceBadges = async (
  client: ClientWithCommands,
  game: 'main' | 'cohort7',
  accountAddresses: Address[]
) => {
  const safe = await getNpcSafe(game);
  const itemIds = accountAddresses.map(() => [
    BigInt(CHARACTER_SHEETS_CONFIG[ENVIRONMENT][game].attendanceBadgeId)
  ]);
  const amounts = accountAddresses.map(() => [BigInt(1)]);

  const safeTransactionData = buildDropLootTransactionData(
    game,
    accountAddresses,
    itemIds,
    amounts
  );

  try {
    const safeTx = await safe.createTransaction({
      transactions: [safeTransactionData]
    });

    const txRes = await safe.executeTransaction(safeTx);
    return txRes.hash;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};

const buildGiveClassExpTransactionData = (
  accountAddress: Address,
  classId: string,
  amount: string
) => {
  try {
    const abi = parseAbi([
      'function giveClassExp(address characterAccount, uint256 classId, uint256 amountOfExp) public'
    ]);

    const data = encodeFunctionData({
      abi,
      functionName: 'giveClassExp',
      args: [accountAddress, BigInt(classId), BigInt(amount)]
    });

    const giveClassExpTransactionData: MetaTransactionData = {
      to: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.classesAddress,
      data,
      value: '0'
    };

    return giveClassExpTransactionData;
  } catch (err) {
    return null;
  }
};

export const giveClassExp = async (
  client: ClientWithCommands,
  accountAddresses: string,
  classId: string
) => {
  const safe = await getNpcSafe('main');

  try {
    const safeTransactionData = buildGiveClassExpTransactionData(
      accountAddresses as Address,
      classId,
      JESTER_TIP_AMOUNT
    );

    if (!safeTransactionData) {
      throw new Error('Could not build transaction data');
    }

    const safeTx = await safe.createTransaction({
      transactions: [safeTransactionData as MetaTransactionData]
    });

    const txRes = await safe.executeTransaction(safeTx);
    return txRes.hash;
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

export const giveClassExpWithDistro = async (
  client: ClientWithCommands,
  distroDocs: Omit<InvoiceXpDistroDocument, '_id'>[]
) => {
  const safe = await getNpcSafe('main');

  const safeTransactionData = distroDocs.map(distroDoc => {
    const accountAddress = distroDoc.accountAddress as Address;
    const classId = CLASS_KEY_TO_ID_MAP[distroDoc.classKey as string];
    const amount = formatEther(BigInt(distroDoc.amount));
    const amountAsInteger = Math.ceil(Number(amount));

    return buildGiveClassExpTransactionData(
      accountAddress,
      classId,
      amountAsInteger.toString()
    );
  });

  if (safeTransactionData.includes(null)) {
    throw new Error('Could not build transaction data');
  }

  try {
    const safeTx = await safe.createTransaction({
      transactions: safeTransactionData as MetaTransactionData[]
    });

    const txRes = await safe.executeTransaction(safeTx);
    return txRes.hash;
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

    const rollCharacterSheetTransactionData: MetaTransactionData = {
      to: CHARACTER_SHEETS_CONFIG[ENVIRONMENT].main.gameAddress,
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
  const safe = await getNpcSafe('main');

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
      transactions: safeTransactionData as MetaTransactionData[]
    });

    const txRes = await safe.executeTransaction(safeTx);
    return txRes.hash;
  } catch (err) {
    discordLogger(JSON.stringify(err), client);
    return null;
  }
};
