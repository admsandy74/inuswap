import { useEffect, useState } from "react";
import {
  getActiveWalletProvider,
  switchToRobinhoodChain,
} from "../wallet/wallet";
import { decodeEventLog, encodeFunctionData, parseEther, parseUnits } from "viem";
import "./create-token.css";
import { SITE_CONFIG } from "../config/site.js";

const AELVORA_FACTORY =
  "0x731197c3cF5A5B7100feb86e6C4B730276a7c727";

const ROBINHOOD_CHAIN_ID = "0x1237";
const ROBINHOOD_CHAIN_ID_NUMBER = Number.parseInt(
  ROBINHOOD_CHAIN_ID,
  16
);

const isRobinhoodChain = (chainId) =>
  Number(chainId) === ROBINHOOD_CHAIN_ID_NUMBER;

const AELV_SYMBOL_CREATOR =
  "0xF9cc3916b78571DA68128a9B928E307010534815";

const AELVORA_FACTORY_ABI = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "totalSupply", type: "uint256" },
          { name: "creatorTaxBps", type: "uint256" },
          { name: "firstBuyEth", type: "uint256" },
          { name: "website", type: "string" },
          { name: "twitter", type: "string" },
          { name: "telegram", type: "string" },
          { name: "logoURI", type: "string" },
        ],
      },
    ],
    outputs: [
      {
        name: "tokenAddress",
        type: "address",
      },
    ],
  },

  {
    type: "event",
    name: "TokenCreated",
    anonymous: false,
    inputs: [
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "curve", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "totalSupply", type: "uint256" },
      { indexed: false, name: "creatorTaxBps", type: "uint256" },
    ],
  },
];

const CREATOR_TAX_MIN = 0;
const CREATOR_TAX_MAX = 5;
const AELVORA_FEE = 1;
const LAUNCH_FEE_ETH = "0.0003";
const MAX_TOTAL_SUPPLY = 1_000_000_000_000n;
const MAX_TOTAL_SUPPLY_RAW =
  MAX_TOTAL_SUPPLY * 10n ** 18n;

function shortHash(hash) {
  if (!hash) return "";

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

async function waitForReceipt(provider, hash) {
  for (;;) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });

    if (receipt) {
      return receipt;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1500)
    );
  }
}


const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;
const MAX_LOGO_DIMENSION = 32;
const MAX_LOGO_OUTPUT_BYTES = 512;

function loadLogoImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Invalid image file."));

      img.src = reader.result;
    };

    reader.onerror = () =>
      reject(new Error("Failed to read image file."));

    reader.readAsDataURL(file);
  });
}

async function compressTokenLogo(file) {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("Logo must be JPG or PNG.");
  }

  if (file.size > MAX_LOGO_FILE_SIZE) {
    throw new Error("Logo size must not exceed 5 MB.");
  }

  const img = await loadLogoImage(file);

  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Invalid image dimensions.");
  }

  for (const dimension of [256, 192, 128, 96]) {
    const scale = Math.min(
      1,
      dimension / Math.max(sourceWidth, sourceHeight)
    );

    const width = Math.max(
      1,
      Math.round(sourceWidth * scale)
    );

    const height = Math.max(
      1,
      Math.round(sourceHeight * scale)
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "This browser does not support image processing."
      );
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [
      0.8,
      0.7,
      0.6,
      0.5,
      0.4,
      0.3,
    ]) {
      const result = canvas.toDataURL(
        "image/webp",
        quality
      );

      if (!result.startsWith("data:image/webp")) {
        break;
      }

      const base64 = result.slice(
        result.indexOf(",") + 1
      );

      const estimatedBytes =
        Math.floor(base64.length * 0.75);

      if (estimatedBytes <= 400 * 1024) {
        return result;
      }
    }
  }

  throw new Error(
    "Logo could not be compressed below 400 KB."
  );
}

