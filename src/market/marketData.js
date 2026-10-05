/*
 * AELVORA MARKET
 * ------------------------------------------------------------
 * Temporary frontend data layer.
 *
 * category:
 *   newest    = newly launched on Aelvora
 *   graduate  = graduated from Aelvora Launchpad
 *   fasttrack = externally launched token listed through Fasttrack
 *
 * status:
 *   live / pending / graduated
 *
 * Later this file can be replaced by API/database data.
 */

export const MARKET_CATEGORIES = [
  {
    id: "all",
    label: "All",
  },
  {
    id: "newest",
    label: "Newest",
  },
  {
    id: "graduate",
    label: "Graduate",
  },
  {
    id: "fasttrack",
    label: "Fasttrack",
  },
];

export const MARKET_TOKENS = [
  {
    id: "fasttrack_85722b0c",
    name: "Musepad",
    symbol: "$MUSEPAD",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.001161",
    marketCap: "1161554.0",
    volume24h: "5619867.2",
    liquidity: "98261.73",

    logo: "https://cdn.dexscreener.com/cms/images/OiW07tBmCXfzqqE_?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x85722b0c29f7343B404bDA388169834028D6D011",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xFafAc5cd5F43916634Ffc2a14607039a8C69aE60",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 19,
  },

  {
    id: "fasttrack_e8ffd7e2",
    name: "Delta",
    symbol: "$DELTA",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.02402",
    marketCap: "21618275.0",
    volume24h: "8591411.24",
    liquidity: "1446985.98",

    logo: "https://cdn.dexscreener.com/cms/images/R0D6i-QgKwRAa7sg?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0xe8ffd7e24187F72afB08d75B1bb13088A989a791",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xD64FbdA67E1015dF43Fa5e49F02cA844729E5F94",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 6,
  },

  {
    id: "fasttrack_5e55f184",
    name: "Deed Estate",
    symbol: "$DEED",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.0009919",
    marketCap: "991984.0",
    volume24h: "9457620.67",
    liquidity: "96542.67",

    logo: "https://cdn.dexscreener.com/cms/images/rpwOOM7dOEgBv6PP?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x5E55f18453545d0D4314C5106a2D8Db934298E95",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x606a962c65020f9e09622bc3fda2720be64e5602c6eeb34e5d202588391de387",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 5,
  },

  {
    id: "fasttrack_aa07a0e9",
    name: "Orbio.so",
    symbol: "$ORBIO",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.08513",
    marketCap: "80879660.0",
    volume24h: "5610351.61",
    liquidity: "932596.4",

    logo: "https://cdn.dexscreener.com/cms/images/04Bm6o4q2LWDsFBz?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0xAa07A0e9209e16aC99708C3EC70159c6eF3128A3",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xea9f200e13055b82f175f44f592c4c13dd8c9d9320a66487d3c5cd90d68550ef",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 10,
  },

  {
    id: "fasttrack_42afa212",
    name: "SCHIFFY",
    symbol: "$SCHIFFY",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.009894",
    marketCap: "9797946.0",
    volume24h: "1575059.17",
    liquidity: "851797.51",

    logo: "https://cdn.dexscreener.com/cms/images/ZSdTMtjADg5Qq6m0?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x42aFA2124ca5a2B83898E46B2dA9a190995b1E18",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xc749412e31087a6e6f9210af575bc9100159fbc9f45da3ca8b26b31f3bf5777e",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 12,
  },

  {
    id: "fasttrack_743acf78",
    name: "When",
    symbol: "$WHEN",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.0004552",
    marketCap: "442303.0",
    volume24h: "73866.67",
    liquidity: "76937.38",

    logo: "https://cdn.dexscreener.com/cms/images/k1bkPSwGfZjDdVUR?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x743ACf789e0f5419f550323A2349732A61c15439",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x5Aac69Abe4D5D840690620eaAd154A03C837F5ca",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 11,
  },

  {
    id: "fasttrack_298348d5",
    name: "swappy",
    symbol: "$swappy",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.0006434",
    marketCap: "643433.0",
    volume24h: "274070.97",
    liquidity: "152042.91",

    logo: "https://cdn.dexscreener.com/cms/images/Ig6JZiaLR3Xy2pSo?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x298348d5b2e45C774E3ee4f1a0924071DfbDC8C7",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xaff8e2d7015c76fa6d9b2bedb72da7d6b305fd7b2140df3fca5c3c57e877ecfa",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 13,
  },

  {
    id: "fasttrack_ef82ddc5",
    name: "Superior Inu",
    symbol: "$SI",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.001892",
    marketCap: "1892902.0",
    volume24h: "1759643.81",
    liquidity: "140239.93",

    logo: "https://cdn.dexscreener.com/cms/images/46qoI_CRKoFbdvIX?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0xEF82DDc566653699B89C3aFe123559a75aAA2976",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x5e2a2d101a38c853510305bd68dae7106c27a08c3867b91718d987879abd4f89",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 14,
  },

  {
    id: "fasttrack_008df4b3",
    name: "Robinhood",
    symbol: "$ROBINHOOD",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.003241",
    marketCap: "3241307.0",
    volume24h: "287482.42",
    liquidity: "171192.57",

    logo: "https://cdn.dexscreener.com/cms/images/XL_eouvCqLrb3iI3?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x7f8271c1a7a6a434f33b0babc15bf2980a0dcb4196848b4f7e789a7fd73a5350",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 15,
  },

  {
    id: "fasttrack_020bfc65",
    name: "Cash Cat",
    symbol: "$CASHCAT",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.1556",
    marketCap: "153745901.0",
    volume24h: "1061181.94",
    liquidity: "4356420.92",

    logo: "https://cdn.dexscreener.com/cms/images/Lq7a3pS9Wn8EuGp0?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x020bfc650a365f8bb26819deaabf3e21291018b4",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xA70fc67C9F69da90B63a0e4C05D229954574E313",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 4,
  },

  {
    id: "fasttrack_1cdb289b",
    name: "X Link",
    symbol: "$XL",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.0007968",
    marketCap: "788898.0",
    volume24h: "2330478.59",
    liquidity: "72543.97",

    logo: "https://cdn.dexscreener.com/cms/images/zegRw84leBe61UP4?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x1cDb289BeFDFaC8aF945a288BCdcCc382cB34d32",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x713aba0fa3f49c07d2f60c064464868ac7798f57c3cd3298f784db8b4054d503",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 21,
  },

  {
    id: "fasttrack_39dbed3a",
    name: "Pons",
    symbol: "$PONS",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.5761",
    marketCap: "395952853.0",
    volume24h: "14368081.49",
    liquidity: "6458105.31",

    logo: "https://cdn.dexscreener.com/cms/images/dkmXs8KYMyMXjuU1?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x39dbed3a2bd333467115de45665cc57f813c4571",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xEd50bDeeA8aDC232f159486192a4157281D722ff",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 2,
  },

  {
    id: "fasttrack_2e8c3116",
    name: "Artificial Inu",
    symbol: "$AI",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.2741",
    marketCap: "274154191.0",
    volume24h: "3057909.57",
    liquidity: "4417804.56",

    logo: "https://cdn.dexscreener.com/cms/images/U6RIzs8Fm7Jar6GE?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x2e8c31162b855a2ffa90f6f8634643ad6f111e18",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xc4a21f9d6485FC5893DD4A491B320a83DAF4Da1D",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 3,
  },


    {
    id: "fasttrack_98096d17",
    name: "Boner Coin",
    symbol: "$BONER",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.03963",
    marketCap: "39636971.0",
    volume24h: "347203.93",
    liquidity: "810532.65",

    logo: "https://cdn.dexscreener.com/cms/images/zHSvsb5W3vIdMePa?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x98096d17e191b3da1d5f99a6d7b3584351b11e18",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x1f1778596d8c1ee3e1eaf64ea83a5e77063b142fa3ef59a7c81e520c516379bc",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 7,
  },

  {
    id: "fasttrack_5cb6f181",
    name: "pipedog",
    symbol: "$PIPEDOG",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.002321",
    marketCap: "28657161.0",
    volume24h: "1333608.51",
    liquidity: "8524794.29",

    logo: "https://cdn.dexscreener.com/cms/images/4S5N79kV0jhT7y6K?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x5cb6f181081301b44905f3ae15419112ecabd8a6",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0xB7f10f74B39291b9290b779978e19A7637C742D6",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 8,
  },


  {
    id: "fasttrack_812486ea",
    name: "ubik",
    symbol: "$UBIK",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.01926",
    marketCap: "19259798.0",
    volume24h: "1899419.48",
    liquidity: "431470.44",

    logo: "https://cdn.dexscreener.com/cms/images/nhHGgd_FHxkL0RMs?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x812486eaea648819853f8e372dc9f1516c7868bd",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x6d56f66e52e63e8be558d708a987426314bb4de92bc9b43a44effee1f2abf317",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 16,
  },

  {
    id: "fasttrack_7dbf3897",
    name: "ZZZ",
    symbol: "$ZZZ",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.02315",
    marketCap: "19218839.0",
    volume24h: "1286714.54",
    liquidity: "435686.57",

    logo: "https://cdn.dexscreener.com/cms/images/GTfH5Ev7boUT-3bd?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x6538e2c223ed70228114983afecbe5e69fe627e2fafdf367bdd6bdeff2ad391f",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 9,
  },

  {
    id: "fasttrack_0e0d2c89",
    name: "Chump Coin",
    symbol: "$CHUMP",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.02603",
    marketCap: "26038715.0",
    volume24h: "2193187.43",
    liquidity: "1068488.11",

    logo: "https://cdn.dexscreener.com/cms/images/4cJVmRdL_zSKVHcY?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x0e0d2c89a5a019fe1cf762e5e33187631dacc21b",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x714442e9A611f8561A7dF108D6d925132937cFb8",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 17,
  },

  {
    id: "fasttrack_ab093def",
    name: "MUSHROOM",
    symbol: "$SHROOM",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.008839",
    marketCap: "8714408.0",
    volume24h: "1038950.84",
    liquidity: "266795.65",

    logo: "https://cdn.dexscreener.com/cms/images/mJcSbAx1vvVUUcQJ?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0xab093def657f15df31b33922a95e047add645b29",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x778a632fdd85577efe9cfce4a2c9ac91b9decdb24c351f9b56e25d38fbe587b4",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 18,
  },

  {
    id: "fasttrack_07ebb29a",
    name: "Bundle Cat",
    symbol: "$BUN",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.02532",
    marketCap: "7238136.0",
    volume24h: "389286.31",
    liquidity: "454962.91",

    logo: "https://cdn.dexscreener.com/cms/images/Qg8DtP-7cTLYq_Vb?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x07ebb29a38fbcb41563817e5e19f2cec619c90d2",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x06e308b77bdafd691d179645296ce8c40e33c6af4a879a913efc7eedc402581c",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 20,
  },

  {
    id: "fasttrack_7fe995a8",
    name: "Thinking Cat",
    symbol: "$HMM",
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: "0.01162",
    marketCap: "11483241.0",
    volume24h: "611818.3",
    liquidity: "473833.9",

    logo: "https://cdn.dexscreener.com/cms/images/M-tVSdxn8tmiZwiC?width=800&height=800&quality=95&format=auto",

    chain: "Robinhood Chain",
    contract: "0x7fe995a80075df3dc8ae11a9b82c7fe4202cd87f",

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: "0x2b0D0183d017c58B924401cA8AC362f6E01F0E9e",
    dex: "uniswap",

    listedAt: new Date().toISOString(),
    trendingOrder: 22,
  },

];

