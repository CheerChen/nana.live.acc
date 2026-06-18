#!/usr/bin/env python3
"""
Import the LIVE VISION 2025-2026 setlist matrix from the published Google Sheet
and merge it into frontend/public/data/{shows,songs,performances,metadata}.json.

The original DB-backed crawler is no longer maintained; this script writes the
static JSON directly so the frontend keeps a single source of truth.

Re-running is idempotent:
  - shows are deduped by (date, performance_name)
  - songs are deduped by name (existing IDs reused)
  - performances are deduped by (show_id, song_id)

Schedule reference:
  https://www.mizukinana.jp/special/2025_livevision/schedule.html
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Iterable

SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vTtfHE3SHAJtlIR3QOtLwT-KyOvl9ov33PGHITeM4XhLzwCUfBPPOqaSPrf5ssfpqTR8wNpd-kFQnM5"
    "/pub?gid=1649478108&single=true&output=csv"
)

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "frontend" / "public" / "data"

TOUR_NAME = "NANA MIZUKI LIVE VISION 2025-2026"
TOUR_ID = "nana-mizuki-live-vision-2025-2026"

# Order MUST match the Sheet's 公演01..公演15 column order (CSV columns 8..22).
# If new shows are added to the Sheet (KR / TW), append entries here with
# the matching code prefix used in the matrix cells.
SHOWS: list[dict] = [
    {"code": "北",  "date": "2025-12-06", "venue": "真駒内セキスイハイムアイスアリーナ",                 "label": "北海道"},
    {"code": "媛1", "date": "2025-12-13", "venue": "松山市民会館 大ホール",                                 "label": "愛媛1日目"},
    {"code": "媛2", "date": "2025-12-14", "venue": "松山市民会館 大ホール",                                 "label": "愛媛2日目"},
    {"code": "兵1", "date": "2025-12-20", "venue": "GLION ARENA KOBE",                                       "label": "兵庫1日目"},
    {"code": "兵2", "date": "2025-12-21", "venue": "GLION ARENA KOBE",                                       "label": "兵庫2日目"},
    {"code": "広1", "date": "2025-12-27", "venue": "上野学園ホール",                                         "label": "広島1日目"},
    {"code": "広2", "date": "2025-12-28", "venue": "上野学園ホール",                                         "label": "広島2日目"},
    {"code": "名1", "date": "2026-01-10", "venue": "Niterra 日本特殊陶業市民会館 フォレストホール",       "label": "愛知1日目"},
    {"code": "名2", "date": "2026-01-11", "venue": "Niterra 日本特殊陶業市民会館 フォレストホール",       "label": "愛知2日目"},
    {"code": "九1", "date": "2026-01-17", "venue": "福岡サンパレスホテル＆ホール",                         "label": "福岡1日目"},
    {"code": "九2", "date": "2026-01-18", "venue": "福岡サンパレスホテル＆ホール",                         "label": "福岡2日目"},
    {"code": "東1", "date": "2026-01-23", "venue": "TOYOTA ARENA TOKYO",                                     "label": "東京1日目"},
    {"code": "東2", "date": "2026-01-24", "venue": "TOYOTA ARENA TOKYO",                                     "label": "東京2日目"},
    {"code": "東3", "date": "2026-01-25", "venue": "TOYOTA ARENA TOKYO",                                     "label": "東京3日目"},
    {"code": "+hk", "date": "2026-02-15", "venue": "MacPherson Stadium",                                     "label": "香港"},
]

# CSV column layout (0-indexed):
#   [5]  -> song name
#   [8..22] -> 15 show columns matching SHOWS above
SONG_NAME_COL = 5
SHOW_COL_START = 8
SHOW_COL_END = SHOW_COL_START + len(SHOWS)  # exclusive


def fetch_csv(url: str) -> list[list[str]]:
    """Download the Sheet CSV and return rows."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.reader(io.StringIO(raw)))


def is_data_row(row: list[str]) -> bool:
    """Filter out header rows, totals, and #N/A trailing rows."""
    if len(row) <= SONG_NAME_COL:
        return False
    name = row[SONG_NAME_COL].strip()
    if not name:
        return False
    # Header literally has the word "name" in this column
    if name.lower() == "name":
        return False
    if row[1].strip() in ("99",) or row[1].strip().startswith("#N/A"):
        return False
    return True


