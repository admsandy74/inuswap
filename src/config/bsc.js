import { defineChain } from "viem";

export const BSC_CHAIN_ID = 56;
export const BSC_CHAIN_ID_HEX = "0x38";

export const BSC_RPC = "https://bsc-dataseed.binance.org";

export const bscChain = defineChain({
  id: BSC_CHAIN_ID,
  name: "BNB Smart Chain",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [BSC_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: "BscScan",
      url: "https://bscscan.com",
    },
  },
});

export const WBNB =
  "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export const PANCAKESWAP_V2_ROUTER =
  "0x10ED43C718714eb63d5aA57B78B54704E256024E";

export const PANCAKESWAP_V2_FACTORY =
  "0xCA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
