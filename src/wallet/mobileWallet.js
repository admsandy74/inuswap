import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { createEVMClient } from "@metamask/connect-evm";
import { OKXUniversalProvider } from "@okxconnect/universal-provider";
import { getProvider as getBinanceProvider } from "@binance/w3w-ethereum-provider";
import { Buffer } from "buffer";
import { openBinanceDeepLink } from "@binance/w3w-utils";

globalThis.Buffer = Buffer;
import {
  discoverInjectedWallets,
  getInjectedWallets,
} from "./wallet";

const BSC_CHAIN_ID = 56;
const BSC_RPC =
  "https://bsc-dataseed.binance.org";
const BSC_CHAIN_ID_HEX = "0x38";

const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;


let mobileProvider;

let trustProviderPromise = null;

function createTrustProvider() {
  if (!projectId) {
    return Promise.reject(
      new Error(
        "VITE_WALLETCONNECT_PROJECT_ID is not configured."
      )
    );
  }

  if (!trustProviderPromise) {
    trustProviderPromise = EthereumProvider.init({
      projectId,
      chains: [BSC_CHAIN_ID],
      rpcMap: {
        [BSC_CHAIN_ID]: BSC_RPC,
      },
      showQrModal: false,
      metadata: {
        name: "INUSWAP",
        description: "INUSWAP",
        url: "https://inuswap.vercel.app",
        icons: ["https://inuswap.vercel.app/favicon.ico"],
      },
      disableProviderPing: true,
    }).catch((error) => {
      trustProviderPromise = null;
      throw error;
    });
  }

  return trustProviderPromise;
}


let metamaskClient;

async function createMetaMaskClient() {
  if (metamaskClient) {
    return metamaskClient;
  }

  metamaskClient = await createEVMClient({
    dapp: {
      name: "INUSWAP",
      url: "https://inuswap.vercel.app",
    },
    api: {
      supportedNetworks: {
        "0x38": BSC_RPC,
      },
    },
    mobile: {
      useDeeplink: true,
      preferredOpenLink: (url) => {
        window.location.href = url;
      },
    },
    ui: {
      headless: true,
      showInstallModal: false,
    },
    skipAutoAnnounce: true,
  });

  return metamaskClient;
}

function normalizeOKXChainId(value) {
  if (typeof value === "number") {
    return value;
  }

  const text = String(value).trim();

  if (/^0x/i.test(text)) {
    return Number.parseInt(text, 16);
  }

  return Number(text);
}

function normalizeBinanceChainId(value) {
  if (typeof value === "number") {
    return value;
  }

  const text = String(value).trim();

  if (/^0x/i.test(text)) {
    return Number.parseInt(text, 16);
  }

  return Number(text);
}

async function connectMetaMaskMobile() {
  const client = await createMetaMaskClient();

  const result = await client.connect({
    chainIds: [BSC_CHAIN_ID_HEX],
  });

  const provider = client.getProvider();
  const accounts = result?.accounts?.length
    ? result.accounts
    : await provider.request({
        method: "eth_accounts",
      });

  let chainIdHex = await provider.request({
    method: "eth_chainId",
  });

  if (String(chainIdHex).toLowerCase() !== BSC_CHAIN_ID_HEX) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_ID_HEX }],
      });
    } catch (error) {
      if (error?.code !== 4902) {
        throw error;
      }

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BSC_CHAIN_ID_HEX,
          chainName: "BNB Smart Chain",
          nativeCurrency: {
            name: "BNB Smart Chain",
            symbol: "BNB",
            decimals: 18,
          },
          rpcUrls: [BSC_RPC],
          blockExplorerUrls: [
            "https://bscscan.com",
          ],
        }],
      });

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_ID_HEX }],
      });
    }

    chainIdHex = await provider.request({
      method: "eth_chainId",
    });
  }

  mobileProvider = provider;

  return {
    address: accounts?.[0],
    chainId: Number.parseInt(chainIdHex, 16),
    provider,
    walletType: "metamask",
  };
}