async function uploadTokenLogo(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    throw new Error("Invalid processed logo.");
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const response = await fetch("/api/upload-logo", {
    method: "POST",
    headers: {
      "Content-Type": "image/webp",
    },
    body: bytes,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok || !result?.logoURI) {
    throw new Error(
      result?.error || "Failed to upload logo."
    );
  }

  return result.logoURI;
}

export default function CreateToken({
  walletAddress,
  walletChainId,
  walletBalance,
  onConnect,
  onDisconnect,
  onBack,
}) {
  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [logoData, setLogoData] = useState("");
  const [logoError, setLogoError] = useState("");

  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");

  const [totalSupply, setTotalSupply] = useState("");
  const [creatorTax, setCreatorTax] = useState("0");
  const [initialBuy, setInitialBuy] = useState("");

  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txError, setTxError] = useState("");
  const [switchingChain, setSwitchingChain] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState("");

  useEffect(() => {
    setTxError("");
  }, [
    walletAddress,
    walletChainId,
  ]);

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];

    setLogoError("");

    if (!file) {
      setLogoData("");
      return;
    }

    try {
      const compressed =
        await compressTokenLogo(file);

      const logoURI =
        await uploadTokenLogo(compressed);

      setLogoData(logoURI);

      console.log(
        "Aelvora logo uploaded:",
        logoURI
      );
    } catch (error) {
      setLogoData("");

      setLogoError(
        error instanceof Error
          ? error.message
          : "Failed to process logo."
      );

      event.target.value = "";
    }
  };

  const aelvSymbolLocked =
    symbol.trim().toUpperCase() === "AELV" &&
    (!walletAddress ||
      walletAddress.toLowerCase() !==
        AELV_SYMBOL_CREATOR.toLowerCase());

  const handleCreateToken = async () => {
    const walletProvider = getActiveWalletProvider();

    setTxError("");
    setTxHash("");
    setTxStatus("");
    setCreatedToken("");

    try {
      if (!walletAddress || !walletProvider) {
        throw new Error(
          "Connect your wallet first."
        );
      }

      if (!isRobinhoodChain(walletChainId)) {
        throw new Error(
          "Please switch your wallet to Robinhood Chain."
        );
      }

      if (!tokenName.trim()) {
        throw new Error(
          "Token name is required."
        );
      }

      if (!symbol.trim()) {
        throw new Error(
          "Token symbol is required."
        );
      }

      if (
        symbol.trim().toUpperCase() === "AELV" &&
        walletAddress.toLowerCase() !==
          AELV_SYMBOL_CREATOR.toLowerCase()
      ) {
        throw new Error(
          "This symbol cannot be used."
        );
      }

      const supplyText =
        totalSupply.trim();

      if (!supplyText) {
        throw new Error(
          "Total supply is required."
        );
      }

      if (!/^\d+$/.test(supplyText)) {
        throw new Error(
          "Total supply must contain numbers only."
        );
      }

      const supply = parseUnits(
        supplyText,
        18
      );

      if (supply === 0n) {
        throw new Error(
          "Total supply must be greater than 0."
        );
      }

      if (supply > MAX_TOTAL_SUPPLY_RAW) {
        throw new Error(
          "Total supply exceeds the maximum allowed."
        );
      }

      const tax = Number(
        creatorTax || "0"
      );

      if (
        !Number.isFinite(tax) ||
        tax < CREATOR_TAX_MIN ||
        tax > CREATOR_TAX_MAX
      ) {
        throw new Error(
          "Creator tax must be between 0% and 5%."
        );
      }

      if (
        !initialBuy.trim() ||
        Number(initialBuy) <= 0
      ) {
        throw new Error(
          "Initial creator buy must be greater than 0 ETH."
        );
      }

      const firstBuyWei =
        parseEther(initialBuy.trim());

      const launchFeeWei =
        parseEther(LAUNCH_FEE_ETH);

      const creatorTaxBps =
        BigInt(
          Math.round(tax * 100)
        );

      const totalValue =
        launchFeeWei + firstBuyWei;

      const data =
        encodeFunctionData({
          abi: AELVORA_FACTORY_ABI,
          functionName: "createToken",
          args: [
            {
              name: tokenName.trim(),
              symbol: symbol.trim(),
              totalSupply: supply,
              creatorTaxBps,
              firstBuyEth: firstBuyWei,
              website: website.trim(),
              twitter: twitter.trim(),
              telegram: telegram.trim(),
              logoURI: logoData || "",
            },
          ],
        });

      setCreating(true);
      setTxStatus(
        "Waiting for wallet confirmation..."
      );

      const hash =
        await walletProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: walletAddress,
              to: AELVORA_FACTORY,
              value:
                "0x" +
                totalValue.toString(16),
              data,
            },
          ],
        });

      setTxHash(hash);
      setTxStatus(
        "Transaction submitted. Waiting for confirmation..."
      );

      const receipt =
        await waitForReceipt(
          walletProvider,
          hash
        );

      if (
        receipt.status &&
        receipt.status !== "0x1"
      ) {
        throw new Error(
          "Transaction reverted."
        );
      }

      setTxStatus(
        "Token creation confirmed on Robinhood Chain."
      );

      // Decode TokenCreated event to get the real token CA.
      let created = null;
      let createdBlock = "";

      for (const log of receipt.logs || []) {
        try {
          const decoded = decodeEventLog({
            abi: AELVORA_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
            eventName: "TokenCreated",
          });

          if (decoded?.args?.token) {
            created = decoded.args;
            createdBlock =
              log?.blockNumber?.toString() ||
              receipt?.blockNumber?.toString() ||
              "";
            break;
          }
        } catch {
          // Ignore unrelated logs.
        }
      }

      if (!created?.token) {
        throw new Error(
          "Token created, but TokenCreated event could not be decoded."
        );
      }

      const tokenRecord = {
        id: `aelvora-${created.token.toLowerCase()}`,
        contract: created.token,
        name: created.name || tokenName.trim(),
        symbol: created.symbol || symbol.trim(),
        creator: created.creator || walletAddress,
        curve: created.curve || "",
        createdBlock,

        totalSupply: created.totalSupply
          ? created.totalSupply.toString()
          : supply.toString(),

        creatorTaxBps: created.creatorTaxBps
          ? created.creatorTaxBps.toString()
          : creatorTaxBps.toString(),

        category: "newest",
        status: "live",

        // Metadata matches what is stored in the token contract.
        logo: logoData,
        logoURI: logoData,
        website: website.trim(),
        twitter: twitter.trim(),
        telegram: telegram.trim(),

        chain: "Robinhood Chain",
        listedAt: new Date().toISOString(),

        description:
          `New token launched on Aelvora Launchpad by ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}.`,

        source: "aelvora-launchpad",
        verified: false,
        featured: false,
      };

      const existing = JSON.parse(
        localStorage.getItem("aelvora_created_tokens") || "[]"
      );

      const filtered = existing.filter(
        (item) =>
          item.contract?.toLowerCase() !==
          tokenRecord.contract.toLowerCase()
      );

      localStorage.setItem(
        "aelvora_created_tokens",
        JSON.stringify([tokenRecord, ...filtered])
      );

      // Publish token globally to Aelvora Market → Newest.
      // This is server-side so every user can see it.
      fetch("/api/market/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: tokenRecord,
        }),
      }).catch((error) => {
        console.warn(
          "[AELVORA MARKET] Global token publish failed:",
          error
        );
      });

      // Telegram notification is non-blocking.
      // A Telegram failure must never fail token creation.
      fetch("/api/telegram/new-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: {
            name: tokenRecord.name,
            symbol: tokenRecord.symbol,
            marketCap: "N/A",
            liquidity: "N/A",
            price: "N/A",
            contract: tokenRecord.contract,
            chain: tokenRecord.chain,
            tradeUrl: `https://aelvoramarket.com/swap/${tokenRecord.contract}`,
            marketUrl: "https://aelvoramarket.com/market",
          },
        }),
      }).catch((error) => {
        console.warn(
          "[TELEGRAM NEW TOKEN] Notification failed:",
          error
        );
      });

      window.dispatchEvent(
        new CustomEvent("aelvora:token-created", {
          detail: tokenRecord,
        })
      );

      setCreatedToken(created.token);

      setTxStatus(
        "Token created and added to Aelvora Market → Newest."
      );
    } catch (error) {
      setTxError(
        error?.shortMessage ||
        error?.message ||
        "Transaction failed."
      );
      setTxStatus("");
    } finally {
      setCreating(false);
    }
  };

  const connected =
    Boolean(walletAddress && getActiveWalletProvider());

  const wrongNetwork =
    connected &&
    !isRobinhoodChain(walletChainId);

  return (
    <div className="create-token-page">
      <header className="create-token-navbar">
        <button
          type="button"
          className="create-token-brand"
          onClick={onBack}
          style={{
            background: "none",
            border: 0,
            cursor: "pointer",
          }}
        >
          <span className="create-token-brand-mark">
            <img
              src={SITE_CONFIG.brand.logo.icon}
              alt="AELVORA"
            />
          </span>

          <span>
            <strong>AELVORA</strong>
            <small>MARKET</small>
          </span>
        </button>

        <div className="create-token-wallet">
          {connected ? (
            <div className="create-token-wallet-actions">
              {walletBalance !== null && (
                <span className="create-token-balance">
                  {walletBalance} ETH
                </span>
              )}

              <span className="create-token-address">
                {walletAddress.slice(0, 6)}
                ...
                {walletAddress.slice(-4)}
              </span>

              <button
                type="button"
                className="create-token-disconnect"
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="create-token-connect"
              onClick={onConnect}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className="create-token-main">
        <button
          type="button"
          onClick={onBack}
          className="create-token-back"
        >
          ← Back to Home
        </button>

        <div className="create-token-heading">
          <span>LAUNCHPAD / CREATE</span>

          <h1>
            Create your
            <em> token</em>
          </h1>

          <p>
            Launch a new market on AELVORA with
            transparent creator settings and
            ETH liquidity.
          </p>
        </div>

        {!connected && (
          <div className="create-token-notice">
            <strong>Wallet not connected</strong>

            <p>
              Connect your wallet to create a
              token on Robinhood Chain.
            </p>

            <button
              type="button"
              className="create-token-connect"
              onClick={onConnect}
            >
              Connect Wallet
            </button>
          </div>
        )}

        {wrongNetwork && (
          <div className="create-token-error">
            <span className="create-token-network-message">
              Your wallet is connected to the
              wrong network. Please switch to
              Robinhood Chain before creating a
              token.
            </span>

            <button
              type="button"
              className="create-token-connect"
              disabled={switchingChain}
              onClick={async () => {
                const provider =
                  getActiveWalletProvider();

                if (!provider || switchingChain) {
                  return;
                }

                try {
                  setSwitchingChain(true);
                  await switchToRobinhoodChain(provider);
                } catch (err) {
                  console.error(
                    "Failed to switch network:",
                    err
                  );
                } finally {
                  setSwitchingChain(false);
                }
              }}
            >
              {switchingChain
                ? "Switching..."
                : "Switch to Robinhood Chain"}
            </button>
          </div>
        )}

        <section className="create-token-card">
          <div className="create-token-card-header">
            <div>
              <span className="create-token-kicker">
                TOKEN SETUP
              </span>

              <h2>Token Information</h2>
            </div>

            <span className="create-token-network">
              ◈ ROBINHOOD CHAIN
            </span>
          </div>

          <div className="create-token-form">
            <label>
              <span>Token Name</span>

              <input
                type="text"
                placeholder="e.g. Aelvora"
                value={tokenName}
                onChange={(e) =>
                  setTokenName(
                    e.target.value
                  )
                }
              />
            </label>



            <label>
              <span>Token Symbol</span>

              <input
                type="text"
                placeholder="e.g. AELV"
                value={symbol}
                onChange={(e) =>
                  setSymbol(
                    e.target.value
                      .toUpperCase()
                  )
                }
              />

              {aelvSymbolLocked && (
                <small className="create-token-symbol-notice">
                  This symbol cannot be used. Please change the symbol.
                </small>
              )}
            </label>

            <label className="form-wide">
              <span>Token Logo</span>

              <div>
                <input
                  id="token-logo-upload"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoChange}
                  style={{ display: "none" }}
                />

                <label
                  htmlFor="token-logo-upload"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 14px",
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Choose file
                </label>

                <small style={{ marginLeft: "10px" }}>
                  {logoData
                    ? "File selected"
                    : "No file chosen"}
                </small>
              </div>

              <small>
                PNG, JPG, or JPEG
              </small>

              {logoError && (
                <small className="create-token-logo-error">
                  {logoError}
                </small>
              )}

              {logoData && (
                <div className="create-token-logo-preview">
                  <img
                    src={logoData}
                    alt="Token logo preview"
                  />

                  <div>
                    <strong>Logo ready to use.</strong>
                    <small>
                      Logo ready
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLogoData("");
                      setLogoError("");
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </label>

            <label>
              <span>Website</span>

              <input
                type="text"
                placeholder="https://example.com"
                value={website}
                onChange={(e) =>
                  setWebsite(e.target.value)
                }
              />

              <small>
                Optional project website.
              </small>
            </label>

            <label>
              <span>X / Twitter</span>

              <input
                type="text"
                placeholder="https://x.com/yourproject"
                value={twitter}
                onChange={(e) =>
                  setTwitter(e.target.value)
                }
              />

              <small>
                Optional X / Twitter profile.
              </small>
            </label>

            <label>
              <span>Telegram</span>

              <input
                type="text"
                placeholder="https://t.me/yourproject"
                value={telegram}
                onChange={(e) =>
                  setTelegram(e.target.value)
                }
              />

              <small>
                Optional Telegram community.
              </small>
            </label>

            <label className="form-wide">
              <span>Total Supply</span>

              <input
                type="text"
                inputMode="numeric"
                placeholder="1000000000"
                value={totalSupply}
                onChange={(e) => {
                  const value =
                    e.target.value.replace(
                      /,/g,
                      ""
                    );

                  if (/^\d*$/.test(value)) {
                    if (
                      value === "" ||
                      BigInt(value || "0") <=
                        MAX_TOTAL_SUPPLY
                    ) {
                      setTotalSupply(value);
                    }
                  }
                }}
              />

              <small>
                Maximum total supply:
                1,000,000,000,000 tokens.
              </small>
            </label>

            <label>
              <span>Decimals</span>

              <input
                type="number"
                value="18"
                disabled
              />

              <small>
                Fixed at 18 decimals by the
                current token contract.
              </small>
            </label>
          </div>
        </section>

        <section className="create-token-card">
          <div className="create-token-card-header">
            <div>
              <span className="create-token-kicker">
                CREATOR SETTINGS
              </span>

              <h2>Fees & Initial Buy</h2>
            </div>
          </div>

          <div className="create-token-form">
            <label>
              <span>Creator Tax</span>

              <div className="input-with-suffix">
                <input
                  type="number"
                  min={CREATOR_TAX_MIN}
                  max={CREATOR_TAX_MAX}
                  step="0.1"
                  value={creatorTax}
                  onChange={(e) => {
                    const value =
                      e.target.value;

                    if (
                      value === "" ||
                      Number(value) <=
                        CREATOR_TAX_MAX
                    ) {
                      setCreatorTax(value);
                    }
                  }}
                />

                <b>%</b>
              </div>

              <small>
                Creator tax can be set from
                0% to 5%.
              </small>
            </label>

            <label>
              <span>
                Initial Creator Buy
              </span>

              <div className="input-with-suffix">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.000000"
                  value={initialBuy}
                  onChange={(e) =>
                    setInitialBuy(
                      e.target.value
                    )
                  }
                />

                <b>ETH</b>
              </div>

              <small>
                Initial purchase using
                Robinhood Chain ETH.
              </small>
            </label>

            <div className="create-token-fixed-fee">
              <div>
                <span>AELVORA Fee</span>

                <strong>
                  {AELVORA_FEE}%
                </strong>
              </div>

              <small>
                Fixed protocol fee.
              </small>
            </div>

            <div className="create-token-fixed-fee create-token-launch-fee">
              <div>
                <span>Launch Fee</span>

                <strong>
                  {LAUNCH_FEE_ETH} ETH
                </strong>
              </div>

              <small>
                Fixed launch fee paid by the
                creator.
              </small>
            </div>
          </div>
        </section>

        <section className="create-token-summary">
          <div>
            <span>PAIR</span>
            <strong>
              ETH / Robinhood
            </strong>
          </div>

          <div>
            <span>CREATOR TAX</span>
            <strong>
              {creatorTax || "0"}%
            </strong>
          </div>

          <div>
            <span>AELVORA FEE</span>
            <strong>
              1% FIXED
            </strong>
          </div>

          <div>
            <span>LAUNCH FEE</span>
            <strong>
              {LAUNCH_FEE_ETH} ETH
            </strong>
          </div>
        </section>

        <button
          type="button"
          className="create-token-submit"
          disabled={
            !connected ||
            wrongNetwork ||
            creating ||
            aelvSymbolLocked
          }
          onClick={handleCreateToken}
        >
          {!connected
            ? "Connect Wallet to Continue"
            : wrongNetwork
              ? "Wrong Network"
              : creating
                ? "Creating Token..."
                : "Create Token"}
        </button>

        {txHash && (
          <div className="create-token-tx-status">
            <span>Transaction:</span>{" "}

            <a
              href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortHash(txHash)}
            </a>
          </div>
        )}

        {txStatus && (
          <div className="create-token-success">
            {txStatus}
          </div>
        )}

        {txError && (
          <div className="create-token-error">
            {txError}
          </div>
        )}

        {createdToken && (
          <div className="create-token-success">
            Token:
            {" "}
            {createdToken}
          </div>
        )}
      </main>
    </div>
  );
}
