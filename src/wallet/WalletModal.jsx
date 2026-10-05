import { useEffect, useRef, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  discoverInjectedWallets,
  getInjectedWallets,
  getWalletChainId,
  setActiveWalletProvider,
  getActiveWalletProvider,
  clearActiveWalletProvider,
} from "./wallet";
import {
  connectMobileWallet,
  disconnectMobileWallet,
  isMobileWalletConfigured,
} from "./mobileWallet";
import MobileWalletPicker from "./MobileWalletPicker";
import "./wallet.css";

function isMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent || ""
  );
}

export default function WalletModal({
  onClose,
  onConnected,
  onDisconnected,
}) {
  const [wallets, setWallets] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const activeProviderRef = useRef(null);
  const mobileWalletRef = useRef(false);

  useEffect(() => {
    discoverInjectedWallets();

    const existingProvider = getActiveWalletProvider();

    if (existingProvider) {
      activeProviderRef.current = existingProvider;
    }

    setError("");

    const refreshWallets = async () => {
      const detected = getInjectedWallets();
      setWallets(detected);

      const provider =
        getActiveWalletProvider();

      if (provider) {
        try {
          const accounts =
            await provider.request({
              method: "eth_accounts",
            });

          const address =
            accounts?.[0] ?? null;

          if (address) {
            setConnectedAddress(address);
          }
        } catch {}
      }
    };

    refreshWallets();

    const timer = setTimeout(
      refreshWallets,
      300
    );

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const activeProvider = activeProviderRef.current;

    if (!activeProvider) return;

    const handleAccountsChanged = (accounts) => {
      const address = accounts?.[0] ?? null;

      setConnectedAddress(address);

      if (onConnected) {
        onConnected(address, undefined, undefined);
      }

      if (!address && onDisconnected) {
        onDisconnected();
      }
    };

    const handleChainChanged = () => {
      activeProvider
        .request({
          method: "eth_accounts",
        })
        .then((accounts) => {
          const address = accounts?.[0] ?? null;

          setConnectedAddress(address);

          if (onConnected) {
            onConnected(address, undefined, undefined);
          }
        })
        .catch(() => {});
    };

    activeProvider.on?.(
      "accountsChanged",
      handleAccountsChanged
    );

    activeProvider.on?.(
      "chainChanged",
      handleChainChanged
    );

    return () => {
      activeProvider.removeListener?.(
        "accountsChanged",
        handleAccountsChanged
      );

      activeProvider.removeListener?.(
        "chainChanged",
        handleChainChanged
      );
    };
  }, [onConnected, onDisconnected]);


  async function handleConnect(wallet) {
    try {
      setError("");
      setConnecting(true);

      // The provider SELECTED by the user is always used.
      const provider = wallet.provider;

      const address = await connectWallet(provider);

      if (address) {
        activeProviderRef.current = provider;
        mobileWalletRef.current = false;
        setActiveWalletProvider(provider);
        setConnectedAddress(address);

        try {
          localStorage.setItem(
            "inuswap.wallet",
            JSON.stringify({
              type: "injected",
              walletId: wallet.id,
              address,
            })
          );
        } catch {}

        const chainId = await getWalletChainId(provider);

        if (onConnected) {
          onConnected(address, provider, chainId);
        }
      }
    } catch (err) {
      setError(
        err?.message ||
          "Failed to connect wallet."
      );
    } finally {
      setConnecting(false);
    }
  }

  function handleMobileConnect() {
    if (!isMobileWalletConfigured()) {
      setError(
        "Mobile wallet connection is not configured."
      );
      return;
    }

    setError("");
    setMobilePickerOpen(true);
  }

  async function handleMobilePickerConnected(
    address,
    provider,
    chainId,
    walletType
  ) {
    activeProviderRef.current = provider;
    mobileWalletRef.current = true;
    setActiveWalletProvider(provider);
    setConnectedAddress(address);
    setMobilePickerOpen(false);

    try {
      localStorage.setItem(
        "inuswap.wallet",
        JSON.stringify({
          type: walletType || "reown",
          address,
        })
      );
    } catch {}

    if (onConnected) {
      onConnected(
        address,
        provider,
        chainId
      );
    }
  }

  async function handleDisconnect() {
    const provider =
      activeProviderRef.current ||
      getActiveWalletProvider();

    setError("");

    // Mobile WalletConnect/Reown session has its own disconnect flow.
    if (mobileWalletRef.current) {
      await disconnectMobileWallet();
    } else if (provider) {
      // Existing desktop wallet disconnect flow remains unchanged.
      await disconnectWallet(provider);
    }

    // AELVORA always clears the local session.
    setConnectedAddress(null);
    activeProviderRef.current = null;
    mobileWalletRef.current = false;
    clearActiveWalletProvider();

    try {
      localStorage.removeItem(
        "inuswap.wallet"
      );
    } catch {}

    if (onConnected) {
      onConnected(null);
    }

    if (onDisconnected) {
      onDisconnected();
    }
  }

  if (mobilePickerOpen) {
    return (
      <MobileWalletPicker
        onConnected={handleMobilePickerConnected}
        onClose={() =>
          setMobilePickerOpen(false)
        }
      />
    );
  }

  if (isMobileDevice()) {
    return (
      <MobileWalletPicker
        onConnected={handleMobilePickerConnected}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      className="wallet-modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Connect Wallet"
    >
      <div
        className="wallet-modal-backdrop"
        onClick={onClose}
      />

      <div className="wallet-modal">
        <div className="wallet-modal-header">
          <div>
            <div className="wallet-modal-kicker">
              AELVORA MARKET
            </div>

            <h2>
              {connectedAddress
                ? "Wallet Connected"
                : "Connect Wallet"}
            </h2>
          </div>

          <button
            type="button"
            className="wallet-modal-close"
            onClick={onClose}
            aria-label="Close wallet modal"
          >
            ×
          </button>
        </div>

        {connectedAddress ? (
          <>
            <div className="wallet-connected">
              <div className="wallet-connected-icon">
                ✓
              </div>

              <div className="wallet-connected-info">
                <strong>Connected</strong>

                <span>
                  {connectedAddress.slice(0, 6)}
                  ...
                  {connectedAddress.slice(-4)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="wallet-disconnect"
              onClick={handleDisconnect}
              disabled={connecting}
            >
              Disconnect Wallet
            </button>
          </>
        ) : (
          <>
            <p className="wallet-modal-description">
              Select a wallet extension to connect to
              AELVORA Market.
            </p>

            {error && (
              <div className="wallet-error">
                {error}
              </div>
            )}

            <div className="wallet-list">
              {isMobileWalletConfigured() && (
                <button
                  type="button"
                  className="wallet-option"
                  disabled={connecting}
                  onClick={handleMobileConnect}
                >
                  <span className="wallet-option-icon">
                    ◉
                  </span>

                  <span className="wallet-option-info">
                    <strong>
                      Mobile Wallet
                    </strong>

                    <small>
                      {connecting
                        ? "Connecting..."
                        : "Open wallet app"}
                    </small>
                  </span>

                  <span className="wallet-option-arrow">
                    →
                  </span>
                </button>
              )}

              {wallets.length === 0 ? (
                <div className="wallet-empty">
                  <strong>
                    No wallet detected
                  </strong>

                  <p>
                    Install a compatible EVM wallet
                    extension and refresh the page.
                  </p>
                </div>
              ) : (
                wallets.map((wallet) => (
                  <button
                    type="button"
                    className="wallet-option"
                    key={wallet.id}
                    disabled={connecting}
                    onClick={() =>
                      handleConnect(wallet)
                    }
                  >
                    <span className="wallet-option-icon">
                      {wallet.icon ? (
                        <img
                          src={wallet.icon}
                          alt=""
                        />
                      ) : (
                        "◈"
                      )}
                    </span>

                    <span className="wallet-option-info">
                      <strong>
                        {wallet.name}
                      </strong>

                      <small>
                        {connecting
                          ? "Connecting..."
                          : "Browser Extension"}
                      </small>
                    </span>

                    <span className="wallet-option-arrow">
                      →
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        <div className="wallet-modal-footer">
          By connecting, you agree to interact with
          AELVORA Market through your wallet.
        </div>
      </div>
    </div>
  );
}