def parse_cell(cell: str) -> int | None:
    """A non-empty matrix cell looks like '北-01' or '東3-26'.
    Returns the song-order number, or None if empty/invalid.
    """
    cell = cell.strip().lstrip("'")  # leading apostrophe = sheet text marker
    if not cell:
        return None
    m = re.match(r"^.+?-(\d+)$", cell)
    if not m:
        return None
    return int(m.group(1))


def load_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def write_json(name: str, payload) -> None:
    path = DATA_DIR / name
    with path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    print(f"Fetching {SHEET_CSV_URL.split('?')[0]} ...")
    rows = fetch_csv(SHEET_CSV_URL)
    print(f"  -> {len(rows)} CSV rows")

    data_rows = [r for r in rows if is_data_row(r)]
    print(f"  -> {len(data_rows)} song rows")

    # Sanity: confirm column alignment with SHOWS[].code by inspecting the first
    # row whose target column is non-empty.
    for col_idx, show in enumerate(SHOWS, start=SHOW_COL_START):
        sample = next(
            (r[col_idx] for r in data_rows if col_idx < len(r) and r[col_idx].strip()),
            "",
        )
        prefix = re.split(r"-\d+$", sample.strip().lstrip("'"))[0] if sample else ""
        if sample and prefix != show["code"]:
            print(
                f"WARNING: column {col_idx} sample {sample!r} does not start with "
                f"expected code {show['code']!r}. Sheet layout may have shifted.",
                file=sys.stderr,
            )

    shows = load_json("shows.json")
    songs = load_json("songs.json")
    performances = load_json("performances.json")

    show_key_to_id = {(s["date"], s["performance_name"]): s["id"] for s in shows}
    song_name_to_id = {s["name"]: s["id"] for s in songs}
    perf_set = {(p["h"], p["s"]) for p in performances}

    next_show_id = max((s["id"] for s in shows), default=0) + 1
    next_song_id = max((s["id"] for s in songs), default=0) + 1

    code_to_show_id: dict[str, int] = {}
    added_shows = 0
    for meta in SHOWS:
        performance_name = f"{TOUR_NAME} {meta['label']}"
        key = (meta["date"], performance_name)
        if key in show_key_to_id:
            code_to_show_id[meta["code"]] = show_key_to_id[key]
            continue
        shows.append(
            {
                "id": next_show_id,
                "date": meta["date"],
                "performance_name": performance_name,
                "venue": meta["venue"],
                "url": None,
                "tour_id": TOUR_ID,
            }
        )
        show_key_to_id[key] = next_show_id
        code_to_show_id[meta["code"]] = next_show_id
        next_show_id += 1
        added_shows += 1

    added_songs = 0
    added_perfs = 0

    def ensure_song(name: str) -> int:
        nonlocal next_song_id, added_songs
        if name in song_name_to_id:
            return song_name_to_id[name]
        songs.append({"id": next_song_id, "name": name})
        song_name_to_id[name] = next_song_id
        next_song_id += 1
        added_songs += 1
        return song_name_to_id[name]

    for row in data_rows:
        song_name = row[SONG_NAME_COL].strip()
        # pad row if it ends short
        padded = row + [""] * (SHOW_COL_END - len(row))
        for col_idx, meta in zip(range(SHOW_COL_START, SHOW_COL_END), SHOWS):
            order = parse_cell(padded[col_idx])
            if order is None:
                continue
            show_id = code_to_show_id[meta["code"]]
            song_id = ensure_song(song_name)
            if (show_id, song_id) in perf_set:
                continue
            performances.append({"h": show_id, "s": song_id, "o": order})
            perf_set.add((show_id, song_id))
            added_perfs += 1

    # Sort outputs to match existing convention (shows desc by date, songs asc by name,
    # perfs by show then order).
    shows.sort(key=lambda s: (s["date"], s["id"]), reverse=True)
    songs.sort(key=lambda s: s["name"])
    performances.sort(key=lambda p: (p["h"], p.get("o", 0)))

    write_json("shows.json", shows)
    write_json("songs.json", songs)
    write_json("performances.json", performances)

    metadata = {
        "export_date": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_shows": len(shows),
        "total_songs": len(songs),
        "total_performances": len(performances),
    }
    write_json("metadata.json", metadata)

    print()
    print(f"  + {added_shows} new show(s)")
    print(f"  + {added_songs} new song(s)")
    print(f"  + {added_perfs} new performance row(s)")
    print()
    print(f"Totals now: {metadata['total_shows']} shows / "
          f"{metadata['total_songs']} songs / "
          f"{metadata['total_performances']} performances")
    return 0


if __name__ == "__main__":
    sys.exit(main())