async function connectOKXMobile() {
  const provider = await OKXUniversalProvider.init({
    dappMetaData: {
      name: "INUSWAP",
      url: "https://inuswap.vercel.app",
      icon: "https://inuswap.vercel.app/assets/inuswap.png",
      description: "INUSWAP - Decentralized exchange on BNB Smart Chain",
    },
    openAppLinkType: "universallink",
  });

  const session = await provider.connect({
    namespaces: {
      eip155: {
        chains: ["eip155:1"],
        defaultChain: "eip155:1",
      },
    },
    optionalNamespaces: {
      eip155: {
        chains: [`eip155:${BSC_CHAIN_ID}`],
        rpcMap: {
          [`eip155:${BSC_CHAIN_ID}`]: BSC_RPC,
        },
      },
    },
  });

  let accounts = await provider.request({
    method: "eth_accounts",
    params: [],
  });

  if (!accounts?.length) {
    const sessionAccounts =
      session?.namespaces?.eip155?.accounts || [];

    accounts = sessionAccounts
      .map((account) => {
        const parts = String(account).split(":");
        return parts.length >= 3
          ? parts.slice(2).join(":")
          : null;
      })
      .filter(Boolean);
  }

  if (!accounts?.length) {
    throw new Error(
      "OKX Wallet connected, but no account was returned."
    );
  }

  const bscChain = `eip155:${BSC_CHAIN_ID}`;

  const sessionChains =
    session?.namespaces?.eip155?.chains || [];

  if (!sessionChains.includes(bscChain)) {
    await provider.request(
      {
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BSC_CHAIN_ID_HEX,
          chainName: "BNB Smart Chain",
          nativeCurrency: {
            name: "BNB Smart Chain",
            symbol: "BNB",
            decimals: 18,
          },
          rpcUrls: [BSC_RPC],
          blockExplorerUrls: [
            "https://bscscan.com",
          ],
        }],
      }
    );
  }

  provider.setDefaultChain(
    String(BSC_CHAIN_ID),
    BSC_RPC
  );

  const chainIdHex = await provider.request({
    method: "eth_chainId",
    params: [],
  });

  mobileProvider = provider;

  return {
    address: accounts[0],
    chainId: normalizeOKXChainId(chainIdHex),
    provider,
    walletType: "okx",
  };
}

