import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import axios from 'axios';
import {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { ethers } from 'ethers';
import { Address, encodeFunctionData, parseAbi } from 'viem';

import { ClientWithCommands } from '@/types';
import {
  CHARACTER_SHEETS_SUBGRAPH_URL,
  NPC_SAFE_ADDRESS,
  NPC_SAFE_OWNER_KEY,
  RAIDGUILD_GAME_ADDRESS,
  RPC_URL,
  XP_ADDRESS
} from '@/utils/constants';
import { logError } from '@/utils/logger';

if (!RAIDGUILD_GAME_ADDRESS || !CHARACTER_SHEETS_SUBGRAPH_URL) {
  throw new Error(
    'Missing envs RAIDGUILD_GAME_ADDRESS or CHARACTER_SHEETS_SUBGRAPH_URL'
  );
}

export const getCharacterAccountByPlayerAddress = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction,
  playerAddress: string
): Promise<string | null> => {
  try {
    const query = `
      query CharacterAccountQuery {
        characters(where: { game: "${RAIDGUILD_GAME_ADDRESS}", player: "${playerAddress}"}) {
          account
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

    const accountAddress = response.data.data.characters[0].account as
      | string
      | undefined;

    if (!accountAddress) {
      throw new Error(
        `ERROR: there is no character account address associated with that Discord handle`
      );
    }
    return accountAddress;
  } catch (err) {
    logError(
      client,
      interaction,
      err,
      'There was an error finding a character account address associated with that Discord handle in CharacterSheets!'
    );
    return null;
  }
};

if (!NPC_SAFE_ADDRESS || !NPC_SAFE_OWNER_KEY || !RPC_URL || !XP_ADDRESS) {
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

export const dropExp = async (
  client: ClientWithCommands,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction,
  accountAddress: string
) => {
  const safe = await getNpcGnosisSafe();

  const abi = parseAbi([
    'function dropExp(address character, uint256 amount) public'
  ]);

  const data = encodeFunctionData({
    abi,
    functionName: 'dropExp',
    args: [accountAddress as Address, BigInt(5)]
  });

  const dropExpTransactionData: SafeTransactionDataPartial = {
    to: XP_ADDRESS,
    data,
    value: '0'
  };

  try {
    const safeTx = await safe.createTransaction({
      safeTransactionData: dropExpTransactionData
    });

    const txRes = await safe.executeTransaction(safeTx);
    const tx = txRes.transactionResponse;

    if (!tx) throw new Error('Could not submit transaction');

    return tx;
  } catch (err) {
    logError(
      client,
      interaction,
      err,
      'There was an error finding a character account address associated with that Discord handle in CharacterSheets!'
    );
    return null;
  }
};
