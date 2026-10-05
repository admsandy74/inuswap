import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  MARKET_CATEGORIES,
  MARKET_TOKENS,
  getMarketTokens,
  getTrendingTokens,
  getMarketTokensWithCreated,
} from "./marketData";
import "./market.css";
import { fetchLiveMarketData, fetchLiveMarketDataByAddress } from "./marketApi";
import { createPublicClient, http } from "viem";


// ============================================================
// AELVORA MARKET - ON-CHAIN GRADUATION STATUS
// Factory V2 -> curveOf(token) -> migrationCompleted()
// ============================================================

const AELVORA_MARKET_FACTORY_V2 =
  "0x731197c3cF5A5B7100feb86e6C4B730276a7c727";

const AELVORA_MARKET_RPC =
  "https://rpc.mainnet.chain.robinhood.com";

const AELVORA_FACTORY_MARKET_ABI = [
  {
    type: "function",
    name: "curveOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
];

const AELVORA_CURVE_MARKET_ABI = [
  {
    type: "function",
    name: "migrationCompleted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
];

const aelvoraMarketClient = createPublicClient({
  chain: {
    id: 4663,
    name: "Robinhood Chain",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [AELVORA_MARKET_RPC],
      },
    },
  },
  transport: http(AELVORA_MARKET_RPC),
});

async function getAelvoraGraduationStatus(tokenAddress) {
  try {
    if (!tokenAddress) return false;

    const curveAddress = await aelvoraMarketClient.readContract({
      address: AELVORA_MARKET_FACTORY_V2,
      abi: AELVORA_FACTORY_MARKET_ABI,
      functionName: "curveOf",
      args: [tokenAddress],
    });

    if (
      !curveAddress ||
      curveAddress === "0x0000000000000000000000000000000000000000"
    ) {
      return false;
    }

    return await aelvoraMarketClient.readContract({
      address: curveAddress,
      abi: AELVORA_CURVE_MARKET_ABI,
      functionName: "migrationCompleted",
    });
  } catch (error) {
    console.warn(
      "[AELVORA MARKET] Failed to read graduation status:",
      tokenAddress,
      error
    );

    return false;
  }
}

async function syncGraduatedTokens() {
  try {
    const raw = localStorage.getItem("aelvora_created_tokens");

    if (!raw) return;

    const tokens = JSON.parse(raw);

    if (!Array.isArray(tokens) || tokens.length === 0) return;

    let changed = false;

    const updatedTokens = await Promise.all(
      tokens.map(async (token) => {
        if (!token?.contract) return token;

        if (
          token.category === "graduate" ||
          token.status === "graduated"
        ) {
          return token;
        }

        const graduated = await getAelvoraGraduationStatus(
          token.contract
        );

        if (!graduated) return token;

        // Telegram graduation notification is non-blocking.
        // A Telegram failure must never affect graduation sync.
        try {
          const live = await fetchLiveMarketDataByAddress(
            token.contract,
            token.symbol || "TOKEN"
          );

          fetch("/api/telegram/graduate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: {
                name: token.name || live?.name || "Unknown",
                symbol: token.symbol || live?.symbol || "TOKEN",
                marketCap: live?.marketCap ?? "N/A",
                liquidity: live?.liquidity ?? "N/A",
                volume24h: live?.volume24h ?? "N/A",
                price: live?.price ?? "N/A",
                contract: token.contract,
                chain: "Robinhood Chain",
                tradeUrl: `https://aelvoramarket.com/swap/${token.contract}`,
                marketUrl: "https://aelvoramarket.com/market",
              },
            }),
          }).catch((error) => {
            console.warn(
              "[TELEGRAM GRADUATE] Notification failed:",
              error
            );
          });
        } catch (error) {
          console.warn(
            "[TELEGRAM GRADUATE] Market data fetch failed:",
            error
          );
        }

        changed = true;

        return {
          ...token,
          category: "graduate",
          status: "graduated",
          graduatedAt: token.graduatedAt || Date.now(),
        };
      })
    );

    if (!changed) return;

    localStorage.setItem(
      "aelvora_created_tokens",
      JSON.stringify(updatedTokens)
    );

    window.dispatchEvent(
      new CustomEvent("aelvora:market-graduated")
    );
  } catch (error) {
    console.warn(
      "[AELVORA MARKET] Graduation sync failed:",
      error
    );
  }
}

