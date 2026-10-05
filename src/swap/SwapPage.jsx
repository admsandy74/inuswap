import { useEffect, useMemo, useState } from "react";
import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "viem";

import {
  publicClient,
  getWalletClient,
  getQuote,
  getTokenBalance,
  getTokenAllowance,
  approveToken,
  calculateMinimumReceived,
  PANCAKESWAP_V2_ROUTER,
} from "./InuSwap";

import {
  WBNB,
} from "../config/bsc";

import {
  INU_TOKEN_ADDRESS,
  INU_TOKEN_SYMBOL,
  INU_TOKEN_DECIMALS,
  INU_TOKEN_IS_LIVE,
} from "../config/inu";

import {
  getActiveWalletProvider,
} from "../wallet/wallet";

import "./swap.css";

const ZERO =
  "0x0000000000000000000000000000000000000000";

function shortNumber(value, max = 6) {
  if (value == null || !Number.isFinite(Number(value))) return "--";

  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: max,
  });
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
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
  const [direction, setDirection] = useState("BNB_TO_INU");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [bnbBalance, setBnbBalance] = useState(null);
  const [inuBalance, setInuBalance] = useState(null);
  const [slippage, setSlippage] = useState("5");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const provider = getActiveWalletProvider();

  const isBuy = direction === "BNB_TO_INU";

  const path = useMemo(
    () =>
      isBuy
        ? [WBNB, INU_TOKEN_ADDRESS]
        : [INU_TOKEN_ADDRESS, WBNB],
    [isBuy]
  );

  const inputSymbol = isBuy ? "BNB" : INU_TOKEN_SYMBOL;
  const outputSymbol = isBuy ? INU_TOKEN_SYMBOL : "BNB";

  async function loadBalances() {
    if (!provider || !INU_TOKEN_IS_LIVE) return;

    try {
      setLoadingBalance(true);

      const walletClient = getWalletClient(provider);
      const [account] = await walletClient.getAddresses();

      const [nativeBalance, tokenBalance] =
        await Promise.all([
          publicClient.getBalance({
            address: account,
          }),
          getTokenBalance(
            INU_TOKEN_ADDRESS,
            account
          ),
        ]);

      setBnbBalance(formatEther(nativeBalance));

      setInuBalance(
        formatUnits(
          tokenBalance,
          INU_TOKEN_DECIMALS
        )
      );
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
  }, [provider]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (
        !INU_TOKEN_IS_LIVE ||
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
              INU_TOKEN_DECIMALS
            );

        const amounts = await getQuote(
          parsedAmount,
          path
        );

        if (!cancelled) {
          setQuote({
            input: amounts[0],
            output:
              amounts[amounts.length - 1],
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
  ]);

  function switchDirection() {
    setDirection((value) =>
      value === "BNB_TO_INU"
        ? "INU_TO_BNB"
        : "BNB_TO_INU"
    );

    setAmount("");
    setQuote(null);
    setMessage("");
  }

  async function executeSwap() {
    if (!provider) {
      setMessage("Connect your wallet first.");
      return;
    }

    if (!INU_TOKEN_IS_LIVE) {
      setMessage(
        "INU is not live yet. Trading is disabled."
      );
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setMessage("Enter an amount.");
      return;
    }

    if (!quote) {
      setMessage("Waiting for a quote.");
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
            INU_TOKEN_DECIMALS
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
          ) + 60 * 20
        );

      let hash;

      if (isBuy) {
        hash =
          await walletClient.writeContract({
            address:
              PANCAKESWAP_V2_ROUTER,
            abi: [
              {
                type: "function",
                name:
                  "swapExactETHForTokens",
                stateMutability:
                  "payable",
                inputs: [
                  {
                    name:
                      "amountOutMin",
                    type: "uint256",
                  },
                  {
                    name: "path",
                    type: "address[]",
                  },
                  {
                    name: "to",
                    type: "address",
                  },
                  {
                    name: "deadline",
                    type: "uint256",
                  },
                ],
                outputs: [
                  {
                    name: "amounts",
                    type: "uint256[]",
                  },
                ],
              },
            ],
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
            chain: undefined,
          });
      } else {
        const allowance =
          await getTokenAllowance(
            INU_TOKEN_ADDRESS,
            account
          );

        if (allowance < amountIn) {
          setMessage(
            "Approve INU token in your wallet..."
          );

          await approveToken(
            provider,
            INU_TOKEN_ADDRESS,
            amountIn
          );
        }

        hash =
          await walletClient.writeContract({
            address:
              PANCAKESWAP_V2_ROUTER,
            abi: [
              {
                type: "function",
                name:
                  "swapExactTokensForETH",
                stateMutability:
                  "nonpayable",
                inputs: [
                  {
                    name: "amountIn",
                    type: "uint256",
                  },
                  {
                    name:
                      "amountOutMin",
                    type: "uint256",
                  },
                  {
                    name: "path",
                    type: "address[]",
                  },
                  {
                    name: "to",
                    type: "address",
                  },
                  {
                    name: "deadline",
                    type: "uint256",
                  },
                ],
                outputs: [
                  {
                    name: "amounts",
                    type: "uint256[]",
                  },
                ],
              },
            ],
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
            chain: undefined,
          });
      }

      setMessage(
        `Transaction submitted: ${hash}`
      );

      await publicClient.waitForTransactionReceipt({
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

  const outputDisplay =
    quote && isBuy
      ? formatUnits(
          quote.output,
          INU_TOKEN_DECIMALS
        )
      : quote
        ? formatEther(quote.output)
        : "";

  const inputBalance =
    isBuy
      ? bnbBalance
      : inuBalance;

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
            BSC
          </div>
        </div>

        {!INU_TOKEN_IS_LIVE && (
          <div className="inu-coming-soon">
            <strong>INU COMING SOON</strong>
            <span>
              Swap is disabled until the real
              INU contract launches.
            </span>
          </div>
        )}

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
            </span>
          </div>

          <div className="swap-input-row">
            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              inputMode="decimal"
              placeholder="0.0"
              disabled={
                busy ||
                !INU_TOKEN_IS_LIVE
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

        <div className="swap-rate">
          <span>Rate</span>
          <span>
            {quote && amount
              ? `1 ${inputSymbol} ≈ ${
                  Number(outputDisplay) /
                  Number(amount)
                } ${outputSymbol}`
              : "--"}
          </span>
        </div>

        <div className="swap-settings">
          <span>Slippage</span>

          <div className="slippage-options">
            {["0.5", "1", "5"].map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    slippage === value
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSlippage(value)
                  }
                >
                  {value}%
                </button>
              )
            )}
          </div>
        </div>

        <button
          className="inu-swap-btn"
          type="button"
          onClick={executeSwap}
          disabled={
            busy ||
            !INU_TOKEN_IS_LIVE
          }
        >
          {!INU_TOKEN_IS_LIVE
            ? "COMING SOON"
            : busy
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
            <span>INU CONTRACT</span>
            <code>
              {INU_TOKEN_ADDRESS}
            </code>
          </div>

          <CopyButton
            value={INU_TOKEN_ADDRESS}
          />
        </div>
      </section>

      <p className="swap-footer-note">
        Powered by PancakeSwap V2 · BNB Smart Chain
      </p>
    </main>
  );
}