async function connectBinanceMobile() {
  const injectedProvider =
    typeof window !== "undefined" &&
    window.ethereum?.isBinance === true
      ? window.ethereum
      : null;

  let provider =
    injectedProvider ||
    getBinanceProvider({
      chainId: BSC_CHAIN_ID,
      rpc: { [BSC_CHAIN_ID]: BSC_RPC },
      showQrCodeModal: false,
    });

  // Binance DApp Browser / injected provider.
  if (injectedProvider) {
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });

    if (!accounts?.length) {
      throw new Error(
        "Binance Wallet returned no account."
      );
    }

    const chainId = await provider.request({
      method: "eth_chainId",
    }).catch(() => BSC_CHAIN_ID);

    mobileProvider = provider;

    return {
      address: accounts[0],
      provider,
      chainId: normalizeBinanceChainId(chainId),
      walletType: "binance",
    };
  }

  let uriOpened = false;

  provider.on?.("uri_ready", (uri) => {
    if (!uri || uriOpened) return;

    uriOpened = true;
    openBinanceDeepLink(uri);
  });

  // Existing Binance session.
  try {
    const existingAccounts = await provider.request({
      method: "eth_accounts",
    });

    if (existingAccounts?.length) {
      const chainId = await provider.request({
        method: "eth_chainId",
      }).catch(() => BSC_CHAIN_ID);

      mobileProvider = provider;

      return {
        address: existingAccounts[0],
        provider,
        chainId: normalizeBinanceChainId(chainId),
        walletType: "binance",
      };
    }
  } catch {}

  let sessionResult = null;
  let connectError = null;
  let resolved = false;

  const checkSession = async () => {
    if (resolved) return;

    try {
      const accounts = await provider.request({
        method: "eth_accounts",
      });

      if (accounts?.length) {
        const chainId = await provider.request({
          method: "eth_chainId",
        }).catch(() => BSC_CHAIN_ID);

        sessionResult = {
          address: accounts[0],
          provider,
          chainId: normalizeBinanceChainId(chainId),
          walletType: "binance",
        };

        resolved = true;
        return;
      }
    } catch {}

    // Recreate the Binance provider so the SDK can
    // re-hydrate an approved WalletConnect session.
    try {
      const restoredProvider = getBinanceProvider({
        chainId: BSC_CHAIN_ID,
        rpc: { [BSC_CHAIN_ID]: BSC_RPC },
        showQrCodeModal: false,
      });

      const accounts = await restoredProvider.request({
        method: "eth_accounts",
      }).catch(() => []);

      if (accounts?.length) {
        const chainId = await restoredProvider.request({
          method: "eth_chainId",
        }).catch(() => BSC_CHAIN_ID);

        provider = restoredProvider;

        sessionResult = {
          address: accounts[0],
          provider,
          chainId: normalizeBinanceChainId(chainId),
          walletType: "binance",
        };

        resolved = true;
      }
    } catch {}
  };

  // Listen for the provider event that should fire when
  // Binance makes the approved account available.
  provider.on?.(
    "accountsChanged",
    async (accounts) => {
      if (!accounts?.length || resolved) return;

      const chainId = await provider.request({
        method: "eth_chainId",
      }).catch(() => BSC_CHAIN_ID);

      sessionResult = {
        address: accounts[0],
        provider,
        chainId: normalizeBinanceChainId(chainId),
        walletType: "binance",
      };

      resolved = true;
    }
  );

  // Start connection WITHOUT blocking on provider.connect().
  const connectPromise = provider
    .connect(BSC_CHAIN_ID)
    .catch((error) => {
      connectError = error;
    });

  const deadline = Date.now() + 20000;

  while (!resolved && Date.now() < deadline) {
    await checkSession();

    if (resolved) break;

    await new Promise((resolve) =>
      setTimeout(resolve, 300)
    );
  }

  // Let the SDK finish its own connection promise.
  await connectPromise;

  // One final account check after connect() resolves.
  if (!resolved) {
    await checkSession();
  }

  if (sessionResult?.address) {
    mobileProvider = sessionResult.provider;

    return sessionResult;
  }

  if (connectError) {
    throw connectError;
  }

  throw new Error(
    "Binance Wallet connection timed out. Please try again."
  );
}

async function connectTrustWalletMobile() {
  if (!projectId) {
    throw new Error(
      "VITE_WALLETCONNECT_PROJECT_ID is not configured."
    );
  }

  const provider = await EthereumProvider.init({
    projectId,
    chains: [BSC_CHAIN_ID],
    rpcMap: {
      [BSC_CHAIN_ID]: BSC_RPC,
    },
    showQrModal: false,
    metadata: {
      name: "INUSWAP",
      description: "INUSWAP",
      url: "https://inuswap.vercel.app",
      icons: ["https://inuswap.vercel.app/favicon.ico"],
    },
    disableProviderPing: true,
  });

  let openedTrust = false;

  provider.on("display_uri", (uri) => {
    if (openedTrust) return;
    openedTrust = true;

    const trustUrl =
      "https://link.trustwallet.com/wc?uri=" +
      encodeURIComponent(uri);

    window.location.href = trustUrl;
  });

  await provider.connect({
    chains: [BSC_CHAIN_ID],
  });

  let accounts = await provider.request({
    method: "eth_accounts",
  });

  if (!accounts?.length) {
    const sessionAccounts =
      provider?.session?.namespaces?.eip155?.accounts || [];

    accounts = sessionAccounts
      .map((account) => {
        const parts = account.split(":");
        return parts.length >= 3
          ? parts.slice(2).join(":")
          : null;
      })
      .filter(Boolean);
  }

  if (!accounts?.length) {
    throw new Error(
      "Trust Wallet connected, but no account was returned."
    );
  }

  let chainIdHex = await provider.request({
    method: "eth_chainId",
  });

  if (
    String(chainIdHex).toLowerCase() !==
    BSC_CHAIN_ID_HEX
  ) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_ID_HEX }],
      });
    } catch (error) {
      if (error?.code !== 4902) {
        throw error;
      }

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BSC_CHAIN_ID_HEX,
          chainName: "BNB Smart Chain",
          nativeCurrency: {
            name: "BNB Smart Chain",
            symbol: "BNB",
            decimals: 18,
          },
          rpcUrls: [BSC_RPC],
          blockExplorerUrls: [
            "https://bscscan.com",
          ],
        }],
      });

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_ID_HEX }],
      });
    }

    chainIdHex = await provider.request({
      method: "eth_chainId",
    });
  }

  mobileProvider = provider;

  return {
    address: accounts[0],
    chainId: Number.parseInt(chainIdHex, 16),
    provider,
    walletType: "trust",
  };
}