function Arrow() {
  return <span className="market-arrow">↗</span>;
}

function TokenLogo({ token }) {
  if (token.logo) {
    return (
      <div className="market-token-logo">
        <img src={token.logo} alt="" />
      </div>
    );
  }

  return (
    <div className="market-token-logo market-token-logo-placeholder">
      {token.symbol.replace("$", "").slice(0, 1)}
    </div>
  );
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}


function formatLiveUSD(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "LIVE SOON";
  }

  if (n >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  }

  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }

  if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(2)}K`;
  }

  return `$${n.toFixed(2)}`;
}

function formatLivePrice(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "LIVE SOON";
  }

  if (n === 0) {
    return "$0";
  }

  if (n >= 1) {
    return `$${n.toFixed(2)}`;
  }

  if (n >= 0.01) {
    return `$${n.toFixed(4)}`;
  }

  if (n >= 0.0001) {
    return `$${n.toFixed(6)}`;
  }

  return `$${n.toPrecision(4)}`;
}

function TokenCard({ token }) {
  const categoryLabel =
    token.category === "graduate"
      ? "GRADUATE"
      : token.category === "fasttrack"
        ? "FASTTRACK"
        : "NEW";

  return (
    <article
      className="market-token-card"
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!token.contract) return;

        window.history.pushState(
          {},
          "",
          `/swap/${token.contract}`
        );

        window.dispatchEvent(
          new PopStateEvent("popstate")
        );
      }}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" ||
            event.key === " ") &&
          token.contract
        ) {
          event.preventDefault();

          window.history.pushState(
            {},
            "",
            `/swap/${token.contract}`
          );

          window.dispatchEvent(
            new PopStateEvent("popstate")
          );
        }
      }}
    >
      <div className="market-token-top">
        <TokenLogo token={token} />

        <div className="market-token-title">
          <div className="market-token-name-row">
            <h3>{token.name}</h3>

            {token.verified && (
              <span className="market-verified">
                ✓
              </span>
            )}
          </div>

          <span className="market-token-symbol">
            {token.symbol}
          </span>
        </div>

        <div className="market-token-badges">
          <span
            className={`market-token-badge market-token-badge-${token.category}`}
          >
            {categoryLabel}
          </span>

          {token.liveData ? (
            <span className="market-token-live-soon">
              LIVE
            </span>
          ) : (
            <span className="market-token-live-soon">
              LIVE SOON
            </span>
          )}
        </div>
      </div>

      <p className="market-token-description">
        {token.description}
      </p>

      <div className="market-token-live-row">
        <div>
          <span>PRICE</span>
          <strong>
            {token.liveData
              ? formatLivePrice(token.price)
              : "LIVE SOON"}
          </strong>
        </div>

        <div>
          <span>DEX</span>
          <strong>
            {token.liveData && token.dex
              ? token.dex
              : "LIVE SOON"}
          </strong>
        </div>

        <div className="market-token-live-status">
          <span>STATUS</span>
          <strong>
            {token.liveData ? "LIVE" : "—"}
          </strong>
        </div>
      </div>

      <div className="market-token-stats">
        <div>
          <span>Market Cap</span>
          <strong>
            {token.liveData
              ? formatLiveUSD(token.marketCap)
              : "LIVE SOON"}
          </strong>
        </div>

        <div>
          <span>24H Volume</span>
          <strong>
            {token.liveData
              ? formatLiveUSD(token.volume24h)
              : "LIVE SOON"}
          </strong>
        </div>

        <div>
          <span>Liquidity</span>
          <strong>
            {token.liveData
              ? formatLiveUSD(token.liquidity)
              : "LIVE SOON"}
          </strong>
        </div>
      </div>

      <div className="market-token-footer">
        <span>{token.chain}</span>
        <span>{formatDate(token.listedAt)}</span>
      </div>
    </article>
  );
}

function FasttrackForm({ onClose }) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="market-submit-success">
        <span className="market-success-icon">✓</span>

        <h3>Submission received</h3>

        <p>
          Your market has been submitted for admin
          review. Approved listings will appear in
          Aelvora Market.
        </p>

        <button
          type="button"
          className="market-button market-button-primary"
          onClick={onClose}
        >
          Back to Market
        </button>
      </div>
    );
  }

  return (
    <form
      className="market-submit-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="market-form-header">
        <span>LIST YOUR MARKET</span>

        <button
          type="button"
          onClick={onClose}
          className="market-modal-close"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <h2>List your token</h2>

      <p>
        Submit an existing market for Aelvora
        Fasttrack review.
      </p>

      <div className="market-form-grid">
        <label>
          <span>Token Name</span>
          <input
            name="name"
            placeholder="e.g. Aelvora"
            required
          />
        </label>

        <label>
          <span>Symbol</span>
          <input
            name="symbol"
            placeholder="e.g. AELV"
            required
          />
        </label>

        <label className="market-form-full">
          <span>Contract Address</span>
          <input
            name="contract"
            placeholder="0x..."
            required
          />
        </label>

        <label>
          <span>Website</span>
          <input
            name="website"
            placeholder="https://..."
          />
        </label>

        <label>
          <span>X / Twitter</span>
          <input
            name="x"
            placeholder="https://x.com/..."
          />
        </label>

        <label>
          <span>Telegram</span>
          <input
            name="telegram"
            placeholder="https://t.me/..."
          />
        </label>

        <label>
          <span>CoinGecko</span>
          <input
            name="coingecko"
            placeholder="CoinGecko URL"
          />
        </label>

        <label className="market-form-full">
          <span>Description</span>
          <textarea
            name="description"
            rows="4"
            placeholder="Tell us about the project..."
          />
        </label>
      </div>

      <div className="market-form-note">
        <strong>Fasttrack</strong>

        <span>
          Paid fasttrack review can be added later.
          All listings remain subject to admin
          approval.
        </span>
      </div>

      <button
        type="submit"
        className="market-button market-button-primary market-button-submit"
      >
        Submit for Review
        <Arrow />
      </button>
    </form>
  );
}

export default function MarketPage({
  onBack = () => {},
}) {

  const [aelvoraGraduationVersion, setAelvoraGraduationVersion] =
    useState(0);

  useEffect(() => {
    let active = true;

    const runSync = async () => {
      await syncGraduatedTokens();

      if (active) {
        setAelvoraGraduationVersion((v) => v + 1);
      }
    };

    runSync();

    const interval = setInterval(runSync, 15000);

    const handleGraduated = () => {
      if (active) {
        setAelvoraGraduationVersion((v) => v + 1);
      }
    };

    window.addEventListener(
      "aelvora:market-graduated",
      handleGraduated
    );

    return () => {
      active = false;
      clearInterval(interval);

      window.removeEventListener(
        "aelvora:market-graduated",
        handleGraduated
      );
    };
  }, []);


  const [activeCategory, setActiveCategory] =
    useState("all");

  const [showSubmit, setShowSubmit] =
    useState(false);

  const [trendingPage, setTrendingPage] =
    useState(1);

  const [marketPage, setMarketPage] =
    useState(1);

  const CARDS_PER_PAGE = 8;

  const [liveMarketData, setLiveMarketData] =
    useState({});

  useEffect(() => {
    let cancelled = false;

    const loadMarkets = async () => {
      const data =
        await fetchLiveMarketData();

      if (!cancelled) {
        setLiveMarketData(data);
      }
    };

    loadMarkets();

    const interval = setInterval(
      loadMarkets,
      15000
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const trending = useMemo(
    () => getTrendingTokens(),
    []
  );

  const [serverCreatedTokens, setServerCreatedTokens] =
    useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadServerCreatedTokens = async () => {
      try {
        const response = await fetch(
          "/api/market/tokens",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load global market tokens."
          );
        }

        const data = await response.json();

        const tokens =
          Array.isArray(data?.tokens)
            ? data.tokens
            : [];

        if (!cancelled) {
          setServerCreatedTokens(tokens);
        }
      } catch (error) {
        console.warn(
          "[AELVORA MARKET] Global token load failed:",
          error
        );

        if (!cancelled) {
          setServerCreatedTokens([]);
        }
      }
    };

    loadServerCreatedTokens();

    const timer = setInterval(
      loadServerCreatedTokens,
      15000
    );

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const tokens = useMemo(() => {
    const baseTokens =
      activeCategory === "all"
        ? MARKET_TOKENS
        : MARKET_TOKENS.filter(
            (token) =>
              token.category === activeCategory
          );

    const createdTokens =
      activeCategory === "all"
        ? serverCreatedTokens
        : serverCreatedTokens.filter(
            (token) =>
              token.category === activeCategory
          );

    return [
      ...createdTokens,
      ...baseTokens,
    ];
  }, [
    activeCategory,
    serverCreatedTokens,
    aelvoraGraduationVersion,
  ]);

  const liveTokens = useMemo(() => {
    return tokens.map((token) => {
      const live =
        liveMarketData[token.id];

      if (!live?.live) {
        return token;
      }

      return {
        ...token,

        name:
          live.name || token.name,

        symbol:
          live.symbol || token.symbol,

        price: live.price,
        marketCap: live.marketCap,
        volume24h: live.volume24h,
        liquidity: live.liquidity,

        liveData: true,

        /*
         * Existing logos MUST NOT disappear.
         * API hanya boleh mengganti jika benar-benar
         * provide a valid logo URL.
         */
        logo:
          token.source === "aelvora-launchpad"
            ? token.logo
            : (
                typeof live.logo === "string" &&
                live.logo.trim() !== ""
                  ? live.logo
                  : token.logo
              ),

        live: true,

        pairAddress:
          live.pairAddress,

        dex:
          live.dex,

        marketUrl:
          live.url,
      };
    });
  }, [tokens, liveMarketData]);

  const liveTrending = useMemo(() => {
    return trending.map((token) => {
      const live =
        liveMarketData[token.id];

      if (!live?.live) {
        return token;
      }

      return {
        ...token,

        name:
          live.name || token.name,

        symbol:
          live.symbol || token.symbol,

        price: live.price,
        marketCap: live.marketCap,
        volume24h: live.volume24h,
        liquidity: live.liquidity,

        logo:
          token.source === "aelvora-launchpad"
            ? token.logo
            : (live.logo || token.logo),

        live: true,
        liveData: true,

        pairAddress:
          live.pairAddress,

        dex:
          live.dex,

        marketUrl:
          live.url,
      };
    });
  }, [trending, liveMarketData]);

  /*
   * ----------------------------------------------------------
   * PAGINATION
   * 8 cards per page.
   * Applies to Trending and all Market categories.
   * ----------------------------------------------------------
   */

  /*
   * AELVORA MUST ALWAYS BE CARD #1 IN TRENDING.
   * Urutan ini dilakukan SEBELUM pagination slice(),
   * sehingga AELVORA pasti masuk Page 1.
   */
  /*
   * ==========================================================
   * TRENDING ORDER
   * ==========================================================
   *
   * AELVORA is always #1.
   *
   * Fasttrack tokens:
   * trendingOrder = position defined in marketData.js
   *
   * Contoh:
   *   AELVORA       -> #1
   *   trendingOrder 2 -> #2
   *   trendingOrder 8 -> #8
   *
   * Tokens without trendingOrder appear after tokens
   * that have an order.
   */

  const orderedTrending = (() => {
    const aelvora = liveTrending.find(
      (token) =>
        token.id === "aelvora-graduate-demo" ||
        token.id === "aelvora" ||
        token.symbol === "$AELV" ||
        token.symbol === "AELV"
    );

    const others = liveTrending
      .filter(
        (token) =>
          token !== aelvora
      )
      .sort((a, b) => {
        const orderA =
          Number.isFinite(
            Number(a.trendingOrder)
          )
            ? Number(a.trendingOrder)
            : Infinity;

        const orderB =
          Number.isFinite(
            Number(b.trendingOrder)
          )
            ? Number(b.trendingOrder)
            : Infinity;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return (
          new Date(b.listedAt || 0) -
          new Date(a.listedAt || 0)
        );
      });

    return aelvora
      ? [aelvora, ...others]
      : others;
  })();

  const trendingTotalPages =
    Math.max(
      1,
      Math.ceil(
        orderedTrending.length /
          CARDS_PER_PAGE
      )
    );

  const marketTotalPages =
    Math.max(
      1,
      Math.ceil(
        liveTokens.length /
          CARDS_PER_PAGE
      )
    );

  const pagedTrending =
    orderedTrending.slice(
      (trendingPage - 1) *
        CARDS_PER_PAGE,
      trendingPage *
        CARDS_PER_PAGE
    );

  const pagedMarkets =
    liveTokens.slice(
      (marketPage - 1) *
        CARDS_PER_PAGE,
      marketPage *
        CARDS_PER_PAGE
    );

  return (
    <div className="market-page">
      <div className="market-page-bg" />

      <header className="market-navbar">
        <button
          type="button"
          className="market-brand"
          onClick={onBack}
        >
          <span className="market-brand-mark">
            <img
              src="/assets/logo-icon.svg"
              alt="AELVORA"
            />
          </span>

          <span className="market-brand-text">
            <strong>AELVORA</strong>
            <small>MARKET</small>
          </span>
        </button>

        <button
          type="button"
          className="market-button market-button-outline"
          onClick={() => setShowSubmit(true)}
        >
          List Your Market
          <Arrow />
        </button>
      </header>

      <div className="market-back-home">
        <button
          type="button"
          className="market-button-home"
          onClick={onBack}
        >
          ← Back to Home
        </button>
      </div>

      <main className="market-main">
        <section className="market-hero">
          <div>
            <span className="market-kicker">
              AELVORA / MARKET
            </span>

            <h1>
              Discover the
              <em> Aelvora Market</em>
            </h1>

            <p>
              Explore live markets across Robinhood
              Chain. Discover new launches, graduated
              markets, and Fasttrack listings.
            </p>
          </div>

          <div className="market-hero-stat">
            <span>LIVE MARKETS</span>
            <strong>{MARKET_TOKENS.length}</strong>
          </div>
        </section>

        <section className="market-trending">
          <div className="market-section-heading">
            <div>
              <span className="market-kicker">
                01 / FEATURED
              </span>

              <h2>Trending</h2>
            </div>

            <p>
              Graduated and Fasttrack markets currently featured on Aelvora
            </p>
          </div>

          <div className="market-trending-grid">
            {pagedTrending.map((token) => (
              <TokenCard
                key={token.id}
                token={token}
              />
            ))}
          </div>

          {trendingTotalPages > 1 && (
            <div className="market-pagination">
              <button
                type="button"
                disabled={trendingPage === 1}
                onClick={() =>
                  setTrendingPage(
                    (page) => page - 1
                  )
                }
              >
                ←
              </button>

              <span>
                Page {trendingPage} / {trendingTotalPages}
              </span>

              <button
                type="button"
                disabled={
                  trendingPage ===
                  trendingTotalPages
                }
                onClick={() =>
                  setTrendingPage(
                    (page) => page + 1
                  )
                }
              >
                →
              </button>
            </div>
          )}
        </section>

        <section className="market-explorer">
          <div className="market-section-heading">
            <div>
              <span className="market-kicker">
                02 / EXPLORE
              </span>

              <h2>Markets</h2>
            </div>

          </div>

          <div className="market-tabs">
            {MARKET_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={
                  activeCategory === category.id
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setActiveCategory(category.id);
                  setMarketPage(1);
                }}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="market-grid">
            {liveTokens.length > 0 ? (
              pagedMarkets.map((token) => (
                <TokenCard
                  key={token.id}
                  token={token}
                />
              ))
            ) : (
              <div className="market-empty">
                <strong>No markets yet.</strong>
                <span>
                  New approved markets will appear
                  here.
                </span>
              </div>
            )}
          </div>

          {marketTotalPages > 1 && (
            <div className="market-pagination">
              <button
                type="button"
                disabled={marketPage === 1}
                onClick={() =>
                  setMarketPage(
                    (page) => Math.max(1, page - 1)
                  )
                }
              >
                Previous
              </button>

              {Array.from(
                { length: marketTotalPages },
                (_, index) => index + 1
              ).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={
                    marketPage === page
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setMarketPage(page)
                  }
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={
                  marketPage === marketTotalPages
                }
                onClick={() =>
                  setMarketPage(
                    (page) =>
                      Math.min(
                        marketTotalPages,
                        page + 1
                      )
                  )
                }
              >
                Next
              </button>
            </div>
          )}
        </section>

        <section className="market-fasttrack-banner">
          <div>
            <span className="market-kicker">
              AELVORA FASTTRACK
            </span>

            <h2>
              Already launched elsewhere?
            </h2>

            <p>
              Bring your live market to Aelvora and
              apply for a Fasttrack listing.
            </p>
          </div>

          <button
            type="button"
            className="market-button market-button-primary"
            onClick={() => setShowSubmit(true)}
          >
            Apply for Fasttrack
            <Arrow />
          </button>
        </section>
      </main>

      {showSubmit && (
        <div
          className="market-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowSubmit(false);
            }
          }}
        >
          <div className="market-modal">
            <FasttrackForm
              onClose={() =>
                setShowSubmit(false)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
