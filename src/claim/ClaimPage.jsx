import { useEffect, useMemo, useState } from "react";
import { formatEther, isAddress } from "viem";
import {
  getActiveWalletProvider,
  switchToRobinhoodChain,
} from "../wallet/wallet";
import SwapPage from "../swap/SwapPage";
import "./claim.css";


import {
  AELVORA_FACTORY,
  AELVORA_FACTORY_ABI,
} from "../contracts/AelvoraFactory";

import {
  publicClient,
  ROBINHOOD_CHAIN,
  CREATOR_FEE_VAULT,
  CREATOR_FEE_VAULT_ABI,
  getClaimStats,
  getWalletClient,
} from "./AelvoraCreatorFeeVault";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

export default function ClaimPage({
  walletAddress,
  walletChainId,
  onConnect,
  onBack,
}) {
  const tokenAddress = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[1] || "";
  }, []);

  const [currentChainId, setCurrentChainId] =
    useState(walletChainId);

  const wrongNetwork =
    Boolean(walletAddress) &&
    Number(currentChainId) !== Number(ROBINHOOD_CHAIN.id);

  useEffect(() => {
    setCurrentChainId(walletChainId);
  }, [walletChainId]);

  useEffect(() => {
    const provider = getActiveWalletProvider();

    if (!provider?.request) {
      return;
    }

    const syncChain = async () => {
      try {
        const chainId = await provider.request({
          method: "eth_chainId",
        });

        setCurrentChainId(chainId);
      } catch (err) {
        console.error(
          "Failed to detect wallet network:",
          err
        );
      }
    };

    syncChain();

    const handleChainChanged = (chainId) => {
      setCurrentChainId(chainId);
    };

    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.(
        "chainChanged",
        handleChainChanged
      );
    };
  }, [walletAddress]);

  const isClaimLanding = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length === 1 && parts[0] === "claim";
  }, []);

  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [switchingChain, setSwitchingChain] = useState(false);
  const [totalClaimed, setTotalClaimed] = useState(0n);
  const [availableToClaim, setAvailableToClaim] = useState(0n);
  const [claimAllowed, setClaimAllowed] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState(0n);
  const [claimTokenInput, setClaimTokenInput] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      setLoading(true);
      setError("");
      setTokenInfo(null);

      if (isClaimLanding) {
        setLoading(false);
        return;
      }

      if (!isAddress(tokenAddress)) {
        setError("This token is not created on Aelvora Market");
        setLoading(false);
        return;
      }

      try {
        const info = await publicClient.readContract({
          address: AELVORA_FACTORY,
          abi: AELVORA_FACTORY_ABI,
          functionName: "tokenInfo",
          args: [tokenAddress],
        });

        if (cancelled) return;

        const token = info?.[0];
        const creator = info?.[1];
        const curve = info?.[2];

        if (
          !token ||
          token.toLowerCase() === ZERO_ADDRESS ||
          !creator ||
          creator.toLowerCase() === ZERO_ADDRESS ||
          !curve ||
          curve.toLowerCase() === ZERO_ADDRESS
        ) {
          setError(
            "This token is not created on Aelvora Market"
          );
          setLoading(false);
          return;
        }

        setTokenInfo({
          token,
          creator,
          curve,
        });
      } catch (err) {
        console.error("[AELVORA CLAIM] tokenInfo error:", err);

        if (!cancelled) {
          setError(
            "This token is not created on Aelvora Market"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadToken();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, isClaimLanding]);

  const isCreator =
    tokenInfo &&
    walletAddress &&
    tokenInfo.creator.toLowerCase() ===
      walletAddress.toLowerCase();

  useEffect(() => {
    let cancelled = false;

    async function loadClaimStats() {
      setTotalClaimed(0n);
      setAvailableToClaim(0n);

      if (!tokenInfo || !isCreator) {
        return;
      }

      try {
        const [available, claimStatus] =
          await Promise.all([
            publicClient.readContract({
              address: CREATOR_FEE_VAULT,
              abi: CREATOR_FEE_VAULT_ABI,
              functionName: "claimable",
              args: [
                tokenInfo.token,
                walletAddress,
              ],
            }),
            publicClient.readContract({
              address: CREATOR_FEE_VAULT,
              abi: CREATOR_FEE_VAULT_ABI,
              functionName: "canClaim",
              args: [
                tokenInfo.token,
                walletAddress,
              ],
            }),
          ]);

        if (cancelled) return;

        setAvailableToClaim(available);
        setClaimAllowed(claimStatus[0]);
        setNextClaimAt(claimStatus[2]);
        setClaimLoading(false);

        getClaimStats(
          tokenInfo.token,
          walletAddress
        )
          .then((stats) => {
            if (!cancelled) {
              setTotalClaimed(stats.totalClaimed);
            }
          })
          .catch((err) => {
            console.error(
              "[AELVORA CLAIM] Failed to load claim history:",
              err
            );
          });
      } catch (err) {
        console.error(
          "[AELVORA CLAIM] Failed to load claim stats:",
          err
        );

        if (!cancelled) {
          setClaimLoading(false);
        }
      }
    }

    loadClaimStats();

    return () => {
      cancelled = true;
    };
  }, [
    tokenInfo,
    walletAddress,
    isCreator,
  ]);

  async function handleClaim() {
    if (!tokenInfo || !walletAddress || !isCreator) {
      return;
    }

    if (!claimAllowed || availableToClaim === 0n) {
      return;
    }

    const provider = getActiveWalletProvider();

    if (!provider) {
      setError("Wallet provider is not available.");
      return;
    }

    try {
      setClaimLoading(true);
      setError("");

      const accounts = await provider.request({
        method: "eth_accounts",
      });

      const activeAddress =
        accounts?.find(
          (account) =>
            String(account).toLowerCase() ===
            walletAddress.toLowerCase()
        ) ?? null;

      if (!activeAddress) {
        throw new Error(
          "The connected wallet does not match the creator wallet."
        );
      }

      const walletClient = getWalletClient(provider);

      const hash = await walletClient.writeContract({
        address: CREATOR_FEE_VAULT,
        abi: CREATOR_FEE_VAULT_ABI,
        functionName: "claim",
        args: [tokenInfo.token],
        account: activeAddress,
        chain: ROBINHOOD_CHAIN,
      });

      await publicClient.waitForTransactionReceipt({
        hash,
      });

      const [available, claimStatus, stats] =
        await Promise.all([
          publicClient.readContract({
            address: CREATOR_FEE_VAULT,
            abi: CREATOR_FEE_VAULT_ABI,
            functionName: "claimable",
            args: [
              tokenInfo.token,
              walletAddress,
            ],
          }),
          publicClient.readContract({
            address: CREATOR_FEE_VAULT,
            abi: CREATOR_FEE_VAULT_ABI,
            functionName: "canClaim",
            args: [
              tokenInfo.token,
              walletAddress,
            ],
          }),
          getClaimStats(
            tokenInfo.token,
            walletAddress
          ),
        ]);

      setAvailableToClaim(available);
      setClaimAllowed(claimStatus[0]);
      setNextClaimAt(claimStatus[2]);
      setTotalClaimed(stats.totalClaimed);
    } catch (err) {
      console.error(
        "[AELVORA CLAIM] Claim failed:",
        err
      );

      setError(
        err?.shortMessage ||
          err?.message ||
          "Claim failed."
      );
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <div className="claim-page">
      <div className="claim-container">
        <button
          type="button"
          className="claim-back"
          onClick={onBack}
        >
          ← Back
        </button>

        {isClaimLanding ? (
          <div className="claim-card">
            <h1>Creator Claim</h1>

            {!walletAddress ? (
              <div className="claim-status">
                <p>Connect your wallet to access creator claims.</p>

                <button
                  type="button"
                  onClick={onConnect}
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="claim-status">
                <p>Enter your AELVORA token contract address to check your creator fees.</p>

                <input
                  type="text"
                  value={claimTokenInput}
                  onChange={(e) => {
                    setClaimTokenInput(e.target.value);
                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="Token Contract Address"
                />

                {error && (
                  <div className="claim-error">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    const ca = claimTokenInput.trim();

                    setError("");

                    if (!isAddress(ca)) {
                      setError("Enter a valid token contract address.");
                      return;
                    }

                    try {
                      setLoading(true);

                      const info = await publicClient.readContract({
                        address: AELVORA_FACTORY,
                        abi: AELVORA_FACTORY_ABI,
                        functionName: "tokenInfo",
                        args: [ca],
                      });

                      const token = info?.[0];
                      const creator = info?.[1];
                      const curve = info?.[2];

                      if (
                        !token ||
                        token.toLowerCase() === ZERO_ADDRESS ||
                        !creator ||
                        creator.toLowerCase() === ZERO_ADDRESS ||
                        !curve ||
                        curve.toLowerCase() === ZERO_ADDRESS
                      ) {
                        setError(
                          "This token is not created on Aelvora Market"
                        );
                        setLoading(false);
                        return;
                      }

                      window.location.href = `/claim/${ca}`;
                    } catch (err) {
                      console.error(
                        "[AELVORA CLAIM] Check token error:",
                        err
                      );

                      setError(
                        "This token is not created on Aelvora Market"
                      );
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? "Checking..." : "Check Claim"}
                </button>
              </div>
            )}
          </div>
        ) : (
        <div className="claim-card">
          <h1>Creator Claim</h1>

          {loading && (
            <div className="claim-status">
              Checking token...
            </div>
          )}

          {!loading && error && (
            <div className="claim-status claim-error">
              {error}
            </div>
          )}

          {!loading && !error && tokenInfo && !walletAddress && (
            <div className="claim-status">
              <p>Connect your wallet</p>

              <button
                type="button"
                onClick={onConnect}
              >
                Connect Wallet
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            tokenInfo &&
            walletAddress &&
            !isCreator && (
              <div className="claim-status claim-error">
                You are not creator of this token
              </div>
            )}

          {!loading &&
            !error &&
            tokenInfo &&
            walletAddress &&
            isCreator && (
              <div className="claim-status">
                <div>
                  <strong>Total Claimed</strong>
                  <div>
                    {claimLoading
                      ? "Loading..."
                      : `${formatEther(totalClaimed)} ETH`}
                  </div>
                </div>

                <div>
                  <strong>Available to Claim</strong>
                  <div>
                    {claimLoading
                      ? "Loading..."
                      : `${formatEther(availableToClaim)} ETH`}
                  </div>
                </div>

                {!claimLoading &&
                  availableToClaim > 0n &&
                  !claimAllowed &&
                  nextClaimAt > 0n && (
                    <div>
                      Claim available again after{" "}
                      {new Date(
                        Number(nextClaimAt) * 1000
                      ).toLocaleString()}
                    </div>
                  )}

                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={
                    claimLoading ||
                    availableToClaim === 0n ||
                    !claimAllowed
                  }
                >
                  {claimLoading
                    ? "Processing..."
                    : availableToClaim === 0n
                      ? "Nothing to Claim"
                      : !claimAllowed
                        ? "Claim Cooldown"
                        : "Claim"}
                </button>
              </div>
            )}
        </div>
        )}

        <div className="claim-swap-section">
          <SwapPage
            walletAddress={walletAddress}
            walletChainId={currentChainId}
            compact
            preservePath
            onConnect={onConnect}
            onDisconnect={() => {}}
            onBack={onBack}
          />
        </div>
      </div>
    </div>
  );
}
