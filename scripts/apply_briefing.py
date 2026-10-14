#!/usr/bin/env python3
"""Validate evidence-bearing English/Chinese Codex analysis and save it."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.newsroom import apply_briefing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path, help="UTF-8 briefing JSON matching config/briefing-schema.json")
    args = parser.parse_args()
    try:
        payload = json.loads(args.file.read_text(encoding="utf-8"))
        dashboard = apply_briefing(payload)
    except (ValueError, OSError, KeyError) as error:
        print(f"Briefing rejected: {error}", file=sys.stderr)
        return 1
    print(f"Saved {len(dashboard['briefing']['items'])} briefing items and {sum(bool(a.get('analysis')) for a in dashboard['articles'])} analyzed articles.")
    print(f"Analysis: {dashboard['briefing']['generatedAt']} · collection: {dashboard['generatedAt']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
