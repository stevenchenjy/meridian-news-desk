#!/usr/bin/env python3
"""Validate and save independently researched bilingual background guides."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.background import apply_background


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path, help="UTF-8 background research JSON for the current saved collection")
    args = parser.parse_args()
    try:
        result = apply_background(json.loads(args.file.read_text(encoding="utf-8")))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"Background rejected: {error}", file=sys.stderr)
        return 1
    print(f"Applied {result['appliedCount']} background guides: {result['addedCount']} added, {result['updatedCount']} updated, {result['unchangedCount']} unchanged.")
    print(f"Library: {result['guideCount']} guides · applied: {result['generatedAt']} · collection: {result['collectionGeneratedAt']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
