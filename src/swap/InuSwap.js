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

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

export const PANCAKESWAP_V2_ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint256 amountIn,address[] calldata path) view returns (uint256[] memory amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) payable returns (uint256[] memory amounts)",
  "function swapExactTokensForETH(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) returns (uint256[] memory amounts)",
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
    args: [owner, PANCAKESWAP_V2_ROUTER],
  });
}

export async function approveToken(provider, token, amount) {
  const walletClient = getWalletClient(provider);
  const [account] = await walletClient.getAddresses();

  return walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [PANCAKESWAP_V2_ROUTER, amount],
    account,
    chain: bscChain,
  });
}

export async function getQuote(amountIn, path) {
  return publicClient.readContract({
    address: PANCAKESWAP_V2_ROUTER,
    abi: PANCAKESWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountIn, path],
  });
}

export function calculateMinimumReceived(
  amountOut,
  slippageBps = 500n
) {
  const BPS = 10_000n;

  if (slippageBps < 0n || slippageBps >= BPS) {
    throw new Error("Invalid slippage.");
  }

  return (amountOut * (BPS - slippageBps)) / BPS;
}

export {
  bscChain,
  BSC_RPC,
  WBNB,
  PANCAKESWAP_V2_ROUTER,
};
