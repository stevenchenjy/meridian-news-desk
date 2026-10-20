"""Validated, independently researched background guides for the live reader.

Bundled files are the bootstrap library. Daily research is a persistent overlay,
read on every dashboard request so applying a guide never requires a UI rebuild.
Collection freshness is separate from a guide's factual coverage and review dates.
"""
from __future__ import annotations

import copy
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = {"politics", "economy", "development", "industry"}
SOURCE_KINDS = {"historical-record", "institutional-position", "independent-reporting"}
GUIDE_FIELDS = {"id", "title", "subtitle", "category", "keywords", "reviewedAt", "coverageThrough",
                "overview", "takeaways", "actors", "roots", "timeline", "terms", "readingLens", "sources"}
ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]{1,79}")
MAX_GUIDES = 200
MAX_INPUT_BYTES = 4 * 1024 * 1024
ARCHIVE_LIMIT = 60


def _keys(value, allowed, label, required=None):
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    unknown = set(value) - allowed
    if unknown:
        raise ValueError(f"{label} has unknown fields: {', '.join(sorted(map(str, unknown)))}")
    missing = (required if required is not None else allowed) - set(value)
    if missing:
        raise ValueError(f"{label} is missing fields: {', '.join(sorted(missing))}")


def _text(value, label, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit or "\x00" in value:
        raise ValueError(f"{label} must be nonempty text of at most {limit} characters")
    return value.strip()


def _pair(value, label, limit=4000):
    _keys(value, {"en", "zh"}, label)
    return {language: _text(value[language], f"{label}.{language}", limit) for language in ("en", "zh")}


def _list(value, label, low, high):
    if not isinstance(value, list) or not low <= len(value) <= high:
        raise ValueError(f"{label} must contain {low}–{high} items")
    return value


def _ident(value, label):
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise ValueError(f"{label} must be a stable lowercase ID of 2–80 letters, digits or hyphens")
    return value


def _date(value, label):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"{label} must be an exact YYYY-MM-DD date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{label} must be a valid YYYY-MM-DD date") from error
    if parsed > datetime.now(timezone.utc).date():
        raise ValueError(f"{label} cannot be in the future")
    return value


def _timestamp(value, label):
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError(f"{label} must be an ISO timestamp with timezone")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timezone missing")
    except ValueError as error:
        raise ValueError(f"{label} must be an ISO timestamp with timezone") from error
    return value


def _event_date(value, label):
    # Older events may only be established to a year or month. Preserve that precision
    # rather than inventing a day that the supporting source never supplied.
    if isinstance(value, str) and re.fullmatch(r"\d{4}", value):
        if not 1 <= int(value) <= datetime.now(timezone.utc).year:
            raise ValueError(f"{label} must be a valid historical year")
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}", value):
        _date(value + "-01", label)
        return value
    return _date(value, label)


def _https(value, label):
    value = _text(value, label, 2048)
    try:
        parts = urlsplit(value)
        valid = parts.scheme == "https" and parts.hostname and not parts.username and not parts.password
        # Accessing port also rejects malformed port/IPv6 spellings.
        parts.port
    except ValueError as error:
        raise ValueError(f"{label} must be a valid HTTPS source URL") from error
    if not valid or any(character.isspace() for character in value):
        raise ValueError(f"{label} must be a valid HTTPS source URL")
    return value


def _source_ids(value, available, label):
    result = [_ident(item, label) for item in _list(value, label, 1, 20)]
    if len(result) != len(set(result)) or any(ident not in available for ident in result):
        raise ValueError(f"{label} must resolve to unique IDs in this guide's HTTPS sources")
    return result