export async function restoreMobileWalletSession(
  savedWalletType,
  savedAddress
) {
  if (!savedWalletType || !savedAddress) {
    return null;
  }

  const target = String(savedAddress).toLowerCase();

  // Binance Wallet restore.
  // DApp Browser: reuse injected Binance provider.
  // Chrome/mobile browser: recreate Binance WalletConnect provider
  // without calling connect(), so an existing session can be restored.
  if (savedWalletType === "binance") {
    try {
      const injectedProvider =
        typeof window !== "undefined" &&
        window.ethereum?.isBinance === true
          ? window.ethereum
          : null;

      const provider =
        injectedProvider ||
        getBinanceProvider({
          chainId: BSC_CHAIN_ID,
          rpc: {
            [BSC_CHAIN_ID]: BSC_RPC,
          },
          showQrCodeModal: false,
        });

      const accounts = await provider.request({
        method: "eth_accounts",
      }).catch(() => []);

      const matchingAddress = accounts?.find(
        (account) =>
          String(account).toLowerCase() === target
      );

      if (matchingAddress) {
        let chainId = await provider.request({
          method: "eth_chainId",
        });

        const normalizeBinanceChainId = (value) => {
          if (typeof value === "number") {
            return value;
          }

          const text = String(value).trim();

          if (/^0x/i.test(text)) {
            return Number.parseInt(text, 16);
          }

          return Number(text);
        };

        let chainIdNumber = normalizeBinanceChainId(chainId);

        if (chainIdNumber !== BSC_CHAIN_ID) {
          try {
            await provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: BSC_CHAIN_ID_HEX }],
            });
          } catch (error) {
            if (error?.code !== 4902) {
              throw error;
            }

            await provider.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: BSC_CHAIN_ID_HEX,
                chainName: "BNB Smart Chain",
                nativeCurrency: {
                  name: "BNB Smart Chain",
                  symbol: "BNB",
                  decimals: 18,
                },
                rpcUrls: [BSC_RPC],
                blockExplorerUrls: [
                  "https://bscscan.com",
                ],
              }],
            });

            await provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: BSC_CHAIN_ID_HEX }],
            });
          }

          chainId = await provider.request({
            method: "eth_chainId",
          });

          chainIdNumber = normalizeBinanceChainId(chainId);
        }

        if (chainIdNumber === BSC_CHAIN_ID) {
          mobileProvider = provider;

          return {
            address: matchingAddress,
            chainId: chainIdNumber,
            provider,
            walletType: "binance",
          };
        }
      }
    } catch (error) {
      console.warn(
        "[INUSWAP] Binance Wallet mobile restore skipped:",
        error?.message || error
      );
    }
  }

  // Trust / WalletConnect restore.
  if (
    savedWalletType === "trust" ||
    savedWalletType === "reown"
  ) {
    try {
      if (projectId) {
        const provider = await EthereumProvider.init({
          projectId,
          chains: [BSC_CHAIN_ID],
          rpcMap: {
            [BSC_CHAIN_ID]: BSC_RPC,
          },
          showQrModal: false,
          metadata: {
            name: "INUSWAP",
            description: "INUSWAP",
            url: "https://inuswap.vercel.app",
            icons: ["https://inuswap.vercel.app/favicon.ico"],
          },
          disableProviderPing: true,
        });


        const requestedAccounts = await provider.request({
          method: "eth_accounts",
        }).catch(() => []);


        const providerAccounts = Array.isArray(provider.accounts)
          ? provider.accounts
          : [];

        const namespaces =
          provider?.session?.namespaces || {};

        const sessionAccounts = Object.entries(namespaces)
          .filter(([namespace]) =>
            String(namespace).startsWith("eip155")
          )
          .flatMap(([, namespaceData]) =>
            Array.isArray(namespaceData?.accounts)
              ? namespaceData.accounts
              : []
          );

        const sessionAddresses = sessionAccounts
          .map((account) => {
            const parts = String(account).split(":");
            return parts.length >= 3
              ? parts.slice(2).join(":")
              : null;
          })
          .filter(Boolean);

        const accounts = [
          ...requestedAccounts,
          ...providerAccounts,
          ...sessionAddresses,
        ];

        const matchingAddress = accounts.find(
          (account) =>
            String(account).toLowerCase() === target
        );

        if (matchingAddress) {
          let chainIdHex = await provider.request({
            method: "eth_chainId",
          });

          if (
            String(chainIdHex).toLowerCase() !==
            BSC_CHAIN_ID_HEX
          ) {
            try {
              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [
                  {
                    chainId: BSC_CHAIN_ID_HEX,
                  },
                ],
              });
            } catch (error) {
              if (error?.code !== 4902) {
                throw error;
              }

              await provider.request({
                method: "wallet_addEthereumChain",
                params: [{
                  chainId: BSC_CHAIN_ID_HEX,
                  chainName: "BNB Smart Chain",
                  nativeCurrency: {
                    name: "BNB Smart Chain",
                    symbol: "BNB",
                    decimals: 18,
                  },
                  rpcUrls: [BSC_RPC],
                  blockExplorerUrls: [
                    "https://bscscan.com",
                  ],
                }],
              });

              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [
                  {
                    chainId: BSC_CHAIN_ID_HEX,
                  },
                ],
              });
            }

            chainIdHex = await provider.request({
              method: "eth_chainId",
            });
          }

          mobileProvider = provider;

          return {
            address: matchingAddress,
            chainId: String(chainIdHex).toLowerCase(),
            provider,
            walletType: savedWalletType,
          };
        }
      }
    } catch (error) {
      console.warn(
        "[INUSWAP] WalletConnect mobile restore skipped:",
        error?.message || error
      );
    }
  }

  // OKX Wallet mobile restore.
  if (savedWalletType === "okx") {
    try {
      const provider = await OKXUniversalProvider.init({
        dappMetaData: {
          name: "INUSWAP",
          url: "https://inuswap.vercel.app",
          icon: "https://inuswap.vercel.app/assets/inuswap.png",
          description:
            "INUSWAP - Decentralized exchange on BNB Smart Chain",
        },
        openAppLinkType: "universallink",
      });

      await provider.tryToReconnect();

      provider.setDefaultChain(
        String(BSC_CHAIN_ID),
        BSC_RPC
      );

      const accounts = await provider.request({
        method: "eth_accounts",
        params: [],
      });

      const matchingAddress = accounts?.find(
        (account) =>
          String(account).toLowerCase() === target
      );

      if (matchingAddress) {
        const chainIdHex = await provider.request({
          method: "eth_chainId",
          params: [],
        });

        mobileProvider = provider;

        return {
          address: matchingAddress,
          chainId: normalizeOKXChainId(chainIdHex),
          provider,
          walletType: "okx",
        };
      }
    } catch (error) {
      console.warn(
        "[INUSWAP] OKX Wallet mobile restore skipped:",
        error?.message || error
      );
    }
  }

  // OKX Wallet mobile restore.
  if (savedWalletType === "okx") {
    try {
      const provider = await OKXUniversalProvider.init({
        dappMetaData: {
          name: "INUSWAP",
          url: "https://inuswap.vercel.app",
          icon: "https://inuswap.vercel.app/assets/inuswap.png",
          description:
            "INUSWAP - Decentralized exchange on BNB Smart Chain",
        },
        openAppLinkType: "universallink",
      });

      await provider.tryToReconnect();

      provider.setDefaultChain(
        String(BSC_CHAIN_ID),
        BSC_RPC
      );

      const accounts = await provider.request({
        method: "eth_accounts",
        params: [],
      });

      const matchingAddress = accounts?.find(
        (account) =>
          String(account).toLowerCase() === target
      );

      if (matchingAddress) {
        provider.setDefaultChain(
          String(BSC_CHAIN_ID),
          BSC_RPC
        );

        const chainIdHex = await provider.request({
          method: "eth_chainId",
          params: [],
        });

        mobileProvider = provider;

        return {
          address: matchingAddress,
          chainId: normalizeOKXChainId(chainIdHex),
          provider,
          walletType: "okx",
        };
      }
    } catch (error) {
      console.warn(
        "[INUSWAP] OKX Wallet mobile restore skipped:",
        error?.message || error
      );
    }
  }

  // MetaMask Mobile SDK restore.
  if (savedWalletType === "metamask") {
    try {
      const client = await createMetaMaskClient();
      const provider = client.getProvider();

      const accounts = await provider.request({
        method: "eth_accounts",
      });

      const matchingAddress = accounts?.find(
        (account) =>
          String(account).toLowerCase() === target
      );

      if (matchingAddress) {
        const chainIdHex = await provider.request({
          method: "eth_chainId",
        });

        mobileProvider = provider;

        return {
          address: matchingAddress,
          chainId: Number.parseInt(
            String(chainIdHex),
            16
          ),
          provider,
          walletType: "metamask",
        };
      }
    } catch (error) {
      console.warn(
        "[INUSWAP] MetaMask mobile restore skipped:",
        error?.message || error
      );
    }
  }

  return null;
}

