import { useEffect, useState } from "react";
import metamaskLogo from "../assets/wallets/metamask.svg";
import okxLogo from "../assets/wallets/okx.png";
import trustLogo from "../assets/wallets/trust.png";
import binanceLogo from "../assets/wallets/binance.png";
import {
  connectSpecificMobileWallet,
  connectMobileWallet,
  isMobileWalletConfigured,
  warmupTrustWallet,
} from "./mobileWallet";

const WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: metamaskLogo,
  },
  {
    id: "rabby",
    name: "OKX Wallet",
    icon: okxLogo,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: trustLogo,
  },
  {
    id: "binance",
    name: "Binance Web3 DApp",
    icon: binanceLogo,
  },
];

export default function MobileWalletPicker({
  onConnected,
  onClose,
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    warmupTrustWallet();
  }, []);

  async function handleWallet(wallet) {
    try {
      setError("");
      setConnecting(true);

      let trustWindow = null;

      if (
        wallet.id === "trust" &&
        typeof window !== "undefined"
      ) {
        try {
          trustWindow = window.open(
            "about:blank",
            "_blank"
          );
        } catch {}
      }

      const result =
        await connectSpecificMobileWallet(
          wallet.id,
          trustWindow
        );

      if (!result?.address || !result?.provider) {
        throw new Error(
          "Wallet connection returned no account."
        );
      }

      onConnected?.(
        result.address,
        result.provider,
        result.chainId,
        result.walletType
      );
    } catch (err) {
      console.warn(
        "[AELVORA] Mobile wallet connection failed:",
        err?.message || err
      );

      setError(
        err?.message ||
          "Failed to connect wallet."
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleMoreWallets() {
    try {
      setError("");
      setConnecting(true);

      // Close AELVORA's wallet picker before opening
      // the WalletConnect modal so the overlays do not
      // stack on top of each other.
      onClose?.();

      await new Promise((resolve) =>
        setTimeout(resolve, 100)
      );

      const result = await connectMobileWallet();

      if (!result?.address || !result?.provider) {
        throw new Error(
          "Wallet connection returned no account."
        );
      }

      onConnected?.(
        result.address,
        result.provider,
        result.chainId,
        result.walletType
      );
    } catch (err) {
      console.warn(
        "[AELVORA] Reown fallback failed:",
        err?.message || err
      );

      setError(
        err?.message ||
          "Failed to open more wallets."
      );
    } finally {
      setConnecting(false);
    }
  }

  if (!isMobileWalletConfigured()) {
    return null;
  }

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal">
        <div className="wallet-modal-header">
          <div>
            <strong>Connect Wallet</strong>
            <small>Choose your mobile wallet</small>
          </div>

          <button
            type="button"
            className="wallet-modal-close"
            onClick={onClose}
            disabled={connecting}
          >
            ×
          </button>
        </div>

        <div className="wallet-list">
          {WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              className="wallet-option"
              disabled={connecting}
              onClick={() =>
                handleWallet(wallet)
              }
            >
              <span className="wallet-option-icon">
                <img
                  src={wallet.icon}
                  alt=""
                  className="wallet-option-icon-image"
                />
              </span>

              <span className="wallet-option-info">
                <strong>{wallet.name}</strong>
                <small>
                  {connecting
                    ? "Connecting..."
                    : "Connect"}
                </small>
              </span>

              <span className="wallet-option-arrow">
                →
              </span>
            </button>
          ))}

          <button
            type="button"
            className="wallet-option"
            disabled={connecting}
            onClick={handleMoreWallets}
          >
            <span className="wallet-option-icon">
              ◉
            </span>

            <span className="wallet-option-info">
              <strong>More Wallets</strong>
              <small>
                WalletConnect
              </small>
            </span>

            <span className="wallet-option-arrow">
              →
            </span>
          </button>
        </div>

        {error && (
          <div className="wallet-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
