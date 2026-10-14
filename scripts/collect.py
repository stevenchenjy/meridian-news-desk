#!/usr/bin/env python3
"""Fetch real configured feeds and atomically update the local dashboard."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.newsroom import collect_dashboard


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", action="append", help="Collect only this configured source ID; repeatable")
    parser.add_argument("--no-archive", action="store_true", help="Do not save a collection archive")
    parser.add_argument("--json", action="store_true", help="Print compact refresh statistics as JSON")
    args = parser.parse_args()
    try:
        dashboard = collect_dashboard(source_ids=set(args.source) if args.source else None, archive=not args.no_archive)
    except Exception as error:
        print(f"Collection failed: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"generatedAt": dashboard["generatedAt"], "collection": dashboard["collection"], "stats": dashboard["stats"]}))
    else:
        outcome = dashboard["collection"]
        print(f"Collection finished: {outcome['succeeded']}/{outcome['requestedSources']} requested sources succeeded; {len(dashboard['articles'])} unique cached articles.")
        print(f"Snapshot: {dashboard['generatedAt']} · data/dashboard.json")
        for source in dashboard["sources"]:
            if source["status"] == "error":
                print(f"WARNING {source['id']}: {source['error']} (cached articles retained)", file=sys.stderr)
        print("Publisher excerpts are collected. Bilingual analysis is only added by a validated Codex briefing.")
    return 2 if dashboard["collection"]["requestedSources"] and not dashboard["collection"]["succeeded"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
