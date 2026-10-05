const DEX_TOKEN_API =
  "https://api.dexscreener.com/latest/dex/tokens/";

const DEX_PROFILE_API =
  "https://api.dexscreener.com/token-profiles/latest/v1";

const ROBINHOOD_CHAIN = "robinhood";

/*
 * Special logo fallback for tokens that do not have one yet
 * icon aktif di DexScreener.
 *
 * DO NOT modify AELVORA.
 */
const CUSTOM_TOKEN_LOGOS = {
  hood:
    "https://greenhood.club/favicon.png",

  blorb:
    "https://blorbmeme.xyz/favicon.png",
};

const TOKEN_CONFIG = {





  fasttrack_7fe995a8: {
    symbol: "HMM",
    address:
      "0x7fe995a80075df3dc8ae11a9b82c7fe4202cd87f",
  },

  fasttrack_07ebb29a: {
    symbol: "BUN",
    address:
      "0x07ebb29a38fbcb41563817e5e19f2cec619c90d2",
  },

  fasttrack_ab093def: {
    symbol: "SHROOM",
    address:
      "0xab093def657f15df31b33922a95e047add645b29",
  },

  fasttrack_7dbf3897: {
    symbol: "ZZZ",
    address:
      "0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a",
  },

  fasttrack_812486ea: {
    symbol: "UBIK",
    address:
      "0x812486eaea648819853f8e372dc9f1516c7868bd",
  },

  fasttrack_0e0d2c89: {
    symbol: "CHUMP",
    address:
      "0x0e0d2c89a5a019fe1cf762e5e33187631dacc21b",
  },

  fasttrack_5cb6f181: {
    symbol: "PIPEDOG",
    address:
      "0x5cb6f181081301b44905f3ae15419112ecabd8a6",
  },

  fasttrack_98096d17: {
    symbol: "BONER",
    address:
      "0x98096d17e191b3da1d5f99a6d7b3584351b11e18",
  },



  fasttrack_2e8c3116: {
    symbol: "AI",
    address:
      "0x2e8c31162b855a2ffa90f6f8634643ad6f111e18",
  },

  fasttrack_39dbed3a: {
    symbol: "PONS",
    address:
      "0x39dbed3a2bd333467115de45665cc57f813c4571",
  },

  fasttrack_1cdb289b: {
    symbol: "XL",
    address:
      "0x1cDb289BeFDFaC8aF945a288BCdcCc382cB34d32",
  },

  fasttrack_020bfc65: {
    symbol: "CASHCAT",
    address:
      "0x020bfc650a365f8bb26819deaabf3e21291018b4",
  },

  fasttrack_008df4b3: {
    symbol: "ROBINHOOD",
    address:
      "0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005",
  },

  fasttrack_ef82ddc5: {
    symbol: "SI",
    address:
      "0xEF82DDc566653699B89C3aFe123559a75aAA2976",
  },

  fasttrack_298348d5: {
    symbol: "swappy",
    address:
      "0x298348d5b2e45C774E3ee4f1a0924071DfbDC8C7",
  },

  fasttrack_743acf78: {
    symbol: "WHEN",
    address:
      "0x743ACf789e0f5419f550323A2349732A61c15439",
  },

  fasttrack_42afa212: {
    symbol: "SCHIFFY",
    address:
      "0x42aFA2124ca5a2B83898E46B2dA9a190995b1E18",
  },

  fasttrack_aa07a0e9: {
    symbol: "ORBIO",
    address:
      "0xAa07A0e9209e16aC99708C3EC70159c6eF3128A3",
  },

  fasttrack_5e55f184: {
    symbol: "DEED",
    address:
      "0x5E55f18453545d0D4314C5106a2D8Db934298E95",
  },

  fasttrack_e8ffd7e2: {
    symbol: "DELTA",
    address:
      "0xe8ffd7e24187F72afB08d75B1bb13088A989a791",
  },

  fasttrack_85722b0c: {
    symbol: "MUSEPAD",
    address:
      "0x85722b0c29f7343B404bDA388169834028D6D011",
  },

};

function normalize(value) {
  return String(value || "").toLowerCase();
}

function isCorrectToken(pair, config) {
  const address = normalize(config.address);

  return (
    normalize(pair?.baseToken?.address) === address ||
    normalize(pair?.quoteToken?.address) === address
  );
}

function isRobinhoodPair(pair) {
  return normalize(pair?.chainId) === ROBINHOOD_CHAIN;
}

function liquidityValue(pair) {
  return Number(pair?.liquidity?.usd || 0);
}

/*
 * Find the correct pair.
 *
 * Prioritas:
 * 1. Robinhood
 * 2. token address MUST match
 * 3. token should be the BASE token when available
 * 4. liquidity terbesar sebagai fallback
 */
