import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);

function loadTelegramConfig() {
  const file = path.join(__dirname, ".env.telegram");

  if (!fs.existsSync(file)) {
    return {};
  }

  const config = {};

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    config[key] = value;
  }

  return config;
}

const TELEGRAM_CONFIG = loadTelegramConfig();

async function sendTelegramMessage(text, topicId) {
  const token = TELEGRAM_CONFIG.TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_CONFIG.TELEGRAM_CHAT_ID;

  if (!token || !chatId || !topicId) {
    throw new Error("Telegram configuration is incomplete.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: Number(topicId),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result?.description ||
      "Telegram sendMessage failed."
    );
  }

  return result;
}

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "swap-tokens.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};

    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw || "{}");

    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  } catch (error) {
    console.error("[AELVORA] DB READ ERROR:", error);
    return {};
  }
}

function writeDb(data) {
  const temp = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );

  fs.renameSync(temp, DB_FILE);
}

function normalizeWallet(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

// ============================================================
// GLOBAL MARKET TOKEN STORAGE
// ============================================================

const MARKET_DB_FILE = path.join(
  DATA_DIR,
  "market-tokens.json"
);

function readMarketTokens() {
  try {
    if (!fs.existsSync(MARKET_DB_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(
      MARKET_DB_FILE,
      "utf8"
    );

    const data = JSON.parse(raw || "[]");

    return Array.isArray(data)
      ? data
      : [];
  } catch (error) {
    console.error(
      "[AELVORA] MARKET DB READ ERROR:",
      error
    );

    return [];
  }
}

function writeMarketTokens(tokens) {
  const temp = `${MARKET_DB_FILE}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(tokens, null, 2) + "\n",
    "utf8"
  );

  fs.renameSync(
    temp,
    MARKET_DB_FILE
  );
}


// ============================================================
// AUTOMATIC CONTRACT VERIFICATION
// ============================================================

const verificationJobs = new Set();

function markMarketTokenVerified(contract) {
  const normalized = normalizeToken(contract);

  if (!isAddress(normalized)) {
    return;
  }

  const tokens = readMarketTokens();

  let changed = false;

  const updated = tokens.map((item) => {
    if (
      normalizeToken(item?.contract) !== normalized
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      verified: true,
      verificationStatus: "verified",
      verifiedAt: new Date().toISOString(),
    };
  });

  if (changed) {
    writeMarketTokens(updated);
  }
}

function startTokenVerification(contract) {
  const normalized = normalizeToken(contract);

  if (!isAddress(normalized)) {
    console.warn(
      "[AELVORA VERIFY] Invalid token address:",
      contract
    );
    return;
  }

  if (verificationJobs.has(normalized)) {
    console.log(
      "[AELVORA VERIFY] Verification already running:",
      normalized
    );
    return;
  }

  const scriptPath = path.join(
    __dirname,
    "contracts",
    "scripts",
    "verify-token-v2.mjs"
  );

  if (!fs.existsSync(scriptPath)) {
    console.error(
      "[AELVORA VERIFY] Verifier script not found:",
      scriptPath
    );
    return;
  }

  verificationJobs.add(normalized);

  console.log(
    "[AELVORA VERIFY] Starting verification:",
    normalized
  );

  const child = spawn(
    process.execPath,
    [scriptPath, normalized],
    {
      cwd: path.join(__dirname, "contracts"),
      env: {
        ...process.env,
        HOME: process.env.HOME || "/home/aelvora",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(
      `[AELVORA VERIFY] ${chunk}`
    );
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(
      `[AELVORA VERIFY] ${chunk}`
    );
  });

  child.on("error", (error) => {
    console.error(
      "[AELVORA VERIFY] Process error:",
      error
    );
  });

  child.on("close", (code) => {
    verificationJobs.delete(normalized);

    if (code === 0) {
      markMarketTokenVerified(normalized);

      console.log(
        "[AELVORA VERIFY] Verification completed successfully:",
        normalized
      );

      return;
    }

    console.error(
      "[AELVORA VERIFY] Verification process exited with code:",
      code,
      normalized
    );
  });
}

app.use(express.json({ limit: "32kb" }));

// ============================================================
// TOKEN LOGO UPLOADS
// ============================================================

app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    fallthrough: false,
    index: false,
  })
);

app.post(
  "/api/upload-logo",
  express.raw({
    type: [
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
    limit: "512kb",
  }),
  (req, res) => {
    try {
      const contentType =
        String(req.headers["content-type"] || "")
          .split(";")[0]
          .trim()
          .toLowerCase();

      const allowedTypes = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      };

      const extension = allowedTypes[contentType];

      if (!extension) {
        return res.status(400).json({
          ok: false,
          error: "Logo must be PNG, JPG, or WebP.",
        });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "Logo file is empty.",
        });
      }

      const randomName =
        `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const filePath =
        path.join(UPLOADS_DIR, randomName);

      fs.writeFileSync(filePath, req.body);

      const logoURI =
        `https://aelvoramarket.com/uploads/${randomName}`;

      return res.json({
        ok: true,
        logoURI,
      });
    } catch (error) {
      console.error("[LOGO UPLOAD]", error);

      return res.status(500).json({
        ok: false,
        error: "Logo upload failed.",
      });
    }
  }
);

// ============================================================
// TELEGRAM NOTIFICATIONS
// ============================================================

app.post("/api/telegram/new-token", async (req, res) => {
  try {
    const token = req.body?.token || {};

    const topicId =
      TELEGRAM_CONFIG.TELEGRAM_NEWEST_TOPIC_ID;

    const message = [
      "🟢 <b>NEW TOKEN</b>",
      "",
      `🪙 <b>${String(token.name || "Unknown").slice(0, 100)}</b>`,
      `💎 <b>$${String(token.symbol || "TOKEN").replace(/^\\$/, "").slice(0, 32)}</b>`,
      "",
      `💰 Market Cap: <b>${String(token.marketCap || "N/A")}</b>`,
      `💧 Liquidity: <b>${String(token.liquidity || "N/A")}</b>`,
      `💵 Price: <b>${String(token.price || "N/A")}</b>`,
      "",
      `🔗 Contract: <code>${String(token.contract || "")}</code>`,
      `🌐 ${String(token.chain || "Robinhood Chain")}`,
      "",
      token.tradeUrl
        ? `🛒 <a href="${String(token.tradeUrl)}">Trade on AELVORA</a>`
        : "",
      token.marketUrl
        ? `🏪 <a href="${String(token.marketUrl)}">View Market</a>`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message, topicId);

    return res.json({ ok: true });
  } catch (error) {
    console.error("[TELEGRAM NEW TOKEN]", error);

    return res.status(502).json({
      ok: false,
      error: error?.message || "Telegram notification failed.",
    });
  }
});

app.post("/api/telegram/graduate", async (req, res) => {
  try {
    const token = req.body?.token || {};

    const topicId =
      TELEGRAM_CONFIG.TELEGRAM_GRADUATE_TOPIC_ID;

    const message = [
      "🎓 <b>GRADUATED TOKEN</b>",
      "",
      `🪙 <b>${String(token.name || "Unknown").slice(0, 100)}</b>`,
      `💎 <b>$${String(token.symbol || "TOKEN").replace(/^\$/, "").slice(0, 32)}</b>`,
      "",
      `💰 Market Cap: <b>${String(token.marketCap || "N/A")}</b>`,
      `💧 Liquidity: <b>${String(token.liquidity || "N/A")}</b>`,
      `📊 Volume 24H: <b>${String(token.volume24h || "N/A")}</b>`,
      `💵 Price: <b>${String(token.price || "N/A")}</b>`,
      "",
      `🔗 Contract: <code>${String(token.contract || "")}</code>`,
      `🌐 ${String(token.chain || "Robinhood Chain")}`,
      "",
      token.tradeUrl
        ? `🛒 <a href="${String(token.tradeUrl)}">Trade on AELVORA</a>`
        : "",
      token.marketUrl
        ? `🏪 <a href="${String(token.marketUrl)}">View Market</a>`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message, topicId);

    return res.json({ ok: true });
  } catch (error) {
    console.error("[TELEGRAM GRADUATE]", error);

    return res.status(502).json({
      ok: false,
      error: error?.message || "Telegram notification failed.",
    });
  }
});

app.post("/api/telegram/fasttrack", async (req, res) => {
  try {
    const token = req.body?.token || {};

    const topicId =
      TELEGRAM_CONFIG.TELEGRAM_FASTTRACK_TOPIC_ID;

    const message = [
      "⚡ <b>FASTTRACK</b>",
      "",
      `🪙 <b>${String(token.name || "Unknown").slice(0, 100)}</b>`,
      `💎 <b>$${String(token.symbol || "TOKEN").replace(/^\\$/, "").slice(0, 32)}</b>`,
      "",
      `💰 Market Cap: <b>${String(token.marketCap || "N/A")}</b>`,
      `💧 Liquidity: <b>${String(token.liquidity || "N/A")}</b>`,
      `📊 Volume 24H: <b>${String(token.volume24h || "N/A")}</b>`,
      `💵 Price: <b>${String(token.price || "N/A")}</b>`,
      "",
      `🔗 Contract: <code>${String(token.contract || "")}</code>`,
      `🌐 ${String(token.chain || "Robinhood Chain")}`,
      "",
      token.tradeUrl
        ? `🛒 <a href="${String(token.tradeUrl)}">Trade on AELVORA</a>`
        : "",
      token.marketUrl
        ? `🏪 <a href="${String(token.marketUrl)}">View Market</a>`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message, topicId);

    return res.json({ ok: true });
  } catch (error) {
    console.error("[TELEGRAM FASTTRACK]", error);

    return res.status(502).json({
      ok: false,
      error: error?.message || "Telegram notification failed.",
    });
  }
});

// ============================================================
// GLOBAL MARKET — NEWEST TOKENS
// ============================================================

app.get("/api/market/tokens", (req, res) => {
  return res.json({
    ok: true,
    tokens: readMarketTokens(),
  });
});

app.post("/api/market/tokens", (req, res) => {
  const token = req.body?.token || {};

  const contract = normalizeToken(
    token.contract
  );

  if (!isAddress(contract)) {
    return res.status(400).json({
      error: "Invalid token contract address.",
    });
  }

  const name = String(
    token.name || "TOKEN"
  ).trim().slice(0, 64);

  const symbol = String(
    token.symbol || "TOKEN"
  ).trim().slice(0, 32);

  if (!name || !symbol) {
    return res.status(400).json({
      error: "Token name and symbol are required.",
    });
  }

  const item = {
    id:
      String(
        token.id ||
        `aelvora-${contract}`
      ),

    contract,

    name,
    symbol,

    creator:
      isAddress(token.creator)
        ? token.creator
        : "",

    curve:
      isAddress(token.curve)
        ? token.curve
        : "",

    createdBlock:
      /^\d+$/.test(String(token.createdBlock || ""))
        ? String(token.createdBlock)
        : "",

    totalSupply:
      String(token.totalSupply || "0"),

    creatorTaxBps:
      String(token.creatorTaxBps || "0"),

    category: "newest",
    status: "live",

    logo:
      String(
        token.logo ||
        token.logoURI ||
        ""
      ),

    logoURI:
      String(
        token.logoURI ||
        token.logo ||
        ""
      ),

    website:
      String(token.website || ""),

    twitter:
      String(token.twitter || ""),

    telegram:
      String(token.telegram || ""),

    chain:
      String(
        token.chain ||
        "Robinhood Chain"
      ),

    listedAt:
      token.listedAt ||
      new Date().toISOString(),

    description:
      String(
        token.description ||
        "New token launched on Aelvora Launchpad."
      ),

    source: "aelvora-launchpad",
    verified: Boolean(token.verified),
    featured: Boolean(token.featured),
  };

  const existing = readMarketTokens();

  const next = [
    item,
    ...existing.filter(
      (x) =>
        normalizeToken(x?.contract) !==
        contract
    ),
  ];

  writeMarketTokens(
    next.slice(0, 1000)
  );

  if (
    item.source === "aelvora-launchpad" &&
    item.chain === "Robinhood Chain"
  ) {
    console.log(
      "[AELVORA VERIFY] Token accepted for automatic verification:",
      contract
    );

    setImmediate(() => {
      startTokenVerification(contract);
    });
  }

  return res.json({
    ok: true,
    token: item,
    tokens: next.slice(0, 1000),
  });
});


// ============================================================
// GET SAVED TOKENS
// ============================================================

app.get("/api/swap/tokens", (req, res) => {
  const wallet = normalizeWallet(req.query.wallet);

  if (!isAddress(wallet)) {
    return res.status(400).json({
      error: "Invalid wallet address."
    });
  }

  const db = readDb();
  const tokens = Array.isArray(db[wallet])
    ? db[wallet]
    : [];

  return res.json({
    wallet,
    tokens
  });
});

// ============================================================
// ADD / UPDATE SAVED TOKEN
// ============================================================

app.post("/api/swap/tokens", (req, res) => {
  const wallet = normalizeWallet(req.body?.wallet);
  const token = normalizeToken(req.body?.token);

  if (!isAddress(wallet)) {
    return res.status(400).json({
      error: "Invalid wallet address."
    });
  }

  if (!isAddress(token)) {
    return res.status(400).json({
      error: "Invalid token address."
    });
  }

  const item = {
    token,
    symbol: String(req.body?.symbol || "TOKEN").slice(0, 32),
    name: String(
      req.body?.name ||
      req.body?.symbol ||
      "TOKEN"
    ).slice(0, 64),
    decimals: Number.isFinite(Number(req.body?.decimals))
      ? Number(req.body.decimals)
      : 18
  };

  const db = readDb();

  const old = Array.isArray(db[wallet])
    ? db[wallet]
    : [];

  const next = [
    item,
    ...old.filter(
      (x) =>
        normalizeToken(x?.token) !== token
    )
  ].slice(0, 30);

  db[wallet] = next;

  writeDb(db);

  return res.json({
    ok: true,
    wallet,
    tokens: next
  });
});

// ============================================================
// DELETE SAVED TOKEN
// ============================================================

app.delete("/api/swap/tokens/:token", (req, res) => {
  const wallet = normalizeWallet(req.query.wallet);
  const token = normalizeToken(req.params.token);

  if (!isAddress(wallet)) {
    return res.status(400).json({
      error: "Invalid wallet address."
    });
  }

  if (!isAddress(token)) {
    return res.status(400).json({
      error: "Invalid token address."
    });
  }

  const db = readDb();

  const old = Array.isArray(db[wallet])
    ? db[wallet]
    : [];

  const next = old.filter(
    (x) =>
      normalizeToken(x?.token) !== token
  );

  db[wallet] = next;

  writeDb(db);

  return res.json({
    ok: true,
    wallet,
    deleted: token,
    tokens: next
  });
});

// ============================================================
// HEALTH
// ============================================================

// ============================================================
// DEXSCREENER API PROXY
// ============================================================

app.get("/api/dexscreener/token-pairs", async (req, res) => {
  const chainId = String(
    req.query.chainId || ""
  ).trim();

  const tokenAddress = String(
    req.query.tokenAddress || ""
  ).trim();

  if (
    chainId !== "robinhood" ||
    !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)
  ) {
    return res.status(400).json({
      error: "Invalid DexScreener request",
    });
  }

  try {
    const url =
      `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`;

    const response = await fetch(url);

    const text = await response.text();

    res.status(response.status);

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
        "application/json"
    );

    return res.send(text);
  } catch (error) {
    console.error(
      "[DEXSCREENER PROXY]",
      error
    );

    return res.status(502).json({
      error: "DexScreener request failed",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "aelvora-market"
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[AELVORA] API listening on http://127.0.0.1:${PORT}`
  );
});
