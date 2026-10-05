#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AELVORA MARKET — FASTTRACK MASTER
# ============================================================
#
# 🔴 FOR EACH NEW TOKEN, ONLY CHANGE THESE 2 LINES:
#
CA="0x85722b0c29f7343B404bDA388169834028D6D011"
ORDER=2
#
# ============================================================
#
# ORDER = Trending position
#
# #1 AELVORA IS NOT TOUCHED
# #2, #3, #4, etc. = Fasttrack positions
#
# FLOW:
#   1. Fetch DexScreener
#   2. Add marketData.js
#   3. Add marketApi.js
#   4. Build
#   5. Deploy to /var/www/html
#   6. Telegram notification
#
# ============================================================

ROOT="$HOME/aelvora-market"
DATA="$ROOT/src/market/marketData.js"
API="$ROOT/src/market/marketApi.js"
WEBROOT="/var/www/html"

# ============================================================
# VALIDATION
# ============================================================

if [[ ! "$CA" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "❌ Invalid CA:"
  echo "$CA"
  exit 1
fi

if ! [[ "$ORDER" =~ ^[0-9]+$ ]]; then
  echo "❌ ORDER must be a number"
  exit 1
fi

if [ "$ORDER" -lt 2 ]; then
  echo "❌ ORDER must be at least #2"
  exit 1
fi

SHORT_CA="${CA:2:8}"
SHORT_CA="${SHORT_CA,,}"

# IMPORTANT:
# marketData.js and marketApi.js MUST use identical IDs.
TOKEN_ID="fasttrack_${SHORT_CA}"
API_KEY="fasttrack_${SHORT_CA}"

echo
echo "============================================================"
echo " AELVORA FASTTRACK MASTER"
echo "============================================================"
echo "CA    : $CA"
echo "ORDER : #$ORDER"
echo "ID    : $TOKEN_ID"
echo "============================================================"
echo

# ============================================================
# DUPLICATE CHECK
# ============================================================

if grep -qi "$CA" "$DATA" "$API"; then
  echo "❌ CA ALREADY EXISTS IN PROJECT:"
  echo "$CA"
  exit 1
fi

# ============================================================
# GET DEXSCREENER DATA
# ============================================================

echo "🔎 Fetching token data from DexScreener..."
echo

TMP_JSON="/tmp/aelvora_fasttrack_${SHORT_CA}.json"

curl -fsSL \
  "https://api.dexscreener.com/latest/dex/tokens/${CA}" \
  > "$TMP_JSON"

# ============================================================
# PARSE DATA
# ============================================================

eval "$(
python3 - "$TMP_JSON" "$CA" <<'PY'
import json
import sys

path = sys.argv[1]
ca = sys.argv[2].lower()

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

pairs = data.get("pairs") or []

def norm(v):
    return str(v or "").lower()

# Only Robinhood pairs where the token matches the CA
valid = []

for p in pairs:
    if norm(p.get("chainId")) != "robinhood":
        continue

    base = p.get("baseToken") or {}
    quote = p.get("quoteToken") or {}

    if (
        norm(base.get("address")) == ca
        or
        norm(quote.get("address")) == ca
    ):
        valid.append(p)

if not valid:
    print('echo "❌ Robinhood pair for this CA was not found" >&2')
    print("exit 1")
    sys.exit(0)

# Prefer token as BASE
base_matches = [
    p for p in valid
    if norm((p.get("baseToken") or {}).get("address")) == ca
]

candidates = base_matches or valid

# Highest liquidity wins
candidates.sort(
    key=lambda p: float(
        ((p.get("liquidity") or {}).get("usd")) or 0
    ),
    reverse=True
)

pair = candidates[0]

base = pair.get("baseToken") or {}
quote = pair.get("quoteToken") or {}

if norm(base.get("address")) == ca:
    token = base
else:
    token = quote

name = token.get("name") or "Unknown"
symbol = token.get("symbol") or "TOKEN"

logo = (
    pair.get("info", {})
        .get("imageUrl")
    or
    f"https://dd.dexscreener.com/ds-data/tokens/robinhood/{ca}.png?size=lg"
)

price = pair.get("priceUsd") or "0"

market_cap = (
    pair.get("marketCap")
    if pair.get("marketCap") is not None
    else pair.get("fdv")
)

volume = (
    (pair.get("volume") or {}).get("h24")
    or 0
)

liquidity = (
    (pair.get("liquidity") or {}).get("usd")
    or 0
)

pair_address = pair.get("pairAddress") or ""
dex = pair.get("dexId") or ""

def js_string(value):
    return json.dumps(str(value))

def js_number(value):
    try:
        return str(float(value))
    except:
        return "0"

print(f"NAME={js_string(name)}")
print(f"SYMBOL={js_string(symbol)}")
print(f"LOGO={js_string(logo)}")
print(f"PRICE={js_string(price)}")
print(f"MARKET_CAP={js_number(market_cap)}")
print(f"VOLUME={js_number(volume)}")
print(f"LIQUIDITY={js_number(liquidity)}")
print(f"PAIR={js_string(pair_address)}")
print(f"DEX={js_string(dex)}")
PY
)"

echo "===== DEXSCREENER DATA ====="
echo "Name       : $NAME"
echo "Symbol     : \$$SYMBOL"
echo "Logo       : $LOGO"
echo "Price      : $PRICE"
echo "Market Cap : $MARKET_CAP"
echo "Volume 24H : $VOLUME"
echo "Liquidity  : $LIQUIDITY"
echo "Pair       : $PAIR"
echo "DEX        : $DEX"
echo

# ============================================================
# ADD MARKET DATA
# ============================================================

python3 - "$DATA" "$TOKEN_ID" "$CA" "$ORDER" \
  "$NAME" "$SYMBOL" "$LOGO" "$PRICE" \
  "$MARKET_CAP" "$VOLUME" "$LIQUIDITY" \
  "$PAIR" "$DEX" <<'PY'
from pathlib import Path
import sys
import json

(
    path,
    token_id,
    ca,
    order,
    name,
    symbol,
    logo,
    price,
    market_cap,
    volume,
    liquidity,
    pair,
    dex,
) = sys.argv[1:]

order = int(order)

s = Path(path).read_text()

marker = "export const MARKET_TOKENS = ["

pos = s.find(marker)

if pos == -1:
    raise SystemExit(
        "❌ MARKET_TOKENS was not found"
    )

insert_pos = s.find("\n", pos) + 1

def js(v):
    return json.dumps(v, ensure_ascii=False)

token = f'''  {{
    id: {js(token_id)},
    name: {js(name)},
    symbol: {js("$" + symbol)},
    category: "fasttrack",
    status: "live",

    liveData: true,
    source: "dexscreener",
    verified: false,
    featured: true,

    price: {js(price)},
    marketCap: {js(market_cap)},
    volume24h: {js(volume)},
    liquidity: {js(liquidity)},

    logo: {js(logo)},

    chain: "Robinhood Chain",
    contract: {js(ca)},

    description:
      "Robinhood Chain token listed through Aelvora Fasttrack.",

    website: "",
    x: "",
    telegram: "",

    pairAddress: {js(pair)},
    dex: {js(dex)},

    listedAt: new Date().toISOString(),
    trendingOrder: {order},
  }},

'''

s = s[:insert_pos] + token + s[insert_pos:]

Path(path).write_text(s)

print("✅ marketData.js updated")
PY

# ============================================================
# ADD MARKET API CONFIG
# ============================================================

python3 - "$API" "$API_KEY" "$CA" "$SYMBOL" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
api_key = sys.argv[2]
ca = sys.argv[3]
symbol = sys.argv[4]

s = path.read_text()

if api_key in s:
    raise SystemExit(
        "❌ API KEY already exists:"
        f" {api_key}"
    )

marker = "};\n\nfunction normalize"

pos = s.find(marker)

if pos == -1:
    raise SystemExit(
        "❌ TOKEN_CONFIG closing section was not found"
    )

config = f'''  {api_key}: {{
    symbol: "{symbol}",
    address:
      "{ca}",
  }},

'''

s = s[:pos] + config + s[pos:]

path.write_text(s)

print("✅ marketApi.js updated")
PY

# ============================================================
# CLEAN TEMP FILE
# ============================================================

rm -f "$TMP_JSON"

# ============================================================
# VERIFY
# ============================================================

echo
echo "============================================================"
echo " VERIFY"
echo "============================================================"

grep -n -A35 "$TOKEN_ID" "$DATA" || true

echo
grep -n -A8 "$API_KEY" "$API" || true

# ============================================================
# BUILD
# ============================================================

echo
echo "============================================================"
echo " BUILD"
echo "============================================================"

npm run build

# ============================================================
# DEPLOY
# ============================================================

echo
echo "============================================================"
echo " DEPLOY"
echo "============================================================"

sudo cp -a "$ROOT/dist/." "$WEBROOT/"

echo "✅ Production frontend deployed."

# ============================================================
# TELEGRAM FASTTRACK NOTIFICATION
# ============================================================

echo
echo "============================================================"
echo " TELEGRAM FASTTRACK"
echo "============================================================"

TELEGRAM_PAYLOAD=$(printf '{"token":{"name":"%s","symbol":"%s","marketCap":"%s","liquidity":"%s","volume24h":"%s","price":"%s","contract":"%s","chain":"%s","tradeUrl":"%s","marketUrl":"%s"}}' \
  "$NAME" \
  "$SYMBOL" \
  "$MARKET_CAP" \
  "$LIQUIDITY" \
  "$VOLUME" \
  "$PRICE" \
  "$CA" \
  "Robinhood Chain" \
  "https://aelvoramarket.com/swap/$CA" \
  "https://aelvoramarket.com/market")

if curl -fsS --max-time 10 \
  -X POST \
  http://127.0.0.1:3001/api/telegram/fasttrack \
  -H "Content-Type: application/json" \
  -d "$TELEGRAM_PAYLOAD" \
  >/tmp/aelvora_fasttrack_telegram_response.json
then
  echo "Telegram Fasttrack notification sent."
else
  echo "WARNING: Telegram Fasttrack notification failed."
  echo "Fasttrack itself was added successfully."
fi

# ============================================================
# SUCCESS
# ============================================================

echo
echo "============================================================"
echo " ✅ FASTTRACK SUCCESSFULLY ADDED"
echo "============================================================"
echo
echo "Name       : $NAME"
echo "Symbol     : \$$SYMBOL"
echo "CA         : $CA"
echo "ORDER      : #$ORDER"
echo "ID         : $TOKEN_ID"
echo
echo "Live Data  : DexScreener"
echo "Logo       : DexScreener"
echo "Price      : DexScreener"
echo "Market Cap : DexScreener"
echo "Volume     : DexScreener"
echo "Liquidity  : DexScreener"
echo
echo "Production : /var/www/html"
echo "Build      : SUCCESS"
echo "============================================================"

