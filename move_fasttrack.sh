#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AELVORA MARKET — FASTTRACK GLOBAL POSITION MANAGER
# ============================================================
#
# 🔴 CUMA GANTI 2 BARIS:
#
FROM=2
TO=5
#
# ============================================================
#
# HANYA MENGUBAH:
#   trendingOrder: angka
#
# TIDAK MENGUBAH:
#   ✓ isi card
#   ✓ logo
#   ✓ name
#   ✓ symbol
#   ✓ CA
#   ✓ price
#   ✓ market cap
#   ✓ API
#   ✓ AELVORA
#
# ============================================================

ROOT="$HOME/aelvora-market"
DATA="$ROOT/src/market/marketData.js"

if ! [[ "$FROM" =~ ^[0-9]+$ ]] || ! [[ "$TO" =~ ^[0-9]+$ ]]; then
  echo "❌ FROM dan TO harus angka"
  exit 1
fi

if [ "$FROM" -lt 1 ] || [ "$TO" -lt 1 ]; then
  echo "❌ FROM dan TO minimal 1"
  exit 1
fi

if [ "$FROM" -eq "$TO" ]; then
  echo "❌ FROM dan TO sama. Tidak ada yang perlu dipindahkan."
  exit 1
fi

echo
echo "============================================================"
echo " AELVORA FASTTRACK — GLOBAL POSITION MOVE"
echo "============================================================"
echo "FROM : #$FROM"
echo "TO   : #$TO"
echo "============================================================"
echo

# ============================================================
# BACKUP
# ============================================================

cp "$DATA" "$DATA.bak-move"

# ============================================================
# PYTHON — HANYA UPDATE trendingOrder
# ============================================================

python3 - "$DATA" "$FROM" "$TO" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
FROM = int(sys.argv[2])
TO = int(sys.argv[3])

s = path.read_text()

# ------------------------------------------------------------
# Ambil hanya isi MARKET_TOKENS
# ------------------------------------------------------------

start_marker = "export const MARKET_TOKENS = ["
start = s.find(start_marker)

if start == -1:
    raise SystemExit("❌ MARKET_TOKENS tidak ditemukan")

end = s.find("];", start)

if end == -1:
    raise SystemExit("❌ Penutup MARKET_TOKENS tidak ditemukan")

prefix = s[:start]
body = s[start:end]
suffix = s[end:]

# ------------------------------------------------------------
# Cari SEMUA object Fasttrack berdasarkan:
#
# category: "fasttrack"
#
# lalu ambil id + trendingOrder
# ------------------------------------------------------------

pattern = re.compile(
    r'(\{\s*'
    r'id:\s*"([^"]+)"'
    r'.*?'
    r'category:\s*"fasttrack"'
    r'.*?'
    r'trendingOrder:\s*)(\d+)(\s*,?\s*\})',
    re.S
)

matches = list(pattern.finditer(body))

if not matches:
    raise SystemExit("❌ Tidak ada card Fasttrack ditemukan")

cards = []

for m in matches:
    card_id = m.group(2)
    order = int(m.group(3))

    cards.append({
        "id": card_id,
        "order": order,
        "start": m.start(),
        "end": m.end(),
        "match": m,
    })

# ------------------------------------------------------------
# Urutkan berdasarkan trendingOrder
# ------------------------------------------------------------

cards.sort(key=lambda x: (x["order"], x["id"]))

print("===== FASTTRACK SEBELUM =====")

for i, card in enumerate(cards, start=1):
    print(f"#{i:<3} {card['id']}")

# ------------------------------------------------------------
# Validasi posisi
# ------------------------------------------------------------

if FROM > len(cards):
    raise SystemExit(
        f"❌ Posisi FROM #{FROM} tidak ada. "
        f"Total Fasttrack: {len(cards)}"
    )

if TO > len(cards):
    raise SystemExit(
        f"❌ Posisi TO #{TO} tidak ada. "
        f"Total Fasttrack: {len(cards)}"
    )

# ------------------------------------------------------------
# Pindahkan secara LOGICAL
# ------------------------------------------------------------

ordered = cards[:]

moved = ordered.pop(FROM - 1)
ordered.insert(TO - 1, moved)

# ------------------------------------------------------------
# Mapping ID -> order baru
#
# Mulai dari 1 karena posisi Fasttrack dihitung sendiri.
# AELVORA tidak disentuh.
# ------------------------------------------------------------

new_orders = {}

for position, card in enumerate(ordered, start=1):
    new_orders[card["id"]] = position

# ------------------------------------------------------------
# Tampilkan hasil
# ------------------------------------------------------------

print()
print("===== FASTTRACK SESUDAH =====")

for position, card in enumerate(ordered, start=1):
    print(f"#{position:<3} {card['id']}")

print()
print(
    f"✅ {moved['id']}: "
    f"Fasttrack #{FROM} → #{TO}"
)

# ------------------------------------------------------------
# UPDATE ANGKA trendingOrder SAJA
# ------------------------------------------------------------

# Replace dari belakang agar posisi teks tidak berubah.
replacements = []

for card in cards:
    new_order = new_orders[card["id"]]
    m = card["match"]

    # Cari angka trendingOrder dalam match object
    absolute_start = m.start(3)
    absolute_end = m.end(3)

    replacements.append(
        (absolute_start, absolute_end, str(new_order))
    )

# Jangan mengubah struktur object.
for start_pos, end_pos, replacement in reversed(replacements):
    body = (
        body[:start_pos]
        + replacement
        + body[end_pos:]
    )

# ------------------------------------------------------------
# Tulis kembali
# ------------------------------------------------------------

path.write_text(prefix + body + suffix)

print()
print("✅ HANYA trendingOrder yang diubah")
PY

# ============================================================
# VERIFY SYNTAX
# ============================================================

echo
echo "============================================================"
echo " VERIFY"
echo "============================================================"

grep -n -B 3 -A 3 'category: "fasttrack"' "$DATA" | grep -E \
'id:|category:|trendingOrder:' || true

# ============================================================
# BUILD
# ============================================================

echo
echo "============================================================"
echo " BUILD"
echo "============================================================"

if npm run build; then

  echo
  echo "============================================================"
  echo " ✅ POSITION MOVE BERHASIL"
  echo "============================================================"
  echo
  echo "FROM : #$FROM"
  echo "TO   : #$TO"
  echo
  echo "File card tidak dipindahkan."
  echo "Hanya angka trendingOrder yang berubah."
  echo
  echo "============================================================"

  rm -f "$DATA.bak-move"

else

  echo
  echo "❌ BUILD GAGAL"
  echo "🔄 RESTORE marketData.js..."

  cp "$DATA.bak-move" "$DATA"

  echo "✅ File dikembalikan ke kondisi sebelum move."
  rm -f "$DATA.bak-move"

  exit 1
fi

