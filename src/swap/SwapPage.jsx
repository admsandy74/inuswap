import { useEffect, useMemo, useState } from "react";

import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  isAddress,
} from "viem";

import {
  publicClient,
  getWalletClient,
  getQuoteAfterTax,
  getTokenBalance,
  getTokenAllowance,
  approveToken,
  calculateMinimumReceived,
  TAX_ROUTER_ADDRESS,
  TAX_ROUTER_ABI,
  getTokenMetadata,
} from "./InuSwap";

import {
  WBNB,
  bscChain,
} from "../config/bsc";

import {
  getActiveWalletProvider,
} from "../wallet/wallet";

import "./swap.css";

function shortNumber(value, max = 6) {
  if (
    value == null ||
    !Number.isFinite(Number(value))
  ) {
    return "--";
  }

  return Number(value).toLocaleString(
    "en-US",
    {
      maximumFractionDigits: max,
    }
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] =
    useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        value
      );

      setCopied(true);

      setTimeout(
        () => setCopied(false),
        1200
      );
    } catch {}
  }

  return (
    <button
      className="inu-copy"
      type="button"
      onClick={copy}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function SwapPage() {
  const [direction, setDirection] =
    useState("BNB_TO_TOKEN");

  const [amount, setAmount] =
    useState("");

  const [quote, setQuote] =
    useState(null);

  const [bnbBalance, setBnbBalance] =
    useState(null);

  const [tokenBalance, setTokenBalance] =
    useState(null);

  const [slippage, setSlippage] =
    useState("5");

  const [selectedPreset, setSelectedPreset] =
    useState("5");

  const [customSlippage, setCustomSlippage] =
    useState("");

  const [loadingQuote, setLoadingQuote] =
    useState(false);

  const [loadingBalance, setLoadingBalance] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [savedTokens, setSavedTokens] =
    useState(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("inuswap_tokens") || "[]"
        );

        if (Array.isArray(stored)) {
          return stored;
        }
      } catch {}

      const legacy =
        localStorage.getItem("inuswap_token_ca");

      return legacy && isAddress(legacy)
        ? [{ address: legacy }]
        : [];
    });

  const [tokenAddress, setTokenAddress] =
    useState(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("inuswap_tokens") || "[]"
        );

        if (
          Array.isArray(stored) &&
          stored.length &&
          isAddress(stored[0]?.address)
        ) {
          return stored[0].address;
        }
      } catch {}

      const legacy =
        localStorage.getItem("inuswap_token_ca");

      return legacy && isAddress(legacy)
        ? legacy
        : "";
    });

  const [tokenMeta, setTokenMeta] =
    useState(null);

  const [caStatus, setCaStatus] =
    useState("");

  const provider =
    getActiveWalletProvider();

  const isBuy =
    direction === "BNB_TO_TOKEN";

  const path = useMemo(() => {
    if (!tokenMeta) return [];

    return isBuy
      ? [WBNB, tokenAddress]
      : [tokenAddress, WBNB];
  }, [
    isBuy,
    tokenAddress,
    tokenMeta,
  ]);

  const inputSymbol = isBuy
    ? "BNB"
    : tokenMeta?.symbol || "TOKEN";

  const outputSymbol = isBuy
    ? tokenMeta?.symbol || "TOKEN"
    : "BNB";

  const inputBalance = isBuy
    ? bnbBalance
    : tokenBalance;

  useEffect(() => {
    localStorage.setItem(
      "inuswap_tokens",
      JSON.stringify(savedTokens)
    );
  }, [savedTokens]);

  function addToken() {
    const address = tokenAddress.trim();

    if (!isAddress(address)) {
      setCaStatus("Invalid token address");
      return;
    }

    const exists = savedTokens.some(
      (token) =>
        token.address.toLowerCase() === address.toLowerCase()
    );

    if (!exists) {
      setSavedTokens((current) => [
        ...current,
        {
          address,
          name: tokenMeta?.name || "",
          symbol: tokenMeta?.symbol || "",
          decimals: tokenMeta?.decimals ?? null,
        },
      ]);
    }

    setTokenAddress(address);
    setMessage("");
  }

  function deleteToken() {
    if (!tokenAddress) return;

    const remaining = savedTokens.filter(
      (token) =>
        token.address.toLowerCase() !==
        tokenAddress.toLowerCase()
    );

    setSavedTokens(remaining);

    setTokenAddress(
      remaining[0]?.address || ""
    );

    setTokenMeta(null);
    setAmount("");
    setQuote(null);
    setCaStatus("");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      if (!isAddress(tokenAddress)) {
        setTokenMeta(null);

        setCaStatus(
          tokenAddress
            ? "Invalid token address"
            : ""
        );

        return;
      }

      try {
        setCaStatus(
          "Loading token..."
        );

        const metadata =
          await getTokenMetadata(
            tokenAddress
          );

        if (!cancelled) {
          setTokenMeta(metadata);

          setSavedTokens((current) =>
            current.map((token) =>
              token.address.toLowerCase() ===
              tokenAddress.toLowerCase()
                ? {
                    ...token,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    decimals: metadata.decimals,
                  }
                : token
            )
          );

          setCaStatus(
            `${metadata.symbol} · ${metadata.name} · ${metadata.decimals} decimals`
          );
        }
      } catch (error) {
        if (!cancelled) {
          setTokenMeta(null);

          setCaStatus(
            error?.shortMessage ||
              "Unable to read token contract."
          );
        }
      }
    }

    const timer = setTimeout(
      loadToken,
      300
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tokenAddress]);

  async function loadBalances() {
    if (!provider) {
      setBnbBalance(null);
      setTokenBalance(null);
      return;
    }

    try {
      setLoadingBalance(true);

      // Get the exact connected wallet address directly
      // from the active wallet provider.
      const accounts = await provider.request({
        method: "eth_accounts",
      });

      const account = accounts?.[0];

      if (!account) {
        setBnbBalance(null);
        setTokenBalance(null);
        return;
      }

      // Read native BNB directly from the connected wallet provider.
      const nativeBalanceHex =
        await provider.request({
          method: "eth_getBalance",
          params: [account, "latest"],
        });

      const nativeBalance =
        BigInt(nativeBalanceHex);

      setBnbBalance(
        formatEther(nativeBalance)
      );

      // Token balance still comes from BSC RPC.
      if (tokenMeta && isAddress(tokenAddress)) {
        const tokenBalanceRaw =
          await getTokenBalance(
            tokenAddress,
            account
          );

        setTokenBalance(
          formatUnits(
            tokenBalanceRaw,
            tokenMeta.decimals
          )
        );
      } else {
        setTokenBalance(null);
      }
    } catch (error) {
      console.warn(
        "Balance load failed:",
        error?.message || error
      );
    } finally {
      setLoadingBalance(false);
    }
  }

  useEffect(() => {
    loadBalances();
  }, [
    provider,
    tokenAddress,
    tokenMeta?.decimals,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (
        !tokenMeta ||
        !amount ||
        Number(amount) <= 0
      ) {
        setQuote(null);
        return;
      }

      try {
        setLoadingQuote(true);
        setMessage("");

        const parsedAmount = isBuy
          ? parseEther(amount)
          : parseUnits(
              amount,
              tokenMeta.decimals
            );

        const result =
          await getQuoteAfterTax(
            parsedAmount,
            path
          );

        if (!cancelled) {
          setQuote({
            input: result[0],
            tax: result[1],
            netInput: result[2],
            output:
              result[3][
                result[3].length - 1
              ],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setQuote(null);

          setMessage(
            error?.shortMessage ||
              error?.message ||
              "Unable to get quote."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingQuote(false);
        }
      }
    }

    const timer = setTimeout(
      loadQuote,
      350
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    amount,
    direction,
    path,
    tokenMeta,
  ]);

  function setMax() {
    if (
      !inputBalance ||
      !tokenMeta
    ) {
      return;
    }

    try {
      const raw = isBuy
        ? parseEther(inputBalance)
        : parseUnits(
            inputBalance,
            tokenMeta.decimals
          );

      const max =
        (raw * 9999n) / 10000n;

      setAmount(
        isBuy
          ? formatEther(max)
          : formatUnits(
              max,
              tokenMeta.decimals
            )
      );
    } catch {}
  }

  function switchDirection() {
    setDirection((value) =>
      value === "BNB_TO_TOKEN"
        ? "TOKEN_TO_BNB"
        : "BNB_TO_TOKEN"
    );

    setAmount("");
    setQuote(null);
    setMessage("");
  }

  async function executeSwap() {
    if (!provider) {
      setMessage(
        "Connect your wallet first."
      );
      return;
    }

    if (!tokenMeta) {
      setMessage(
        "Enter a valid token contract address."
      );
      return;
    }

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      setMessage(
        "Enter an amount."
      );
      return;
    }

    if (!quote) {
      setMessage(
        "Waiting for a quote."
      );
      return;
    }

    const slippageValue = Number(slippage);

    if (
      !Number.isFinite(slippageValue) ||
      slippageValue <= 0 ||
      slippageValue >= 100
    ) {
      setMessage(
        "Slippage must be between 0.1% and 99%."
      );
      return;
    }

    try {
      setBusy(true);
      setMessage("");

      const walletClient =
        getWalletClient(provider);

      const [account] =
        await walletClient.getAddresses();

      const amountIn = isBuy
        ? parseEther(amount)
        : parseUnits(
            amount,
            tokenMeta.decimals
          );

      const minimumReceived =
        calculateMinimumReceived(
          quote.output,
          BigInt(
            Math.round(
              Number(slippage) * 100
            )
          )
        );

      const deadline =
        BigInt(
          Math.floor(
            Date.now() / 1000
          ) + 1200
        );

      let hash;

      if (isBuy) {
        hash =
          await walletClient.writeContract({
            address:
              TAX_ROUTER_ADDRESS,

            abi:
              TAX_ROUTER_ABI,

            functionName:
              "swapExactETHForTokens",

            args: [
              minimumReceived,
              path,
              account,
              deadline,
            ],

            value: amountIn,

            account,

            chain: bscChain,
          });
      } else {
        const allowance =
          await getTokenAllowance(
            tokenAddress,
            account
          );

        if (
          allowance <
          amountIn
        ) {
          setMessage(
            "Approve token in your wallet..."
          );

          const approveHash =
            await approveToken(
              provider,
              tokenAddress,
              amountIn
            );

          await publicClient
            .waitForTransactionReceipt({
              hash: approveHash,
            });
        }

        setMessage(
          "Confirm swap in your wallet..."
        );

        hash =
          await walletClient.writeContract({
            address:
              TAX_ROUTER_ADDRESS,

            abi:
              TAX_ROUTER_ABI,

            functionName:
              "swapExactTokensForETH",

            args: [
              amountIn,
              minimumReceived,
              path,
              account,
              deadline,
            ],

            account,

            chain: bscChain,
          });
      }

      setMessage(
        "Transaction submitted: " +
          hash
      );

      await publicClient
        .waitForTransactionReceipt({
          hash,
        });

      setMessage(
        "Swap confirmed successfully."
      );

      setAmount("");
      setQuote(null);

      await loadBalances();
    } catch (error) {
      setMessage(
        error?.shortMessage ||
          error?.message ||
          "Swap failed."
      );
    } finally {
      setBusy(false);
    }
  }

  const outputDisplay = quote
    ? isBuy
      ? formatUnits(
          quote.output,
          tokenMeta.decimals
        )
      : formatEther(
          quote.output
        )
    : "";

  const rate =
    quote && amount
      ? Number(outputDisplay) /
        Number(amount)
      : null;

  return (
    <main className="inu-swap-page">
      <section className="inu-swap-card">

        <div className="swap-top">
          <div>
            <span className="swap-eyebrow">
              INUSWAP
            </span>

            <h1>Swap</h1>
          </div>

          <div className="swap-network">
            <span />
            BSC MAINNET
          </div>
        </div>

        <div className="swap-box">
          <div className="swap-box-head">
            <span>You Pay</span>

            <span>
              Balance:{" "}
              {loadingBalance
                ? "..."
                : shortNumber(
                    inputBalance,
                    6
                  )}

              {" "}

              <button
                className="max-btn"
                type="button"
                onClick={setMax}
                disabled={
                  !inputBalance ||
                  busy ||
                  !tokenMeta
                }
              >
                MAX
              </button>
            </span>
          </div>

          <div className="swap-input-row">
            <input
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              inputMode="decimal"
              placeholder="0.0"
              disabled={
                busy ||
                !tokenMeta
              }
            />

            <div className="token-pill">
              {inputSymbol}
            </div>
          </div>
        </div>

        <button
          className="swap-direction"
          type="button"
          onClick={switchDirection}
          aria-label="Switch tokens"
        >
          ↕
        </button>

        <div className="swap-box">
          <div className="swap-box-head">
            <span>You Receive</span>

            <span>
              {loadingQuote
                ? "Quoting..."
                : ""}
            </span>
          </div>

          <div className="swap-input-row">
            <input
              value={
                outputDisplay
                  ? shortNumber(
                      outputDisplay,
                      8
                    )
                  : ""
              }
              readOnly
              placeholder="0.0"
            />

            <div className="token-pill">
              {outputSymbol}
            </div>
          </div>
        </div>

        <div className="swap-ca-input">
          <label>
            TOKEN
          </label>

          <div className="swap-token-manager">
            <select
              value={tokenAddress}
              onChange={(e) => {
                setTokenAddress(e.target.value);
                setAmount("");
                setQuote(null);
                setMessage("");
              }}
              disabled={busy}
            >
              <option value="">
                Select token
              </option>

              {savedTokens.map((token) => (
                <option
                  key={token.address}
                  value={token.address}
                >
                  {token.symbol ||
                    token.name ||
                    "TOKEN"}{" "}
                  —{" "}
                  {token.address.slice(0, 6)}
                  ...
                  {token.address.slice(-4)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="token-manager-btn"
              onClick={addToken}
              disabled={
                busy ||
                !isAddress(tokenAddress)
              }
            >
              + Add
            </button>

            <button
              type="button"
              className="token-manager-delete"
              onClick={deleteToken}
              disabled={
                busy ||
                !tokenAddress
              }
              title="Delete token"
            >
              ×
            </button>
          </div>

          <div className="swap-ca-row">
            <input
              value={tokenAddress}
              onChange={(e) =>
                setTokenAddress(
                  e.target.value.trim()
                )
              }
              placeholder="Paste token contract address"
              disabled={busy}
            />
          </div>

          <div className="swap-ca-status">
            {caStatus}
          </div>
        </div>

        <div className="swap-rate">
          <span>Rate</span>

          <span>
            {rate
              ? "1 " +
                inputSymbol +
                " ≈ " +
                shortNumber(
                  rate,
                  8
                ) +
                " " +
                outputSymbol
              : "--"}
          </span>
        </div>

        <div className="swap-settings">
          <span>Slippage</span>

          <div className="slippage-options">
            {["0.5", "1", "5"].map((value) => (
              <button
                key={value}
                type="button"
                className={
                  selectedPreset === value
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setSelectedPreset(value);
                  setSlippage(value);
                  setCustomSlippage("");
                }}
              >
                {value}%
              </button>
            ))}

            <input
              className="slippage-custom"
              type="text"
              inputMode="decimal"
              placeholder="Custom"
              value={customSlippage}
              onFocus={() => {
                setSelectedPreset(null);
              }}
              onChange={(e) => {
                const value = e.target.value;

                // Hanya izinkan angka + satu titik desimal
                if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
                  return;
                }

                setCustomSlippage(value);

                if (value !== "") {
                  setSelectedPreset(null);
                  setSlippage(value);
                }
              }}
              aria-label="Custom slippage percentage"
            />
          </div>
        </div>

        <button
          className="inu-swap-btn"
          type="button"
          onClick={executeSwap}
          disabled={
            busy ||
            !tokenMeta ||
            !quote
          }
        >
          {busy
            ? "SWAPPING..."
            : "SWAP"}
        </button>

        {message && (
          <div className="swap-message">
            {message}
          </div>
        )}

        <div className="inu-ca-box">
          <div>
            <span>
              TOKEN CONTRACT
            </span>

            <code>
              {tokenAddress ||
                "Enter token CA above"}
            </code>
          </div>

          {tokenAddress && (
            <CopyButton
              value={tokenAddress}
            />
          )}
        </div>
      </section>

      <p className="swap-footer-note">
        Powered by INUSWAP
      </p>
    </main>
  );
}
