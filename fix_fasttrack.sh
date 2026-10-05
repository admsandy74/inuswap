#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AELVORA MARKET — FASTTRACK REPAIR FINAL
# ============================================================
#
# 🔴 CUMA GANTI 2 BARIS:
#
CA="0x77b0aa38451ccdc1b42587e2f80b9879a7f82356"
ORDER=8
#
# ============================================================
# FUNGSI:
#   ✓ Cari card berdasarkan CONTRACT ADDRESS
#   ✓ Repair logo langsung di marketData.js
#   ✓ Repair trendingOrder
#   ✓ Repair getTrendingTokens() agar ORDER benar-benar dipakai
#   ✓ Tidak membuat card baru
#   ✓ Tidak menghapus card
#   ✓ Tidak mengubah API
#   ✓ Tidak menyentuh AELVORA
#   ✓ npm run build
# ============================================================

ROOT="$HOME/aelvora-market"
DATA="$ROOT/src/market/marketData.js"

if [[ ! "$CA" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "❌ CA tidak valid"
  exit 1
fi

if ! [[ "$ORDER" =~ ^[0-9]+$ ]] || [ "$ORDER" -lt 2 ]; then
  echo "❌ ORDER harus angka >= 2"
  exit 1
fi

echo
echo "============================================================"
echo " AELVORA FASTTRACK REPAIR FINAL"
echo "============================================================"
echo "CA    : $CA"
echo "ORDER : #$ORDER"
echo "============================================================"
echo

# ============================================================
# AMBIL LOGO DEXSCREENER
# ============================================================

LOGO="https://dd.dexscreener.com/ds-data/tokens/robinhood/${CA}.png?size=lg"

echo "LOGO : $LOGO"
echo

# ============================================================
# UPDATE MARKET DATA
# BERDASARKAN CA — BUKAN BERDASARKAN ID
# ============================================================

python3 - "$DATA" "$CA" "$ORDER" "$LOGO" <<'PY'
from pathlib import Path
import sys
import re

path = Path(sys.argv[1])
ca = sys.argv[2]
order = int(sys.argv[3])
logo = sys.argv[4]

s = path.read_text()

# ------------------------------------------------------------
# Cari object yang memiliki contract CA
# ------------------------------------------------------------

pattern = re.compile(
    r'(?P<object>\{\s*'
    r'(?:[^{}]|\{[^{}]*\})*?'
    r'contract:\s*["\']'
    + re.escape(ca)
    + r'["\']'
    r'(?:[^{}]|\{[^{}]*\})*?'
    r'\n\s*\},)',
    re.MULTILINE
)

m = pattern.search(s)

if not m:
    raise SystemExit(
        "❌ Card dengan CA tersebut tidak ditemukan di marketData.js"
    )

obj = m.group("object")

# ------------------------------------------------------------
# LOGO
# ------------------------------------------------------------

if re.search(r'logo:\s*["\'][^"\']*["\']', obj):
    obj = re.sub(
        r'logo:\s*["\'][^"\']*["\']',
        f'logo: "{logo}"',
        obj,
        count=1
    )
else:
    # Sisipkan sebelum chain
    obj = re.sub(
        r'(\n\s*chain:)',
        f'\n    logo: "{logo}",\\1',
        obj,
        count=1
    )

# ------------------------------------------------------------
# TRENDING ORDER
# ------------------------------------------------------------

if re.search(r'trendingOrder:\s*\d+', obj):
    obj = re.sub(
        r'trendingOrder:\s*\d+',
        f'trendingOrder: {order}',
        obj,
        count=1
    )
else:
    obj = re.sub(
        r'(\n\s*listedAt:[^\n]+,)',
        f'\\1\n    trendingOrder: {order},',
        obj,
        count=1
    )

s = s[:m.start("object")] + obj + s[m.end("object"):]

path.write_text(s)

print("✅ Card ditemukan berdasarkan CA")
print("✅ Logo diperbaiki")
print(f"✅ trendingOrder diperbaiki → #{order}")
PY

# ============================================================
# REPAIR GET TRENDING TOKENS
# ============================================================

python3 - "$DATA" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
s = path.read_text()

pattern = re.compile(
    r'export function getTrendingTokens\(\)\s*\{.*?\n\}',
    re.S
)

new_function = '''export function getTrendingTokens() {
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
   * AELVORA selalu #1.
   * Token lain mengikuti trendingOrder.
   * Jika tidak punya trendingOrder,
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
}'''

if not pattern.search(s):
    raise SystemExit(
        "❌ getTrendingTokens() tidak ditemukan"
    )

s = pattern.sub(
    new_function,
    s,
    count=1
)

path.write_text(s)

print("✅ getTrendingTokens() diperbaiki")
print("✅ trendingOrder sekarang benar-benar digunakan")
PY

# ============================================================
# VERIFY
# ============================================================

echo
echo "============================================================"
echo " VERIFY"
echo "============================================================"

grep -n -B 12 -A 25 "$CA" "$DATA"

echo
echo "===== TRENDING FUNCTION ====="

sed -n '/export function getTrendingTokens()/,/^}/p' "$DATA"

# ============================================================
# BUILD
# ============================================================

echo
echo "============================================================"
echo " BUILD"
echo "============================================================"

npm run build

echo
echo "============================================================"
echo " ✅ REPAIR SELESAI"
echo "============================================================"
echo "CA    : $CA"
echo "ORDER : #$ORDER"
echo "LOGO  : $LOGO"
echo
echo "Trending sekarang menggunakan trendingOrder."
echo "AELVORA tetap #1."
echo "============================================================"
