#!/usr/bin/env python3
"""Import bilingual publisher-text summaries without claiming independent analysis."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.newsroom import apply_summaries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path, help="UTF-8 JSON with collectionGeneratedAt and summaries")
    args = parser.parse_args()
    try:
        dashboard = apply_summaries(json.loads(args.file.read_text(encoding="utf-8")))
    except (ValueError, OSError, KeyError) as error:
        print(f"Summaries rejected: {error}", file=sys.stderr)
        return 1
    print(f"Bilingual coverage: {dashboard['stats']['bilingualSummaryCount']}/{dashboard['stats']['articleCount']} · pending: {dashboard['stats']['pendingTranslationCount']}.")
    print("Publisher-text translations retain their provenance; independent analysis is a separate stage.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
