import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { bscChain, BSC_RPC } from "./bsc.js";

export { bscChain };

export const wagmiConfig = createConfig({
  chains: [bscChain],

  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],

  transports: {
    [bscChain.id]: http(BSC_RPC),
  },

  multiInjectedProviderDiscovery: true,
});
