import { useEffect, useState } from "react";

import WalletModal from "./wallet/WalletModal";
import SwapPage from "./swap/SwapPage";

import {
  getActiveWalletProvider,
  getWalletChainId,
  getWalletBalance,
  switchToBscChain,
  discoverInjectedWallets,
  getInjectedWallets,
  setActiveWalletProvider,
} from "./wallet/wallet";

import {
  restoreMobileWalletSession,
} from "./wallet/mobileWallet";

import {
  BSC_CHAIN_ID,
} from "./config/bsc";

import {
  INU_TOKEN_ADDRESS,
  INU_TOKEN_IS_LIVE,
} from "./config/inu";

import "./index.css";
import "./App.css";

function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Logo() {
  return (
    <a className="inu-logo" href="/">
      <span className="inu-logo-mark">INU</span>
      <span className="inu-logo-text">
        INUSWAP
      </span>
    </a>
  );
}

export default function App() {
  const [walletOpen, setWalletOpen] =
    useState(false);

  const [account, setAccount] =
    useState(null);

  const [balance, setBalance] =
    useState(null);

  const [chainId, setChainId] =
    useState(null);

  const [switchingNetwork, setSwitchingNetwork] =
    useState(false);

  const [networkError, setNetworkError] =
    useState("");

  const [page, setPage] =
    useState(
      window.location.pathname === "/swap"
        ? "swap"
        : "home"
    );

  async function refreshWallet() {
    try {
      let provider =
        getActiveWalletProvider();

      // Restore the wallet provider after browser refresh.
      if (!provider) {
        let saved = null;

        try {
          saved = JSON.parse(
            localStorage.getItem("inuswap.wallet") ||
              "null"
          );
        } catch {}

        if (saved?.address) {
          if (
            saved.type &&
            saved.type !== "injected"
          ) {
            try {
              const restored =
                await restoreMobileWalletSession(
                  saved.type,
                  saved.address
                );

              if (restored?.provider) {
                provider = restored.provider;
                setActiveWalletProvider(
                  restored.provider
                );
              }
            } catch (error) {
              console.warn(
                "[INUSWAP] mobile wallet restore failed:",
                error?.message || error
              );
            }
          }

          // Restore normal browser extension wallets.
          if (!provider) {
            discoverInjectedWallets();

            const wallets =
              getInjectedWallets();

            for (const wallet of wallets) {
              try {
                const accounts =
                  await wallet.provider.request({
                    method: "eth_accounts",
                  });

                const match =
                  accounts?.find(
                    (account) =>
                      String(account).toLowerCase() ===
                      String(saved.address).toLowerCase()
                  );

                if (match) {
                  provider = wallet.provider;
                  setActiveWalletProvider(
                    wallet.provider
                  );
                  break;
                }
              } catch {}
            }
          }
        }
      }

      if (!provider) {
        setAccount(null);
        setBalance(null);
        setChainId(null);
        return;
      }

      const accounts =
        await provider.request({
          method: "eth_accounts",
        });

      const address =
        accounts?.[0] || null;

      if (!address) {
        setAccount(null);
        setBalance(null);
        setChainId(null);
        return;
      }

      setAccount(address);

      const currentChain =
        await getWalletChainId(provider);

      setChainId(
        Number(
          String(currentChain).startsWith("0x")
            ? parseInt(currentChain, 16)
            : currentChain
        )
      );

      const bnb =
        await getWalletBalance(
          provider,
          address
        );

      setBalance(bnb);
    } catch (error) {
      console.warn(
        "[INUSWAP] wallet refresh failed:",
        error?.message || error
      );
    }
  }

  useEffect(() => {
    refreshWallet();

    const onPopState = () => {
      setPage(
        window.location.pathname === "/swap"
          ? "swap"
          : "home"
      );
    };

    window.addEventListener(
      "popstate",
      onPopState
    );

    return () => {
      window.removeEventListener(
        "popstate",
        onPopState
      );
    };
  }, []);

  function navigate(path) {
    window.history.pushState(
      {},
      "",
      path
    );

    setPage(
      path === "/swap"
        ? "swap"
        : "home"
    );
  }

  function handleWalletConnected() {
    setWalletOpen(false);

    setTimeout(() => {
      refreshWallet();
    }, 250);
  }

  async function handleSwitchToBsc() {
    try {
      setNetworkError("");
      setSwitchingNetwork(true);

      const provider = getActiveWalletProvider();

      if (!provider) {
        setWalletOpen(true);
        return;
      }

      await switchToBscChain(provider);
      await refreshWallet();
    } catch (error) {
      setNetworkError(
        error?.message ||
          "Failed to switch wallet to BNB Smart Chain."
      );
    } finally {
      setSwitchingNetwork(false);
    }
  }

  const wrongNetwork =
    account &&
    chainId &&
    Number(chainId) !==
      BSC_CHAIN_ID;

  return (
    <div className="inu-app">

      <header className="inu-nav">
        <Logo />

        <nav className="inu-nav-links">
          <button
            type="button"
            className={
              page === "swap"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate("/swap")
            }
          >
            Swap
          </button>

          <a
            href="https://bscscan.com"
            target="_blank"
            rel="noreferrer"
          >
            BscScan ↗
          </a>
        </nav>

        <button
          className="inu-connect"
          type="button"
          onClick={() =>
            setWalletOpen(true)
          }
        >
          {account
            ? shortenAddress(account)
            : "Connect Wallet"}
        </button>
      </header>

      {wrongNetwork && (
        <div className="inu-network-warning">
          <span>
            Please switch your wallet to
            <strong> BNB Smart Chain</strong>.
          </span>

          <button
            type="button"
            className="inu-network-switch"
            onClick={handleSwitchToBsc}
            disabled={switchingNetwork}
          >
            {switchingNetwork
              ? "Switching..."
              : "Switch Network"}
          </button>

          {networkError && (
            <small className="inu-network-error">
              {networkError}
            </small>
          )}
        </div>
      )}

      {page === "home" ? (
        <main className="inu-home">

          <section className="inu-hero">

            <div className="inu-badge">
              <span />
              BNB SMART CHAIN
            </div>

            <h1>
              MAKE INU
              <br />
              <strong>GREAT AGAIN.</strong>
            </h1>

            <p>
              A simple decentralized exchange
              built for the Inu community.
            </p>

            <div className="inu-hero-actions">
              <button
                type="button"
                onClick={() =>
                  navigate("/swap")
                }
                className="inu-primary"
              >
                Launch Swap
              </button>

              <button
                type="button"
                className="inu-secondary"
                onClick={() =>
                  setWalletOpen(true)
                }
              >
                {account
                  ? shortenAddress(account)
                  : "Connect Wallet"}
              </button>
            </div>

          </section>

          <section className="inu-stats">

            <div>
              <span>NETWORK</span>
              <strong>BNB Chain</strong>
            </div>

            <div>
              <span>ASSET</span>
              <strong>INU</strong>
            </div>

            <div>
              <span>STATUS</span>
              <strong>
                {INU_TOKEN_IS_LIVE
                  ? "LIVE"
                  : "COMING SOON"}
              </strong>
            </div>

          </section>

          <section className="inu-ca-section">

            <div>
              <span>INU CONTRACT</span>

              <code>
                {INU_TOKEN_ADDRESS}
              </code>
            </div>

            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  INU_TOKEN_ADDRESS
                )
              }
            >
              Copy CA
            </button>

          </section>

          <section className="inu-tagline">
            <span>
              MAKE INU GREAT AGAIN.
            </span>

            <p>
              Connect. Swap. Inu.
            </p>
          </section>

        </main>
      ) : (
        <SwapPage />
      )}

      <footer className="inu-footer">
        <span>
          INUSWAP
        </span>

        <span>
          Make Inu Great Again.
        </span>
      </footer>

      {walletOpen && (
        <WalletModal
          onClose={() =>
            setWalletOpen(false)
          }
          onConnected={
            handleWalletConnected
          }
        />
      )}

    </div>
  );
}
