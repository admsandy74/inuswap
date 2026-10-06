import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
} from "viem";

import {
  bscChain,
  BSC_RPC,
  WBNB,
  PANCAKESWAP_V2_ROUTER,
} from "../config/bsc.js";

export const TAX_ROUTER_ADDRESS =
  "0xEB129cc301c2e08D9fbf7978E4465e50A9cC3714";

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

export const TAX_ROUTER_ABI = parseAbi([
  "function taxAmount(uint256) pure returns (uint256)",
  "function getAmountsOutAfterTax(uint256,address[]) view returns (uint256,uint256,uint256,uint256[])",
  "function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256,uint256,address[],address,uint256) returns (uint256[])",
]);

export const publicClient = createPublicClient({
  chain: bscChain,
  transport: http(BSC_RPC),
});

export function getWalletClient(provider) {
  if (!provider) {
    throw new Error("Wallet provider is not available.");
  }

  return createWalletClient({
    chain: bscChain,
    transport: custom(provider),
  });
}

export async function getTokenMetadata(token) {
  const [name, symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "name",
    }),
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
  ]);

  return {
    name,
    symbol,
    decimals: Number(decimals),
  };
}

export async function getTokenBalance(token, account) {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account],
  });
}

export async function getTokenAllowance(token, owner) {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, TAX_ROUTER_ADDRESS],
  });
}

export async function approveToken(provider, token, amount) {
  const walletClient = getWalletClient(provider);
  const [account] = await walletClient.getAddresses();

  return walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [TAX_ROUTER_ADDRESS, amount],
    account,
    chain: bscChain,
  });
}

export async function getQuoteAfterTax(amountIn, path) {
  return publicClient.readContract({
    address: TAX_ROUTER_ADDRESS,
    abi: TAX_ROUTER_ABI,
    functionName: "getAmountsOutAfterTax",
    args: [amountIn, path],
  });
}

export function calculateMinimumReceived(
  amountOut,
  slippageBps = 500n
) {
  const BPS = 10000n;

  if (
    slippageBps < 0n ||
    slippageBps >= BPS
  ) {
    throw new Error("Invalid slippage.");
  }

  return (
    amountOut *
    (BPS - slippageBps)
  ) / BPS;
}

export {
  bscChain,
  BSC_RPC,
  WBNB,
  PANCAKESWAP_V2_ROUTER,
};