def validate_guide(raw, label="guide"):
    """Validate the complete reader-facing schema; do not fill missing research."""
    _keys(raw, GUIDE_FIELDS, label)
    guide = {"id": _ident(raw["id"], f"{label}.id")}
    if not isinstance(raw["category"], str) or raw["category"] not in CATEGORIES:
        raise ValueError(f"{label}.category must be politics, economy, development or industry")
    guide["category"] = raw["category"]
    for field, limit in (("title", 240), ("subtitle", 400), ("overview", 6000), ("roots", 8000)):
        guide[field] = _pair(raw[field], f"{label}.{field}", limit)
    guide["keywords"] = [_text(value, f"{label}.keywords", 120)
                         for value in _list(raw["keywords"], f"{label}.keywords", 1, 80)]
    if len({value.casefold() for value in guide["keywords"]}) != len(guide["keywords"]):
        raise ValueError(f"{label}.keywords must be unique")
    for field in ("reviewedAt", "coverageThrough"):
        guide[field] = _date(raw[field], f"{label}.{field}")
    if guide["coverageThrough"] > guide["reviewedAt"]:
        raise ValueError(f"{label}.coverageThrough cannot be later than reviewedAt")
    guide["takeaways"] = [_pair(value, f"{label}.takeaways[{index}]", 2000)
                          for index, value in enumerate(_list(raw["takeaways"], f"{label}.takeaways", 3, 3))]
    guide["readingLens"] = [_pair(value, f"{label}.readingLens[{index}]", 3000)
                           for index, value in enumerate(_list(raw["readingLens"], f"{label}.readingLens", 1, 20))]
    guide["sources"] = []
    source_ids = set()
    for index, value in enumerate(_list(raw["sources"], f"{label}.sources", 1, 50)):
        at = f"{label}.sources[{index}]"
        fields = {"id", "title", "publisher", "url", "kind"}
        _keys(value, fields | {"publishedAt"}, at, fields)
        source = {"id": _ident(value["id"], f"{at}.id"), "title": _text(value["title"], f"{at}.title", 600),
                  "publisher": _text(value["publisher"], f"{at}.publisher", 240), "url": _https(value["url"], f"{at}.url")}
        if not isinstance(value["kind"], str) or value["kind"] not in SOURCE_KINDS:
            raise ValueError(f"{at}.kind must be historical-record, institutional-position or independent-reporting")
        source["kind"] = value["kind"]
        if "publishedAt" in value:
            source["publishedAt"] = _date(value["publishedAt"], f"{at}.publishedAt")
        if source["id"] in source_ids:
            raise ValueError(f"{label}.sources IDs must be unique")
        source_ids.add(source["id"])
        guide["sources"].append(source)
    guide["actors"] = []
    for index, value in enumerate(_list(raw["actors"], f"{label}.actors", 1, 20)):
        at = f"{label}.actors[{index}]"
        _keys(value, {"name", "role", "position", "sourceIds"}, at)
        actor = {field: _pair(value[field], f"{at}.{field}", 5000 if field == "position" else 2000)
                 for field in ("name", "role", "position")}
        actor["sourceIds"] = _source_ids(value["sourceIds"], source_ids, f"{at}.sourceIds")
        guide["actors"].append(actor)
    guide["timeline"] = []
    for index, value in enumerate(_list(raw["timeline"], f"{label}.timeline", 1, 60)):
        at = f"{label}.timeline[{index}]"
        _keys(value, {"date", "title", "detail", "sourceIds"}, at)
        event = {"date": _event_date(value["date"], f"{at}.date"), "title": _pair(value["title"], f"{at}.title", 400),
                 "detail": _pair(value["detail"], f"{at}.detail", 6000),
                 "sourceIds": _source_ids(value["sourceIds"], source_ids, f"{at}.sourceIds")}
        if event["date"] > guide["coverageThrough"]:
            raise ValueError(f"{at}.date cannot be later than coverageThrough")
        guide["timeline"].append(event)
    guide["terms"] = []
    for index, value in enumerate(_list(raw["terms"], f"{label}.terms", 1, 30)):
        at = f"{label}.terms[{index}]"
        _keys(value, {"term", "meaning"}, at)
        guide["terms"].append({"term": _pair(value["term"], f"{at}.term", 400),
                               "meaning": _pair(value["meaning"], f"{at}.meaning", 4000)})
    return guide


def _guides(raw, label):
    guides = [validate_guide(value, f"{label}[{index}]")
              for index, value in enumerate(_list(raw, label, 0, MAX_GUIDES))]
    if len({guide["id"] for guide in guides}) != len(guides):
        raise ValueError(f"{label} guide IDs must be unique")
    return guides


def _bundled(root):
    from server.newsroom import load_json
    result = []
    for filename in sorted((root / "config").glob("background-*.json")):
        result.append(validate_guide(load_json(filename, None), filename.name))
    if len({guide["id"] for guide in result}) != len(result):
        raise ValueError("Bundled background guide IDs must be unique")
    return result


def _persisted(root):
    from server.newsroom import load_json
    filename = root / "data/background-guides.json"
    if not filename.exists():
        return None
    stored = load_json(filename, None)
    _keys(stored, {"generatedAt", "collectionGeneratedAt", "guides"}, "saved background library")
    _timestamp(stored["generatedAt"], "saved background library.generatedAt")
    _timestamp(stored["collectionGeneratedAt"], "saved background library.collectionGeneratedAt")
    return {**stored, "guides": _guides(stored["guides"], "saved background library.guides")}


