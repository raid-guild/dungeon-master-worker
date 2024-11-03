import { NPC_SAFE_OWNER_KEY } from 'utils/constants';
import { base, gnosis, sepolia } from 'viem/chains';

type GameConfig = {
  attendanceBadgeId: number;
  chainId: number;
  classesAddress: string;
  explorerUrl: string;
  gameAddress: string;
  itemsAddress: string;
  npcSafeAddress: string;
  npcSafeOwnerKey: string;
  rpcUrl: string;
  subgraphUrl: string;
  xpAddress: string;
};

type CharacterSheetsConfig = {
  prod: {
    main: GameConfig;
    cohort7: GameConfig;
  };
  dev: {
    main: GameConfig;
    cohort7: GameConfig;
  };
};

export const EXPLORER_URLS: { [key: number]: string } = {
  [base.id]: 'https://basescan.org',
  [gnosis.id]: 'https://gnosisscan.io',
  [sepolia.id]: 'https://sepolia.etherscan.io'
};

export const DEFAULT_PC_URLS: { [key: number]: string } = {
  [base.id]: 'https://mainnet.base.org',
  [gnosis.id]: 'https://rpc.gnosis.gateway.fm',
  [sepolia.id]: 'https://rpc.sepolia.org'
};

export const SUBGRAPH_URLS: { [key: number]: string } = {
  [base.id]:
    'https://api.studio.thegraph.com/query/71457/character-sheets-base/version/latest',
  [gnosis.id]:
    'https://api.studio.thegraph.com/query/71457/character-sheets-gnosis/version/latest',
  [sepolia.id]:
    'https://api.studio.thegraph.com/query/71457/character-sheets-sepolia/version/latest'
};

export const CHARACTER_SHEETS_CONFIG: CharacterSheetsConfig = {
  prod: {
    main: {
      attendanceBadgeId: 32,
      chainId: gnosis.id,
      classesAddress: '0x34bf1f77e0bc755fb931366da91fff2907048984',
      explorerUrl: EXPLORER_URLS[gnosis.id],
      gameAddress: '0x124a99898c87dcb7cb9cf5f55617d5cc351e1cb7',
      itemsAddress: '0xfac1fb05c628880dd5e6ebe891307fecf1cbb500',
      npcSafeAddress: '0x670Cc349f12d1D046475d68d2b86AffC17241615',
      npcSafeOwnerKey: NPC_SAFE_OWNER_KEY,
      rpcUrl: DEFAULT_PC_URLS[gnosis.id],
      subgraphUrl: SUBGRAPH_URLS[gnosis.id],
      xpAddress: '0x6804878baf5ec52e0bc636b923f543a6d2f25724'
    },
    cohort7: {
      attendanceBadgeId: 1,
      chainId: base.id,
      classesAddress: '0x84b8f54a32dad47756e5fe5684b5e42a2f5fd803',
      explorerUrl: EXPLORER_URLS[base.id],
      gameAddress: '0xc0533928955cb4dbd7723ccf27a613f791f6d0b1',
      itemsAddress: '0x44d0f6f31940603de049d8aa7507139b88dce781',
      npcSafeAddress: '0xfC77f3Dd891093a049235afdAe236ab282dA64d6',
      npcSafeOwnerKey: NPC_SAFE_OWNER_KEY,
      rpcUrl: DEFAULT_PC_URLS[base.id],
      subgraphUrl: SUBGRAPH_URLS[base.id],
      xpAddress: '0xc16c7de522fe950ab3870e6ad41d693bff455e9a'
    }
  },
  dev: {
    main: {
      attendanceBadgeId: 1,
      chainId: sepolia.id,
      classesAddress: '0x05fd2e98c86ea7d406136ab9c15d39107b2ce9ef',
      explorerUrl: EXPLORER_URLS[sepolia.id],
      gameAddress: '0xfa93cd1a7f4848808cf9f83f20a9a7a431a51ae0',
      itemsAddress: '0xe0262402890cee9b6021264cd101db2b3f9edd94',
      npcSafeAddress: '0x97044aDC639c344e14F8808167caC0A4456F756F',
      npcSafeOwnerKey: NPC_SAFE_OWNER_KEY,
      rpcUrl: DEFAULT_PC_URLS[sepolia.id],
      subgraphUrl: SUBGRAPH_URLS[sepolia.id],
      xpAddress: '0x829446090b8492357785aa0ee9136161ff4a9d07'
    },
    cohort7: {
      attendanceBadgeId: 1,
      chainId: sepolia.id,
      classesAddress: '0x30e01b490cad64fd3653749c2a4b1654aa444026',
      explorerUrl: EXPLORER_URLS[sepolia.id],
      gameAddress: '0xe0677ce79b586c15a48d033e2aef25a5dc06aba2',
      itemsAddress: '0xac19a1afc1c1ea188ab30b2e7393d6c5c0e97b45',
      npcSafeAddress: '0x97044aDC639c344e14F8808167caC0A4456F756F',
      npcSafeOwnerKey: NPC_SAFE_OWNER_KEY,
      rpcUrl: DEFAULT_PC_URLS[sepolia.id],
      subgraphUrl: SUBGRAPH_URLS[sepolia.id],
      xpAddress: '0xa5096054c3f127a5c7cbf75293080c09e6bd623c'
    }
  }
};