function findBestPair(pairs, config) {
  const address = normalize(config.address);
  const symbol = normalize(config.symbol);

  const valid = (pairs || []).filter(
    (pair) =>
      isRobinhoodPair(pair) &&
      isCorrectToken(pair, config)
  );

  if (!valid.length) {
    return null;
  }

  const baseMatches = valid.filter(
    (pair) =>
      normalize(pair?.baseToken?.address) === address
  );

  const symbolMatches = baseMatches.filter(
    (pair) =>
      normalize(pair?.baseToken?.symbol) === symbol
  );

  const candidates =
    symbolMatches.length
      ? symbolMatches
      : baseMatches.length
        ? baseMatches
        : valid;

  candidates.sort(
    (a, b) =>
      liquidityValue(b) -
      liquidityValue(a)
  );

  return candidates[0] || null;
}

/*
 * Fetch the logo from the DexScreener Token Profile.
 */
async function fetchTokenLogo(config) {
  try {
    const response =
      await fetch(DEX_PROFILE_API);

    if (!response.ok) {
      return null;
    }

    const profiles =
      await response.json();

    const address =
      normalize(config.address);

    const profile =
      (profiles || []).find(
        (item) =>
          normalize(item?.chainId) === ROBINHOOD_CHAIN &&
          normalize(item?.tokenAddress) === address
      );

    if (profile?.icon) {
      console.log(
        `[AELVORA] ${config.symbol} LOGO`,
        profile.icon
      );

      return profile.icon;
    }
  } catch (error) {
    console.warn(
      `[AELVORA] ${config.symbol} logo fetch failed`,
      error
    );
  }

  /*
   * Fallback to the DexScreener logo asset.
   */
  return `https://dd.dexscreener.com/ds-data/tokens/robinhood/${config.address}.png?size=lg`;
}

async function fetchTokenPair(config) {
  try {
    const url =
      `${DEX_TOKEN_API}${config.address}`;

    const response =
      await fetch(url, {
        cache: "no-store",
      });

    if (!response.ok) {
      console.warn(
        `[AELVORA] ${config.symbol} API ${response.status}`
      );

      return null;
    }

    const json =
      await response.json();

    const pair =
      findBestPair(
        json?.pairs,
        config
      );

    if (!pair) {
      console.warn(
        `[AELVORA] ${config.symbol} no valid Robinhood pair`
      );

      return null;
    }

    console.log(
      `[AELVORA] ${config.symbol} PAIR`,
      {
        address: config.address,
        pair: pair.pairAddress,
        base: pair.baseToken?.symbol,
        baseAddress: pair.baseToken?.address,
        price: pair.priceUsd,
        marketCap: pair.marketCap,
        fdv: pair.fdv,
        volume24h: pair.volume?.h24,
        liquidity: pair.liquidity?.usd,
      }
    );

    return pair;
  } catch (error) {
    console.error(
      `[AELVORA] ${config.symbol} fetch error`,
      error
    );

    return null;
  }
}

async function normalizePair(pair, config, key) {
  if (!pair) {
    return {
      live: false,
    };
  }

  const address =
    normalize(config.address);

  const isBaseToken =
    normalize(pair.baseToken?.address) === address;

  const token =
    isBaseToken
      ? pair.baseToken
      : pair.quoteToken;

  const tokenName =
    token?.name || null;

  const tokenSymbol =
    token?.symbol || null;

  /*
   * HOOD + BLORB use their project logos specifically.
   * Other tokens continue using the DexScreener mechanism.
   */
  const dexPairLogo =
    pair?.info?.imageUrl ||
    pair?.baseToken?.logoURI ||
    pair?.quoteToken?.logoURI ||
    null;

  const logo =
    CUSTOM_TOKEN_LOGOS[key] ||
    dexPairLogo ||
    await fetchTokenLogo(config);

  return {
    live: true,

    name:
      tokenName,

    symbol:
      tokenSymbol,

    price:
      pair.priceUsd || null,

    marketCap:
      pair.marketCap ??
      pair.fdv ??
      null,

    volume24h:
      pair.volume?.h24 ?? 0,

    liquidity:
      pair.liquidity?.usd ?? 0,

    logo,

    pairAddress:
      pair.pairAddress || null,

    dex:
      pair.dexId || null,

    chain:
      pair.chainId || null,

    url:
      pair.url || null,

    tokenAddress:
      token?.address || config.address,

    symbol:
      token?.symbol || config.symbol,
  };
}

export async function fetchLiveMarketDataByAddress(address, symbol = "TOKEN") {
  const config = {
    address,
    symbol,
  };

  const pair = await fetchTokenPair(config);

  return await normalizePair(
    pair,
    config,
    `creator_${normalize(address)}`
  );
}

export async function fetchLiveMarketData() {
  const result = {};

  await Promise.all(
    Object.entries(TOKEN_CONFIG).map(
      async ([key, config]) => {
        const pair =
          await fetchTokenPair(config);

        result[key] =
          await normalizePair(
            pair,
            config,
            key
          );
      }
    )
  );

  console.log(
    "[AELVORA] LIVE MARKET DATA",
    result
  );

  return result;
}