def read_background(root: Path = ROOT, collection_generated_at=None):
    """Read all guides, retaining older research when the news collection changes."""
    from server.newsroom import load_json
    root = Path(root)
    if collection_generated_at is None:
        collection_generated_at = load_json(root / "data/dashboard.json", {}).get("generatedAt")
    guides = {guide["id"]: {**guide, "contentOrigin": "bundled"} for guide in _bundled(root)}
    error = None
    try:
        stored = _persisted(root)
    except (ValueError, OSError, TypeError) as failure:
        # An explicit error keeps corrupted research distinguishable from a
        # successful empty import. The damaged file is never overwritten here.
        stored = None
        error = f"Background library could not be loaded: {failure}"
    if stored:
        guides.update({guide["id"]: {**guide, "contentOrigin": "daily_research"} for guide in stored["guides"]})
    result = {"guides": list(guides.values()), "generatedAt": stored["generatedAt"] if stored else None,
              "collectionGeneratedAt": stored["collectionGeneratedAt"] if stored else None,
              "isStale": bool(collection_generated_at and (not stored or stored["collectionGeneratedAt"] != collection_generated_at)),
              "guideCount": len(guides), "dailyResearchCount": sum(g["contentOrigin"] == "daily_research" for g in guides.values()),
              "categoryCounts": {category: sum(g["category"] == category for g in guides.values()) for category in sorted(CATEGORIES)}}
    if error:
        result["loadError"] = error
    return result


def _factual_content(guide):
    # Improving a heading or a search keyword is useful editorial work, but
    # cannot establish that the underlying historical/political facts were
    # rechecked. Only explanation and evidence participate in this comparison.
    metadata = {"id", "title", "subtitle", "category", "keywords", "reviewedAt", "coverageThrough"}
    return {key: value for key, value in guide.items() if key not in metadata}


def apply_background(payload, root: Path = ROOT):
    """Validate and upsert a complete research batch tied to the current snapshot."""
    from server.newsroom import atomic_json, load_json, storage_lock, utc_now
    root = Path(root)
    _keys(payload, {"collectionGeneratedAt", "guides", "reverified"}, "input", {"collectionGeneratedAt", "guides"})
    if "reverified" in payload and not isinstance(payload["reverified"], bool):
        raise ValueError("input.reverified must be boolean")
    try:
        encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ValueError("Background input must contain valid JSON values") from error
    if len(encoded) > MAX_INPUT_BYTES:
        raise ValueError("Background input exceeds the 4 MiB limit")
    imported = _guides(payload["guides"], "guides")
    _timestamp(payload["collectionGeneratedAt"], "collectionGeneratedAt")
    with storage_lock(root):
        # Read the authoritative saved snapshot within the same lock used by
        # collection, rather than trusting cached UI state or a decorated read.
        snapshot = load_json(root / "data/dashboard.json", {})
        if not snapshot.get("generatedAt") or payload["collectionGeneratedAt"] != snapshot["generatedAt"]:
            raise ValueError("collectionGeneratedAt must match the current dashboard snapshot; read the current snapshot before importing background")
        stored = _persisted(root)  # Corrupt prior content prevents all writes.
        bundled = {guide["id"]: guide for guide in _bundled(root)}
        overlay = {guide["id"]: guide for guide in stored["guides"]} if stored else {}
        effective = {**bundled, **overlay}
        counts = {"appliedCount": len(imported), "addedCount": 0, "updatedCount": 0, "unchangedCount": 0}
        for guide in imported:
            prior = effective.get(guide["id"])
            if prior is None:
                counts["addedCount"] += 1
            elif _factual_content(prior) != _factual_content(guide):
                counts["updatedCount"] += 1
            else:
                counts["unchangedCount"] += 1
                if not payload.get("reverified", False):
                    guide["reviewedAt"] = prior["reviewedAt"]
                    guide["coverageThrough"] = prior["coverageThrough"]
            overlay[guide["id"]] = guide
        if len(overlay) > MAX_GUIDES:
            raise ValueError(f"Saved background library cannot exceed {MAX_GUIDES} guides")
        generated = utc_now()
        saved = {"generatedAt": generated, "collectionGeneratedAt": snapshot["generatedAt"], "guides": list(overlay.values())}
        # Archive exactly the accepted input, including the explicit evidence
        # recheck flag, instead of pretending every retained guide was reviewed.
        # An empty batch records a genuine no-change maintenance pass against
        # this collection while retaining every guide and its factual dates.
        archive_dir = root / "data/background-imports"
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        atomic_json(archive_dir / f"background-{stamp}.json", {**copy.deepcopy(payload), "appliedAt": generated})
        atomic_json(root / "data/background-guides.json", saved)
        for obsolete in sorted(archive_dir.glob("background-*.json"))[:-ARCHIVE_LIMIT]:
            obsolete.unlink()
    # Collection can advance as soon as the write lock is released. Re-read its
    # current identity for the returned status rather than forcing a stale
    # snapshot to look current in the import receipt.
    return {**read_background(root), **counts}