/*
 * Helper for future API replacement.
 */
export function getMarketTokens(category = "all") {
  if (category === "all") {
    return [...MARKET_TOKENS].sort(
      (a, b) =>
        new Date(b.listedAt) - new Date(a.listedAt)
    );
  }

  return MARKET_TOKENS
    .filter((token) => token.category === category)
    .sort(
      (a, b) =>
        new Date(b.listedAt) - new Date(a.listedAt)
    );
}

export function getTrendingTokens() {
  const featured = MARKET_TOKENS
    .filter(
      (token) =>
        token.featured &&
        (
          token.category === "graduate" ||
          token.category === "fasttrack"
        )
    );

  /*
   * AELVORA is always #1.
   * Other tokens follow trendingOrder.
   * If a token does not have trendingOrder,
   * listedAt dipakai sebagai fallback.
   */

  const aelvora = featured.find(
    (token) =>
      token.id === "aelvora" ||
      token.symbol === "$AELV"
  );

  const others = featured
    .filter(
      (token) => token !== aelvora
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
        new Date(b.listedAt) -
        new Date(a.listedAt)
      );
    });

  return aelvora
    ? [aelvora, ...others]
    : others;
}


/**
 * Tokens created directly through Aelvora Launchpad.
 * Stored locally until backend/indexer is available.
 */
export function getCreatedTokens() {
  try {
    if (typeof window === "undefined") return [];

    const raw = localStorage.getItem("aelvora_created_tokens");
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (token) =>
          token?.contract &&
          token?.name &&
          token?.symbol
      )
      .map((token) => ({
        ...token,
        category:
          token.category === "graduate"
            ? "graduate"
            : "newest",
        status:
          token.category === "graduate"
            ? "graduated"
            : (token.status || "live"),
        source: "aelvora-launchpad",
        chain: token.chain || "Robinhood Chain",
        listedAt:
          token.listedAt ||
          new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function getMarketTokensWithCreated(category = "all") {
  const createdTokens = getCreatedTokens();

  const baseTokens =
    category === "all"
      ? MARKET_TOKENS
      : MARKET_TOKENS.filter(
          (token) => token.category === category
        );

  const createdFiltered =
    category === "all"
      ? createdTokens
      : createdTokens.filter(
          (token) => token.category === category
        );

  return [
    ...createdFiltered,
    ...baseTokens,
  ];
}
