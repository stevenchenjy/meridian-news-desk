#!/usr/bin/env python3
"""Save English-first reading copy on reviewed articles without reverifying facts."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.newsroom import apply_editorial


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path,
                        help="UTF-8 editorial JSON matching config/briefing-schema.json#/$defs/editorialOverlay")
    args = parser.parse_args()
    try:
        payload = json.loads(args.file.read_text(encoding="utf-8"))
        dashboard = apply_editorial(payload)
    except (ValueError, OSError, KeyError) as error:
        print(f"Editorial edit rejected: {error}", file=sys.stderr)
        return 1
    print(f"Saved reading copy for {len(payload['articles'])} reviewed articles"
          f"{' and the daily briefing' if 'briefing' in payload else ''}.")
    print(f"Collection: {dashboard['generatedAt']}. Factual review dates and read state are preserved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
