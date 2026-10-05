#!/usr/bin/env bash
set -euo pipefail

DATA="$HOME/aelvora-market/src/market/marketData.js"

FROM="${1:-}"
TO="${2:-}"

if ! [[ "$FROM" =~ ^[0-9]+$ && "$TO" =~ ^[0-9]+$ ]]; then
  echo "Usage: ./move_card.sh FROM TO"
  echo "Contoh: ./move_card.sh 1 3"
  exit 1
fi

python3 - "$DATA" "$FROM" "$TO" <<'PY'
from pathlib import Path
import sys
import re
from datetime import datetime

path = Path(sys.argv[1])
FROM = int(sys.argv[2])
TO = int(sys.argv[3])

s = path.read_text()

start = s.find("export const MARKET_TOKENS = [")
if start < 0:
    raise SystemExit("❌ MARKET_TOKENS tidak ditemukan")

end = s.find("];", start)
if end < 0:
    raise SystemExit("❌ Penutup MARKET_TOKENS tidak ditemukan")

body = s[start:end]

# ============================================================
# AMBIL OBJECT
# ============================================================

objects = []
depth = 0
obj_start = None

for i, ch in enumerate(body):
    if ch == "{":
        if depth == 0:
            obj_start = i
        depth += 1

    elif ch == "}":
        depth -= 1

        if depth == 0 and obj_start is not None:
            objects.append(body[obj_start:i+1])
            obj_start = None

# ============================================================
# PARSE CARD
# ============================================================

cards = []

for obj in objects:

    id_m = re.search(r'\bid:\s*"([^"]+)"', obj)
    name_m = re.search(r'\bname:\s*"([^"]+)"', obj)
    symbol_m = re.search(r'\bsymbol:\s*"([^"]+)"', obj)
    featured_m = re.search(r'\bfeatured:\s*true', obj)

    if not id_m or not name_m or not featured_m:
        continue

    card_id = id_m.group(1)

    # AELVORA LOCK
    if card_id == "aelvora-graduate-demo":
        continue

    order_m = re.search(
        r'\btrendingOrder:\s*(\d+)',
        obj
    )

    listed_m = re.search(
        r'\blistedAt:\s*"([^"]+)"',
        obj
    )

    order = (
        int(order_m.group(1))
        if order_m else 999999
    )

    listed = listed_m.group(1) if listed_m else ""

    try:
        timestamp = datetime.fromisoformat(
            listed.replace("Z", "+00:00")
        ).timestamp()
    except:
        timestamp = 0

    cards.append({
        "id": card_id,
        "name": name_m.group(1),
        "symbol": symbol_m.group(1) if symbol_m else "",
        "order": order,
        "listed": timestamp,
    })

# ============================================================
# URUTAN AKTUAL
#
# trendingOrder kecil = posisi lebih atas
# order sama = listedAt terbaru lebih atas
# ============================================================

cards.sort(
    key=lambda x: (
        x["order"],
        -x["listed"]
    )
)

total = len(cards)

if total == 0:
    raise SystemExit("❌ Tidak ada card trending")

if FROM > total:
    raise SystemExit(
        f"❌ FROM #{FROM} tidak ada. Total card: {total}"
    )

if TO > total:
    raise SystemExit(
        f"❌ TO #{TO} tidak ada. Total card: {total}"
    )

if FROM == TO:
    raise SystemExit("❌ FROM dan TO sama")

print()
print("=" * 70)
print(" AELVORA MARKET — MOVE CARD")
print("=" * 70)
print(f"FROM : #{FROM}")
print(f"TO   : #{TO}")
print("=" * 70)

print()
print("===== SEBELUM =====")

for i, c in enumerate(cards, 1):
    print(
        f"#{i:<3} "
        f"{c['name']:<20} "
        f"{c['symbol']:<10} "
        f"{c['id']}"
    )

# ============================================================
# MOVE
# ============================================================

moved = cards.pop(FROM - 1)
cards.insert(TO - 1, moved)

print()
print("===== SESUDAH =====")

for i, c in enumerate(cards, 1):
    print(
        f"#{i:<3} "
        f"{c['name']:<20} "
        f"{c['symbol']:<10} "
        f"{c['id']}"
    )

# ============================================================
# UPDATE TRENDING ORDER
#
# #1 = trendingOrder 2
# #2 = trendingOrder 3
# #3 = trendingOrder 4
# dst...
#
# Karena AELVORA tidak dihitung.
# ============================================================

for position, card in enumerate(cards, 2):

    card_id = re.escape(card["id"])

    pattern = (
        r'(id:\s*"' +
        card_id +
        r'".*?)'
        r'trendingOrder:\s*\d+'
    )

    replacement = (
        r'\1trendingOrder: ' +
        str(position)
    )

    s2, count = re.subn(
        pattern,
        replacement,
        s,
        count=1,
        flags=re.S
    )

    if count != 1:
        raise SystemExit(
            f"❌ Gagal update order: {card['id']}"
        )

    s = s2

path.write_text(s)

print()
print("=" * 70)
print(
    f"✅ {moved['name']} : #{FROM} → #{TO}"
)
print("✅ trendingOrder semua card diperbarui")
print("✅ AELVORA tidak disentuh")
print("=" * 70)
PY

echo
echo "============================================================"
echo " BUILD"
echo "============================================================"

npm run build
