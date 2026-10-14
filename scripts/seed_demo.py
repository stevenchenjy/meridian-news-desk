#!/usr/bin/env python3
"""Load two explicitly fictional, bilingual examples into an empty workspace.

No feeds, websites, AI provider, Codex account or automation are called. Dates
are rebased so the continuing important event is 13 days old and the minor
announcement is one hour old. Existing local data is never overwritten.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"


def empty_data_folder(workspace: Path) -> None:
    data = workspace / "data"
    if data.is_symlink():
        raise ValueError("Refusing to seed a symlinked data folder.")
    if data.exists() and (not data.is_dir() or any(data.iterdir())):
        raise ValueError(
            "Refusing to overwrite existing local data. Use a fresh clone or an "
            "empty workspace; this command has no force or reset option."
        )


def read_example(name: str) -> dict:
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def rebase_snapshot(snapshot: dict, now: datetime) -> str:
    reference = datetime.fromisoformat(snapshot["generatedAt"].replace("Z", "+00:00"))
    shift = now - reference

    def move(value: str) -> str:
        date = datetime.fromisoformat(value.replace("Z", "+00:00")) + shift
        return date.isoformat(timespec="microseconds").replace("+00:00", "Z")

    snapshot["generatedAt"] = move(snapshot["generatedAt"])
    snapshot["collection"]["finishedAt"] = snapshot["generatedAt"]
    for article in snapshot["articles"]:
        article["publishedAt"] = move(article["publishedAt"])
        article["collectedAt"] = move(article["collectedAt"])
    for source in snapshot["sources"]:
        if source.get("latestItemAt"):
            source["latestItemAt"] = move(source["latestItemAt"])
    return snapshot["generatedAt"]


def seed(workspace: Path) -> dict:
    empty_data_folder(workspace)
    # Import after the empty-state guard and argument parser, so --help and the
    # overwrite refusal work even before optional Python dependencies exist.
    sys.path.insert(0, str(ROOT))
    try:
        from server.newsroom import apply_briefing, apply_summaries, atomic_json
    except ModuleNotFoundError as error:
        raise ValueError(
            "Python dependencies are missing. First run npm run setup -- "
            "--skip-collect, then use .venv/bin/python scripts/seed_demo.py."
        ) from error

    snapshot = read_example("demo-snapshot.json")
    summaries = read_example("demo-summaries.json")
    briefing = read_example("demo-briefing.json")
    generated = rebase_snapshot(snapshot, datetime.now(timezone.utc))
    summaries["collectionGeneratedAt"] = generated
    briefing["collectionGeneratedAt"] = generated

    # Exercise the production validators on staged data. Failed imports leave
    # the user's workspace untouched. The final directory rename is atomic and
    # cannot replace a nonempty data directory created concurrently.
    with tempfile.TemporaryDirectory(prefix=".meridian-demo-", dir=workspace) as temp:
        staged = Path(temp)
        policy = workspace / "config" / "attention-policy.json"
        if policy.is_file():
            atomic_json(staged / "config" / "attention-policy.json", json.loads(policy.read_text()))
        atomic_json(staged / "data" / "dashboard.json", snapshot)
        atomic_json(staged / "data" / "summaries-input.json", summaries)
        atomic_json(staged / "data" / "briefing-input.json", briefing)
        apply_summaries(summaries, root=staged)
        result = apply_briefing(briefing, root=staged)
        if result["stats"]["articleCount"] != 2 or result["stats"]["bilingualSummaryCount"] != 2:
            raise ValueError("Demo validation failed: expected two bilingual examples.")
        ranked = result["attention"]["items"]
        if len(ranked) != 2 or ranked[0]["importance"] != 84:
            raise ValueError("Demo validation failed: the older important event must rank first.")
        empty_data_folder(workspace)
        os.rename(staged / "data", workspace / "data")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workspace", type=Path, default=ROOT,
        help="Empty workspace to receive data; default is this project. Useful for isolated validation.",
    )
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()
    if not workspace.is_dir():
        parser.error("--workspace must name an existing directory")
    try:
        result = seed(workspace)
    except (ValueError, OSError) as error:
        print(f"Demo not loaded: {error}", file=sys.stderr)
        return 2
    print("Loaded 2 fictional examples with English + Chinese summaries and sample analyses.")
    print("The 13-day-old event ranks above the one-hour-old announcement and stays until marked read.")
    print("No feeds, AI provider or schedule were used. Example URLs are not real reports.")
    print(f"Data folder: {workspace / 'data'}")
    if workspace == ROOT:
        print("Run npm start, then open http://localhost:4310/.")
    else:
        print("This isolated workspace is for inspection; launch a fresh project copy to view its dashboard.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
