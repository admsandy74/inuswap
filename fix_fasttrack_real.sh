#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/aelvora-market"
API="$ROOT/src/market/marketApi.js"
PAGE="$ROOT/src/market/MarketPage.jsx"

CA="0x77b0aa38451ccdc1b42587e2f80b9879a7f82356"

echo
echo "============================================================"
echo " AELVORA FASTTRACK REAL FIX"
echo "============================================================"
echo "CA: $CA"
echo

# ============================================================
# 1. MARKET API
#    Logo HARUS dari pair.info.imageUrl DexScreener
# ============================================================

python3 - "$API" "$CA" <<'PY'
from pathlib import Path
import sys
import re

path = Path(sys.argv[1])
ca = sys.argv[2].lower()

s = path.read_text()

# ------------------------------------------------------------
# Ganti sumber logo normalizePair()
# ------------------------------------------------------------

old = '''  const logo =
    CUSTOM_TOKEN_LOGOS[key] ||
    await fetchTokenLogo(config);'''

new = '''  /*
   * Logo utama:
   * DexScreener pair.info.imageUrl
   *
   * Ini adalah image URL yang dikirim langsung
   * oleh pair DexScreener.
   *
   * Fallback:
   * custom logo -> token profile -> null
   */
  const logo =
    pair?.info?.imageUrl ||
    CUSTOM_TOKEN_LOGOS[key] ||
    await fetchTokenLogo(config);'''

if old in s:
    s = s.replace(old, new, 1)
    print("✅ marketApi.js: logo source -> pair.info.imageUrl")
else:
    print("⚠️ Blok logo lama tidak ditemukan")

# ------------------------------------------------------------
# Tambahkan fallback imageUrl pada return normalizePair
# ------------------------------------------------------------

path.write_text(s)
PY

# ============================================================
# 2. MARKET PAGE
#    HORMATI trendingOrder
# ============================================================

python3 - "$PAGE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
s = path.read_text()

start_marker = '''  const orderedTrending = (() => {'''
end_marker = '''  const trendingTotalPages ='''

start = s.find(start_marker)
end = s.find(end_marker, start)

if start == -1 or end == -1:
    raise SystemExit("❌ Blok orderedTrending tidak ditemukan")

new_block = '''  /*
   * ==========================================================
   * TRENDING ORDER
   * ==========================================================
   *
   * AELVORA selalu #1.
   *
   * Token Fasttrack:
   * trendingOrder = posisi yang ditentukan di marketData.js
   *
   * Contoh:
   *   AELVORA       -> #1
   *   trendingOrder 2 -> #2
   *   trendingOrder 8 -> #8
   *
   * Token tanpa trendingOrder berada setelah token
   * yang mempunyai order.
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

'''

s = s[:start] + new_block + s[end:]

path.write_text(s)

print("✅ MarketPage.jsx: trendingOrder sekarang dihormati")
PY

# ============================================================
# 3. VERIFY
# ============================================================

echo
echo "============================================================"
echo " VERIFY MARKET API"
echo "============================================================"

grep -n -B 8 -A 12 \
"pair?.info?.imageUrl" \
"$API" || true

echo
echo "============================================================"
echo " VERIFY MARKET PAGE"
echo "============================================================"

grep -n -A 75 \
"const orderedTrending" \
"$PAGE" || true

echo
echo "============================================================"
echo " BUILD"
echo "============================================================"

npm run build

echo
echo "============================================================"
echo " ✅ REAL FIX SELESAI"
echo "============================================================"
echo
echo "Logo:"
echo "  DexScreener pair.info.imageUrl"
echo
echo "Trending:"
echo "  AELVORA = #1"
echo "  Fasttrack mengikuti trendingOrder"
echo
echo "Untuk DOGO:"
echo "  CA    = $CA"
echo "  ORDER = #8"
echo
echo "============================================================"
