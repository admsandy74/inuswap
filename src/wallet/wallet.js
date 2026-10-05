let activeWalletProvider = null;

export function setActiveWalletProvider(provider) {
  activeWalletProvider = provider || null;
}

export function getActiveWalletProvider() {
  return activeWalletProvider;
}

export function clearActiveWalletProvider() {
  activeWalletProvider = null;
}

export function getInjectedWallets() {
  if (typeof window === "undefined") return [];

  const wallets = new Map();

  function addProvider(detail) {
    if (!detail?.provider) return;

    const info = detail.info || {};
    const rdns = String(info.rdns || "").toLowerCase();
    const name = String(info.name || "").toLowerCase();

    // Phantom is not used by INUSWAP.
    if (
      rdns.includes("phantom") ||
      name.includes("phantom")
    ) {
      return;
    }

    const id =
      info.rdns ||
      info.uuid ||
      info.name ||
      "injected";

    if (wallets.has(id)) return;

    wallets.set(id, {
      id,
      name: info.name || "Browser Wallet",
      icon: info.icon || "",
      provider: detail.provider,
    });
  }

  // EIP-6963 providers.
  if (Array.isArray(window.__inuswapWalletProviders)) {
    for (const detail of window.__inuswapWalletProviders) {
      addProvider(detail);
    }
  }

  // Legacy injected provider.
  // Fallback only if no provider has been detected through EIP-6963.
  if (window.ethereum) {
    const alreadyDetected = Array.from(wallets.values()).some(
      (wallet) => wallet.provider === window.ethereum
    );

    if (!alreadyDetected) {
      addProvider({
        info: {
          rdns: "legacy.injected",
          name: "Browser Wallet",
          icon: "",
        },
        provider: window.ethereum,
      });
    }
  }

  const priority = {
    "io.metamask": 1,
    "io.rabby": 2,
    "com.okex.wallet": 3,
    "org.hot-labs": 4,
  };

  return Array.from(wallets.values()).sort((a, b) => {
    const aRdns = String(a.id || "").toLowerCase();
    const bRdns = String(b.id || "").toLowerCase();

    const aPriority = priority[aRdns] ?? 999;
    const bPriority = priority[bRdns] ?? 999;

    return aPriority - bPriority;
  });
}

export function discoverInjectedWallets() {
  if (typeof window === "undefined") return [];

  if (!window.__inuswapWalletProviders) {
    window.__inuswapWalletProviders = [];
  }

  const providers = window.__inuswapWalletProviders;

  function announce(detail) {
    if (!detail?.provider) return;

    const info = detail.info || {};
    const rdns = String(info.rdns || "").toLowerCase();
    const name = String(info.name || "").toLowerCase();

    // INUSWAP only uses the required EVM wallets.
    // Do not include Phantom, Nightly, or SubWallet.
    if (
      rdns.includes("phantom") ||
      name.includes("phantom") ||
      rdns.includes("nightly") ||
      name.includes("nightly") ||
      rdns.includes("subwallet") ||
      name.includes("subwallet")
    ) {
      return;
    }

    const exists = providers.some(
      (item) =>
        item?.provider === detail.provider ||
        (
          item?.info?.rdns &&
          info.rdns &&
          item.info.rdns === info.rdns
        )
    );

    if (!exists) {
      providers.push(detail);
    }
  }

  // Install the listener only once.
  if (!window.__inuswapWalletListenerInstalled) {
    window.addEventListener(
      "eip6963:announceProvider",
      (event) => {
        announce(event.detail);
      }
    );

    window.__inuswapWalletListenerInstalled = true;
  }

  // Request all EIP-6963 wallets to announce their providers.
  window.dispatchEvent(
    new Event("eip6963:requestProvider")
  );

  return providers;
}

export const BSC_CHAIN_ID = "0x38";

export async function getWalletChainId(provider) {
  if (!provider) return null;

  try {
    return await provider.request({
      method: "eth_chainId",
    });
  } catch (err) {
    console.warn(
      "Unable to detect wallet chain:",
      err?.message || err
    );
    return null;
  }
}

export async function switchToBscChain(provider) {
  if (!provider) {
    throw new Error("Wallet provider not found.");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: BSC_CHAIN_ID,
        },
      ],
    });
  } catch (err) {
    // 4902 = chain is not registered in the wallet
    if (err?.code !== 4902) {
      throw err;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BSC_CHAIN_ID,
          chainName: "BNB Smart Chain",
          nativeCurrency: {
            name: "BNB",
            symbol: "BNB",
            decimals: 18,
          },
          rpcUrls: [
            "https://bsc-dataseed.binance.org",
          ],
          blockExplorerUrls: [
            "https://bscscan.com",
          ],
        },
      ],
    });
  }

  return await getWalletChainId(provider);
}

export async function getWalletBalance(provider, address) {
  if (!provider || !address) return null;

  try {
    const balance = await provider.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });

    if (!balance) return null;

    const wei = BigInt(balance);
    const whole = wei / 1000000000000000000n;
    const fraction = wei % 1000000000000000000n;

    const fractionText = fraction
      .toString()
      .padStart(18, "0")
      .slice(0, 6);

    return `${whole}.${fractionText}`;
  } catch (err) {
    console.warn(
      "Unable to detect wallet balance:",
      err?.message || err
    );
    return null;
  }
}

export async function connectWallet(provider) {
  if (!provider) {
    throw new Error("Wallet provider not found.");
  }

  // ALWAYS request accounts from the selected provider.
  const accounts = await provider.request({
    method: "eth_requestAccounts",
  });

  return accounts?.[0] ?? null;
}

export async function disconnectWallet(provider) {
  if (!provider) {
    return false;
  }

  // OKX injected EVM provider memiliki disconnect()
  // itself. Do not use wallet_revokePermissions
  // for OKX because that method is not available.
  if (
    provider.isOKExWallet ||
    provider.isOkxWallet
  ) {
    try {
      await provider.disconnect();
      return true;
    } catch (err) {
      console.warn(
        "OKX disconnect failed:",
        err?.message || err
      );
      return false;
    }
  }

  // Wallet lain tetap menggunakan EIP-2255
  // jika memang didukung oleh provider.
  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });

    return true;
  } catch (err) {
    console.warn(
      "wallet_revokePermissions unavailable:",
      err?.message || err
    );

    return false;
  }
}