function createReownProvider() {
  if (!projectId) {
    throw new Error(
      "VITE_WALLETCONNECT_PROJECT_ID is not configured."
    );
  }

  return EthereumProvider.init({
    projectId,
    chains: [BSC_CHAIN_ID],
    rpcMap: {
      [BSC_CHAIN_ID]: BSC_RPC,
    },
    showQrModal: true,
    metadata: {
      name: "INUSWAP",
      description: "INUSWAP",
      url: "https://inuswap.vercel.app",
      icons: ["https://inuswap.vercel.app/favicon.ico"],
    },
  });
}

export async function connectMobileWallet() {
  const provider = await createReownProvider();

  await provider.connect({
    chains: [BSC_CHAIN_ID],
  });

  const accounts = await provider.request({
    method: "eth_accounts",
  });

  const chainIdHex = await provider.request({
    method: "eth_chainId",
  });

  mobileProvider = provider;

  return {
    address: accounts?.[0],
    chainId: Number.parseInt(chainIdHex, 16),
    provider,
    walletType: "reown",
  };
}

export async function connectSpecificMobileWallet(walletId) {
  if (walletId === "metamask") {
    return connectMetaMaskMobile();
  }

  if (walletId === "trust") {
    return connectTrustWalletMobile();
  }

  if (walletId === "rabby") {
    return connectOKXMobile();
  }

  if (walletId === "binance") {
    return connectBinanceMobile();
  }

  throw new Error(
    `${walletId} mobile connection is not configured yet. Use More Wallets.`
  );
}

export async function disconnectMobileWallet() {
  if (!mobileProvider) return;

  try {
    await mobileProvider.disconnect();
  } catch (error) {
    console.warn(
      "Mobile wallet disconnect failed:",
      error?.message || error
    );
  }
}

export function isMobileWalletConfigured() {
  return Boolean(projectId);
}
