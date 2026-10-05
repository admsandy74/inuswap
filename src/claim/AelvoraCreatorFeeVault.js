import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatEther,
} from "viem";

export const ROBINHOOD_CHAIN_ID = 0x1237;

export const ROBINHOOD_CHAIN = {
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.chain.robinhood.com"],
    },
  },
};

export const CREATOR_FEE_VAULT =
  "0xbDED008bFd10719fa57e199dB270457d70a93714";

export const CREATOR_FEE_VAULT_ABI = [
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "canClaim",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "amount", type: "uint256" },
      { name: "nextClaimAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "lastClaimAt",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "creatorRewards",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vaultBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "CreatorRewardsClaimed",
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "token",
        type: "address",
      },
      {
        indexed: true,
        name: "creator",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
    ],
  },
];

export const publicClient = createPublicClient({
  chain: ROBINHOOD_CHAIN,
  transport: http("/rpc"),
});

export function getWalletClient(provider) {
  if (!provider) {
    throw new Error("Wallet provider is not available.");
  }

  return createWalletClient({
    chain: ROBINHOOD_CHAIN,
    transport: custom(provider),
  });
}

export async function getClaimStats(token, creator) {
  const latestBlock = await publicClient.getBlockNumber();

  // Safe global starting point: the first known Aelvora Factory
  // token creation event. The CreatorFeeVault was already active
  // before this block and all current/future tokens are created after it.
  const HISTORY_START_BLOCK = 68668226n;

  const claimedEvent = {
    type: "event",
    name: "CreatorRewardsClaimed",
    inputs: [
      {
        indexed: true,
        name: "token",
        type: "address",
      },
      {
        indexed: true,
        name: "creator",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
    ],
  };

  try {
    const logs = await publicClient.getLogs({
      address: CREATOR_FEE_VAULT,
      event: claimedEvent,
      args: {
        token,
        creator,
      },
      fromBlock: HISTORY_START_BLOCK,
      toBlock: latestBlock,
    });

    let totalClaimed = 0n;

    for (const log of logs) {
      totalClaimed += log.args.amount || 0n;
    }

    return {
      totalClaimed,
    };
  } catch (error) {
    console.error(
      "[AELVORA CLAIM] CreatorRewardsClaimed logs failed:",
      error
    );

    return {
      totalClaimed: 0n,
    };
  }
}

export { formatEther };
