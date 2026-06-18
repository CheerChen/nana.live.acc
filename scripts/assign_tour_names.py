#!/usr/bin/env python3
"""
Seed `tour_id` on every show in frontend/public/data/shows.json and (re)build
frontend/public/data/tours.json.

The script uses suffix-stripping as a best-effort guess and **respects any
tour_id already set** — so once you hand-correct a misgrouped show, re-running
this script will not overwrite your edit.

Workflow:
    1. make assign-tours      (or: python3 scripts/assign_tour_names.py)
    2. Open shows.json and skim the printed summary for tours that look wrong.
    3. Hand-edit shows.json (set tour_id on the offending row) or tours.json
       (rename a tour's display name).
    4. Re-run; your edits stick.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SHOWS_PATH = REPO_ROOT / "frontend" / "public" / "data" / "shows.json"
TOURS_PATH = REPO_ROOT / "frontend" / "public" / "data" / "tours.json"

# Markers that mean "this trailing chunk is a per-show distinguisher".
# When matched we cut the name at the last whitespace before the marker.
DISTINGUISHER = re.compile(
    r"(\d+(?:日目|本目)|Day\s?\d+|千秋楽|初日|ファイナル|凱旋公演|(?:夜|昼|朝|追加)公演)",
    re.IGNORECASE,
)

REGION_SUFFIX = re.compile(
    r"\s(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川"
    r"|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山"
    r"|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄"
    r"|横浜|仙台|札幌|名古屋|神戸|香港|韓国|台湾|台北|ソウル|上海|北京|海外)$"
)


# A trailing token like "WAVE14(上海)" / "AIR07(横浜)" / "LESSON3(宮城)" / "TREASURE 04(静岡)" —
# any non-whitespace chunk ending in (...). Tail-anchored.
TRAILING_PAREN_TOKEN = re.compile(r"\s\S+\([^)]+\)\s*$")

CANONICAL_TOUR_NAMES = {
    "NANA MIZUKI LIVE SENSATION 2003 -Hall": "NANA MIZUKI LIVE SENSATION 2003",
    "NANA MIZUKI LIVE SENSATION 2003 -Zepp": "NANA MIZUKI LIVE SENSATION 2003",
    "NANA MIZUKI LIVE CIRCUS 2013+": "NANA MIZUKI LIVE CIRCUS 2013",
    "NANA MIZUKI LIVE ADVENTURE 2015 TREASURE": "NANA MIZUKI LIVE ADVENTURE 2015",
    "NANA MIZUKI LIVE ISLAND 2018 +": "NANA MIZUKI LIVE ISLAND 2018",
}


def derive_tour_name(performance_name: str) -> str:
    """Best-effort derivation. May be wrong for unusual naming — that's why
    the script never overwrites an existing tour_id."""
    m = DISTINGUISHER.search(performance_name)
    if m and m.start() > 0:
        last_space = performance_name.rfind(" ", 0, m.start())
        if last_space > 0:
            derived = performance_name[:last_space].strip()
            return CANONICAL_TOUR_NAMES.get(derived, derived)

    m2 = TRAILING_PAREN_TOKEN.search(performance_name)
    if m2:
        derived = performance_name[: m2.start()].strip()
        return CANONICAL_TOUR_NAMES.get(derived, derived)

    m3 = REGION_SUFFIX.search(performance_name)
    if m3:
        derived = performance_name[: m3.start()].strip()
        return CANONICAL_TOUR_NAMES.get(derived, derived)

    return CANONICAL_TOUR_NAMES.get(performance_name, performance_name)


def slugify(name: str) -> str:
    """Make a stable, human-readable tour_id. CJK characters are preserved."""
    s = name.strip().lower()
    # Drop quotes, parens, and other ornamental punctuation
    s = re.sub(r"[\"'“”’‘()（）\[\]【】<>《》!！?？,，.。:：;；]", "", s)
    # Collapse whitespace to a single dash
    s = re.sub(r"\s+", "-", s, flags=re.UNICODE)
    # Drop any remaining non-word, non-dash chars (keeps CJK via \w + UNICODE)
    s = re.sub(r"[^\w\-]", "", s, flags=re.UNICODE)
    # Normalise to NFC so identical-looking CJK don't diverge
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "unknown"


def main() -> int:
    shows = json.loads(SHOWS_PATH.read_text(encoding="utf-8"))

    # Pre-load existing tours.json to keep already-known tour display names.
    existing_tours: dict[str, str] = {}
    if TOURS_PATH.exists():
        for t in json.loads(TOURS_PATH.read_text(encoding="utf-8")):
            existing_tours[t["id"]] = t["name"]

    # First pass: derive (or accept) tour_id + tour name per show
    assigned = 0
    name_by_id: dict[str, str] = dict(existing_tours)  # tour_id -> name
    slug_by_name: dict[str, str] = {v: k for k, v in existing_tours.items()}

    for show in shows:
        if show.get("tour_id"):
            continue  # respect manual / prior assignment

        derived = derive_tour_name(show["performance_name"])

        if derived in slug_by_name:
            tour_id = slug_by_name[derived]
        else:
            base = slugify(derived)
            tour_id = base
            n = 2
            while tour_id in name_by_id and name_by_id[tour_id] != derived:
                tour_id = f"{base}-{n}"
                n += 1
            name_by_id[tour_id] = derived
            slug_by_name[derived] = tour_id

        show["tour_id"] = tour_id
        assigned += 1

    # Re-derive tours.json from whatever tour_ids are now on shows.
    # Sort by the latest show date in each tour (most recent first).
    latest_date: dict[str, str] = defaultdict(str)
    for s in shows:
        tid = s.get("tour_id")
        if not tid:
            continue
        if s["date"] > latest_date[tid]:
            latest_date[tid] = s["date"]

    tour_ids_in_use = set(latest_date.keys())
    tours_out = sorted(
        [{"id": tid, "name": name_by_id.get(tid, tid)} for tid in tour_ids_in_use],
        key=lambda t: latest_date[t["id"]],
        reverse=True,
    )

    # Write back
    SHOWS_PATH.write_text(
        json.dumps(shows, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    TOURS_PATH.write_text(
        json.dumps(tours_out, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Summary print: highlights singletons so the reviewer can scan for
    # tours that probably should have been merged.
    counts = Counter(s.get("tour_id") for s in shows if s.get("tour_id"))
    print(
        f"Assigned tour_id to {assigned} new show(s). "
        f"{len(shows)} shows total, {len(tours_out)} tours, "
        f"{sum(1 for _, c in counts.items() if c == 1)} singleton(s)."
    )
    print()
    print("Singletons (review for misgrouping):")
    for t in tours_out:
        if counts[t["id"]] == 1:
            sample = next(s for s in shows if s.get("tour_id") == t["id"])
            print(f"  · {t['name']}   ← {sample['performance_name']}")

    print()
    print("Tours with 2+ shows (most recent first):")
    for t in tours_out:
        c = counts[t["id"]]
        if c >= 2:
            print(f"  {c:3d}  [{t['id']}]  {t['name']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
