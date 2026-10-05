#!/usr/bin/env bash
set -euo pipefail

DATA="$HOME/aelvora-market/src/market/marketData.js"

python3 - "$DATA" <<'PY'
from pathlib import Path
import sys
import re
from datetime import datetime

path = Path(sys.argv[1])
s = path.read_text()

start = s.find("export const MARKET_TOKENS = [")
if start < 0:
    raise SystemExit("❌ MARKET_TOKENS tidak ditemukan")

end = s.find("];", start)
if end < 0:
    raise SystemExit("❌ Penutup MARKET_TOKENS tidak ditemukan")

body = s[start:end]

# ============================================================
# AMBIL SEMUA OBJECT
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
# AMBIL CARD FEATURED
# ============================================================

cards = []

for obj in objects:

    id_m = re.search(r'\bid:\s*"([^"]+)"', obj)
    name_m = re.search(r'\bname:\s*"([^"]+)"', obj)
    symbol_m = re.search(r'\bsymbol:\s*"([^"]+)"', obj)
    featured_m = re.search(r'\bfeatured:\s*true', obj)

    if not id_m or not name_m or not featured_m:
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
        if order_m
        else 999999
    )

    listed = listed_m.group(1) if listed_m else ""

    try:
        timestamp = datetime.fromisoformat(
            listed.replace("Z", "+00:00")
        ).timestamp()
    except:
        timestamp = 0

    cards.append({
        "id": id_m.group(1),
        "name": name_m.group(1),
        "symbol": symbol_m.group(1) if symbol_m else "",
        "order": order,
        "listed": timestamp,
    })

if not cards:
    raise SystemExit("❌ Tidak ada featured card ditemukan")

# ============================================================
# BACA URUTAN SAAT INI
# ============================================================

cards.sort(
    key=lambda x: (
        x["order"],
        -x["listed"]
    )
)

print()
print("=" * 70)
print(" AELVORA MARKET — RAPIKAN TRENDING ORDER")
print("=" * 70)

print()
print("===== URUTAN SAAT INI =====")

for i, card in enumerate(cards, 1):
    print(
        f"#{i:<3} "
        f"{card['name']:<20} "
        f"{card['symbol']:<10} "
        f"order={card['order']}"
    )

# ============================================================
# SET ORDER 1, 2, 3, 4, ...
# ============================================================

for position, card in enumerate(cards, 1):

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
            f"❌ Gagal update: {card['id']}"
        )

    s = s2

path.write_text(s)

# ============================================================
# HASIL
# ============================================================

print()
print("===== ORDER SETELAH DIRAPIKAN =====")

for i, card in enumerate(cards, 1):
    print(
        f"#{i:<3} "
        f"{card['name']:<20} "
        f"{card['symbol']:<10} "
        f"trendingOrder={i}"
    )

print()
print("=" * 70)
print("✅ SELESAI")
print("✅ Order sekarang 1, 2, 3, 4, dst.")
print("✅ Tidak ada card yang dihapus")
print("✅ Tidak ada whitelist / lock khusus")
print("=" * 70)
PY

npm run build
