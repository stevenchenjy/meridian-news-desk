#!/usr/bin/env python3
"""Reassemble the manually authored initial 2026-10-14 collection translations.

This is a one-snapshot preparation helper, not the daily translation generator.
Its default source is data/translation-batches/source.json: the immutable initial
collection containing 367 articles and 11 previously reviewed bilingual summaries.
The indexed batch files belong exclusively to that source. They must not be
reused against a newer live dashboard: additional reviewed summaries or different
article ordering intentionally fail validation instead of overwriting new work.
Those local source and batch files are ignored runtime data and are not shipped
in a public clone. Supply --source and --batches for a separately authored set;
use scripts/seed_demo.py for the self-contained public demonstration.

The English text is a short publisher excerpt (or the headline when the feed has
no useful excerpt). This never generates independent analysis or translations.
Chinese entries are written and reviewed by the briefing author in batch JSON.
The importer fingerprints the original title and excerpt, so collection refreshes
cannot silently attach a translation to changed reporting.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def english_excerpt(article):
    text = re.sub(r"\s+", " ", article.get("excerpt", "")).strip()
    if not text or text.startswith(("Article URL:", "The post ")):
        return article["title"]
    # Most feeds supply a short descriptive lead. Preserve its wording and
    # attribution instead of implying that a headline has been fact-checked.
    text = re.split(r"(?:Sign up for|Continue reading|Europe live –|Read more:|Read more…|Read Full Story on UN News| The post )", text)[0].strip()
    if article.get("sourceId") == "mit-smr":
        text = re.sub(r"^.{1,80}?(?:Ikon Images|Getty Images|theispot\.com)\s*", "", text)
        text = re.sub(r"^Photo courtesy DHL\s*", "", text)
        text = re.sub(r"^(?:Rob Dobi|The Research)\s*", "", text)
    if len(text) <= 330:
        return text
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z‘“])", text)
    if sentences and len(sentences[0]) <= 330:
        return sentences[0]
    # Guardian feeds sometimes fuse a standfirst, promotional text and body.
    # A faithful title summary is preferable to truncating a claim mid-sentence.
    return article["title"]


def summary_basis(article):
    """Expose headline-only scope when a feed supplies no substantive excerpt."""
    text = re.sub(r"\s+", " ", article.get("excerpt", "")).strip()
    title = re.sub(r"\s+", " ", article["title"]).strip()
    if not text or text == title or text.startswith(("Article URL:", "The post ")):
        return "headline"
    return "publisher_excerpt"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "data/translation-batches/source.json")
    parser.add_argument("--batches", type=Path, default=ROOT / "data/translation-batches")
    parser.add_argument("--output", type=Path, default=ROOT / "data/summaries-input.json")
    args = parser.parse_args()
    if not args.source.is_file():
        parser.error("Source snapshot is missing. Local translation batches are not distributed; "
                     "supply --source SNAPSHOT.json and --batches FOLDER, or use scripts/seed_demo.py.")
    source = json.loads(args.source.read_text())
    articles = source["articles"]
    authored = {}
    for batch in sorted(args.batches.glob("batch-*.json")):
        for index, entry in json.loads(batch.read_text()).items():
            index = int(index)
            if index in authored:
                raise ValueError(f"Duplicate index {index} in {batch}")
            if not (0 <= index < len(articles)):
                raise ValueError(f"Unknown index {index} in {batch}")
            if not isinstance(entry, dict) or not entry.get("zh", "").strip():
                raise ValueError(f"Missing authored Chinese summary at {index}")
            if not re.search(r"[\u3400-\u9fff]", entry["zh"]):
                raise ValueError(f"No Chinese content at {index}")
            authored[index] = entry
    summaries = []
    missing = []
    for index, article in enumerate(articles):
        if (article.get("summary") or {}).get("zh"):
            if index in authored:
                raise ValueError(f"Reviewed bilingual summary must be preserved at {index}")
            continue
        if index not in authored:
            missing.append(index)
            continue
        entry = authored[index]
        summaries.append({
            "articleId": article["id"],
            "summary": {"en": entry.get("en", english_excerpt(article)), "zh": entry["zh"].strip()},
            "basis": entry.get("basis", summary_basis(article)),
        })
    if missing:
        raise ValueError(f"Missing Chinese summaries for {len(missing)} articles: {missing}")
    payload = {"collectionGeneratedAt": source["generatedAt"], "summaries": summaries}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"snapshotArticles": len(articles), "preservedReviewed": len(articles) - len(summaries),
                      "publisherSummaries": len(summaries), "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
