"""Real feed collection, atomic storage, and validated bilingual enrichment.

The vendored TrendRadar parser provides feed parsing. This module adds network
limits, provenance, persistence and an explicit boundary between publisher
excerpts and independently written Codex analysis.
"""
from __future__ import annotations

import copy
import hashlib
import html
import json
import os
import re
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import fcntl
import requests

from vendor.trendradar.rss_parser import RSSParser

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CATEGORIES = {"us", "world", "economy", "crisis", "sdg", "industry"}
SOURCE_TYPES = {"newsroom", "official", "research", "community"}
MAX_FEED_BYTES = 4 * 1024 * 1024
SOURCE_ITEM_LIMIT = 24
RETENTION_DAYS = 30
STALE_HOURS = 36
FEED_TIMEOUT = (4, 12)
USER_AGENT = "MeridianLocal/1.0 (personal RSS reader; TrendRadar parser)"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def parse_time(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def normalize_time(value: str | None) -> str | None:
    parsed = parse_time(value)
    return parsed.isoformat(timespec="seconds").replace("+00:00", "Z") if parsed else None


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style", "iframe", "noscript"}:
            self.hidden += 1
        if tag.lower() in {"p", "div", "br", "li"}:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "iframe", "noscript"}:
            self.hidden = max(0, self.hidden - 1)
        self.parts.append(" ")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def plain_text(value: str | None, max_length: int = 1400) -> str:
    parser = PlainText()
    parser.feed(html.unescape(str(value or "")))
    return re.sub(r"\s+", " ", "".join(parser.parts)).strip()[:max_length]


def safe_url(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 8192:
        raise ValueError("A valid http(s) URL is required")
    parts = urlsplit(value.strip())
    if parts.scheme not in {"https", "http"} or not parts.hostname or parts.username or parts.password:
        raise ValueError("A valid http(s) URL is required")
    return value.strip()


def canonical_url(value: str) -> str:
    parts = urlsplit(safe_url(value))
    pairs = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid", "mc_cid", "mc_eid"}]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", urlencode(pairs), ""))


def stable_id(url: str) -> str:
    return hashlib.sha256(canonical_url(url).encode()).hexdigest()[:24]


def fingerprint(article: dict) -> str:
    excerpt = article.get("excerpt")
    if article.get("sourceId") == "hacker-news":
        # HN's vote/comment counters are collection metadata, not a changed report.
        excerpt = re.sub(r"\bPoints:\s*\d+\s*#\s*Comments:\s*\d+", "", excerpt or "").strip()
    return hashlib.sha256(json.dumps([article.get("title"), article.get("url"), excerpt], ensure_ascii=False).encode()).hexdigest()


def load_json(path: Path, fallback: Any):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return copy.deepcopy(fallback)


def atomic_json(path: Path, payload: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, filename = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(filename, path)
    finally:
        if os.path.exists(filename):
            os.unlink(filename)


@contextmanager
def storage_lock(root: Path = ROOT):
    folder = root / "data"
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / ".write.lock").open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def load_sources(root: Path = ROOT) -> list[dict]:
    sources = load_json(root / "config/sources.json", {"sources": []})["sources"]
    seen = set()
    for source in sources:
        if source.get("id") in seen or not source.get("id") or not source.get("name"):
            raise ValueError("Source IDs must be unique and every source must have a name")
        seen.add(source["id"])
        if not isinstance(source.get("enabled"), bool):
            raise ValueError(f"enabled must be true or false for {source['id']}")
        if source.get("category") not in CATEGORIES or source.get("type") not in SOURCE_TYPES:
            raise ValueError(f"Invalid category/type for {source['id']}")
        if source.get("region") not in {"us", "world"}:
            raise ValueError(f"Invalid region for {source['id']}")
        if source.get("enabled"):
            safe_url(source.get("url"))
    return sources


DEFAULT_ATTENTION_POLICY = {
    "retentionDays": 30, "keepUntilReadThreshold": 75,
    "maxAgePenalty": 5, "version": 1,
    "description": {
        "en": "Editorial importance drives rank. Age subtracts at most 5 points within the review horizon. Important unread events stay until you mark them read; only an assessed material development reopens them.",
        "zh": "按编辑评估的重要性排序；在复核周期内，时间最多扣5分。重要且未读的事件会保留到你标记已读；只有经过评估的实质性新进展才会重新出现。",
    },
}


def attention_policy(root: Path = ROOT) -> dict:
    policy = {**copy.deepcopy(DEFAULT_ATTENTION_POLICY), **load_json(root / "config/attention-policy.json", {})}
    for key, low, high in (("retentionDays", 30, 90), ("keepUntilReadThreshold", 1, 100), ("maxAgePenalty", 0, 10)):
        if not isinstance(policy.get(key), int) or isinstance(policy[key], bool) or not low <= policy[key] <= high:
            raise ValueError(f"attention policy {key} must be an integer between {low} and {high}")
    return policy


def event_id(event_key: str) -> str:
    return "event-" + hashlib.sha256(event_key.encode()).hexdigest()[:20]


def event_is_read(event: dict, states: dict) -> bool:
    state = states.get(event["eventId"], {})
    return bool(state.get("read") and state.get("updateKey") == event.get("updateKey"))


def attention_view(dashboard: dict, root: Path = ROOT) -> dict:
    policy = attention_policy(root)
    registry = load_json(root / "data/attention.json", {"events": {}})["events"]
    states = load_json(root / "data/read-state.json", {})
    articles = {a["id"]: a for a in dashboard.get("articles", [])}
    now = datetime.now(timezone.utc)
    items = []
    assessed_ids = set()
    for stored in registry.values():
        event = copy.deepcopy(stored)
        assessed_ids.update(event.get("memberArticleIds", []))
        read = event_is_read(event, states)
        primary = articles.get(event["articleId"])
        current = bool(primary and primary.get("analysis") and not primary["analysis"].get("isStale") and fingerprint(primary) == event.get("contentFingerprint"))
        reviewed = parse_time(event.get("reviewedAt")) or now
        horizon = parse_time(event.get("relevanceUntil")) or reviewed
        expired = now > horizon
        held = bool(event.get("keepUntilRead") and not read)
        age_days = max(0, (now - reviewed).total_seconds() / 86400)
        penalty = min(policy["maxAgePenalty"], age_days / max(1, event["horizonDays"]) * policy["maxAgePenalty"])
        priority = round(event["importance"] - penalty, 2)
        state = states.get(event["eventId"], {})
        event.update(isRead=read, readAt=state.get("readAt") if read else None,
                     priority=priority, needsReview=expired or not current, horizonExpired=expired,
                     heldUntilRead=held, active=not expired or held,
                     contentChanged=bool(primary and fingerprint(primary) != event.get("contentFingerprint")))
        snapshot = copy.deepcopy(primary if current else event.get("articleSnapshot"))
        if snapshot:
            snapshot["isRead"] = read
            snapshot["eventId"] = event["eventId"]
            snapshot["isReviewedSnapshot"] = not current
            if snapshot.get("analysis"):
                snapshot["analysis"]["isReviewedSnapshot"] = not current
                snapshot["analysis"]["isStale"] = not current
                snapshot["analysis"]["contentChanged"] = event["contentChanged"]
            if snapshot.get("summaryProvenance"):
                snapshot["summaryProvenance"]["isCurrentSourceVersion"] = current
            event["articleSnapshot"] = snapshot
        for ident in event.get("memberArticleIds", []):
            if ident in articles:
                articles[ident]["isRead"] = read
                articles[ident]["eventId"] = event["eventId"]
                articles[ident]["attention"] = {k: event[k] for k in ("eventId", "importance", "priority", "reason", "keepUntilRead", "horizonDays", "reviewedAt", "relevanceUntil", "needsReview", "isRead", "heldUntilRead", "updateKey")}
        items.append(event)
    for article in articles.values():
        if article["id"] not in assessed_ids:
            article["isRead"] = bool(states.get(article["id"], {}).get("read"))
    items.sort(key=lambda e: (e["priority"], e["importance"], e["reviewedAt"]), reverse=True)
    return {"items": items, "policy": policy,
            "unreadCount": sum(e["active"] and not e["isRead"] for e in items),
            "readCount": sum(e["isRead"] for e in items),
            "pendingAnalysisCount": sum(not a.get("analysis") for a in articles.values()),
            "unassessedCount": sum(a["id"] not in assessed_ids for a in articles.values()),
            "needsReviewCount": sum(e["needsReview"] for e in items)}


def load_schedule(root: Path = ROOT) -> dict:
    """A clone has an intended cadence; private local receipts establish activation."""
    defaults = {"time": "08:00", "timezone": "America/New_York", "status": "not_configured"}
    canonical = load_json(root / "config/schedule.json", {})
    local = load_json(root / "config/schedule.local.json", {})
    if not isinstance(canonical, dict) or not isinstance(local, dict):
        raise ValueError("Schedule configuration must be a JSON object")
    return {**defaults, **canonical, **local}


def default_dashboard(root: Path = ROOT) -> dict:
    return {"generatedAt": None, "lastRefreshAttempt": None, "articles": [], "sources": [], "briefing": None,
            "bookmarks": [], "schedule": load_schedule(root)}


def read_dashboard(root: Path = ROOT) -> dict:
    data = load_json(root / "data/dashboard.json", default_dashboard(root))
    data["bookmarks"] = load_json(root / "data/bookmarks.json", data.get("bookmarks", []))
    data["schedule"] = load_schedule(root)
    now = datetime.now(timezone.utc)
    for source in data.get("sources", []):
        last = parse_time(source.get("lastSuccess"))
        latest = parse_time(source.get("latestItemAt"))
        source["stale"] = bool(source.get("enabled") and (last is None or (now - last).total_seconds() > STALE_HOURS * 3600 or latest and (now - latest).days >= 7))
    translations = load_json(root / "data/summaries.json", {})
    for article in data.get("articles", []):
        last = parse_time(article.get("collectedAt"))
        article["isStale"] = bool(last and (now - last).total_seconds() > STALE_HOURS * 3600)
        current_fingerprint = fingerprint(article)
        if article.get("analysis"):
            article["analysis"]["collectionChanged"] = article["analysis"].get("collectionGeneratedAt") != data.get("generatedAt")
            article["analysis"]["contentChanged"] = article["analysis"].get("contentFingerprint", current_fingerprint) != current_fingerprint
            article["analysis"]["isStale"] = article["analysis"]["contentChanged"]
            if article["analysis"]["isStale"]:
                # Never count a previously generated summary as coverage of a
                # different current report. The attention registry retains the
                # reviewed version separately for held unread events.
                article["outdatedAnalysis"] = article["analysis"]
                article["analysis"] = None
                article["summary"] = None
                article["contentChangedSinceReview"] = True
                if article.get("summaryProvenance"):
                    article["summaryProvenance"]["isCurrentSourceVersion"] = False
        translation = translations.get(article["id"])
        if translation and translation.get("contentFingerprint") == current_fingerprint:
            article.pop("translationPending", None)
            article["translatedSummary"] = translation["summary"]
            if not article.get("analysis"):
                article["summary"] = translation["summary"]
                article["summaryProvenance"] = {**{k: v for k, v in translation.items() if k != "summary"}, "isCurrentSourceVersion": True}
        elif translation:
            article["translationPending"] = True
            article.pop("translatedSummary", None)
        if article.get("analysis") and article.get("summaryProvenance"):
            article["summaryProvenance"]["isCurrentSourceVersion"] = True
        article["translationPending"] = not bool(article.get("summary") and article["summary"].get("en") and article["summary"].get("zh"))
    briefing = data.get("briefing")
    if briefing:
        briefing["isStale"] = briefing.get("collectionGeneratedAt") != data.get("generatedAt")
    enabled = [s for s in data.get("sources", []) if s.get("enabled")]
    generated = parse_time(data.get("generatedAt"))
    data["attention"] = attention_view(data, root)
    queue = load_json(root / "data/analysis-requests.json", {})
    data["analysisQueue"] = {"items": list(queue.values()), "pendingCount": sum(q.get("status") == "pending" for q in queue.values())}
    data["stats"] = {"articleCount": len(data.get("articles", [])), "readyAnalysisCount": sum(bool(a.get("analysis") and not a["analysis"].get("isStale")) for a in data.get("articles", [])),
                     "bilingualSummaryCount": sum(bool(a.get("summary") and a["summary"].get("en") and a["summary"].get("zh")) for a in data.get("articles", [])),
                     "pendingTranslationCount": sum(not (a.get("summary") and a["summary"].get("en") and a["summary"].get("zh")) for a in data.get("articles", [])),
                     "pendingAnalysisCount": data["attention"]["pendingAnalysisCount"],
                     "pendingAnalysisRequests": data["analysisQueue"]["pendingCount"],
                     "attentionEventCount": len(data["attention"]["items"]), "unreadAttentionCount": data["attention"]["unreadCount"],
                     "enabledSources": len(enabled), "successfulSources": sum(s.get("status") == "ok" for s in enabled),
                     "failedSources": sum(s.get("status") == "error" for s in enabled), "staleSources": sum(s.get("stale", False) for s in enabled),
                     "bookmarkCount": len(data["bookmarks"]), "collectionAgeHours": round((now - generated).total_seconds() / 3600, 2) if generated else None}
    return data


def fetch_source(source: dict, collected_at: str) -> tuple[list[dict], dict]:
    started = time.monotonic()
    with requests.get(source["url"], headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/feed+json"},
                      timeout=FEED_TIMEOUT, stream=True) as response:
        response.raise_for_status()
        if response.status_code != 200:
            raise ValueError(f"Feed returned HTTP {response.status_code}; expected a feed body (200)")
        chunks, size = [], 0
        for chunk in response.iter_content(chunk_size=65536):
            size += len(chunk)
            if size > MAX_FEED_BYTES:
                raise ValueError("Feed exceeds 4 MiB size limit")
            if time.monotonic() - started > 25:
                raise ValueError("Feed exceeded 25 second download limit")
            chunks.append(chunk)
        raw = b"".join(chunks)
        encoding = response.encoding or "utf-8"
        # requests assumes Latin-1 for text/xml without a charset. XML and the
        # international sources in this project predominantly declare UTF-8.
        if encoding.lower() == "iso-8859-1":
            declaration = re.match(br"\s*<\?xml[^>]*encoding=['\"]([^'\"]+)", raw)
            encoding = declaration.group(1).decode("ascii") if declaration else "utf-8"
        content = raw.decode(encoding, errors="replace")
        content = re.sub(r"<(script|style|iframe|noscript)\b[^>]*>.*?</\1\s*>", "", content, flags=re.I | re.S)
        if re.match(r"\s*(<!doctype\s+html|<html\b)", content, flags=re.I):
            raise ValueError("Endpoint returned an HTML page rather than an RSS/Atom/JSON feed")
        parsed = RSSParser(max_summary_length=1400).parse(content, source["url"])
        if not parsed:
            raise ValueError("Feed contains no parseable articles; previous cached articles retained")
        articles, seen = [], set()
        for item in parsed:
            try:
                url = canonical_url(item.url)
            except ValueError:
                continue
            ident = stable_id(url)
            if ident in seen:
                continue
            seen.add(ident)
            articles.append({"id": ident, "title": plain_text(item.title, 600), "url": url, "sourceId": source["id"], "sourceName": source["name"],
                             "publishedAt": normalize_time(item.published_at), "collectedAt": collected_at, "category": source["category"], "region": source["region"],
                             "sourceType": source["type"], "excerpt": plain_text(item.summary), "provenance": "source_excerpt", "summary": None, "analysis": None})
            if len(articles) >= SOURCE_ITEM_LIMIT:
                break
        if not articles:
            raise ValueError("Feed contains no articles with usable http(s) links")
        return articles, {"httpStatus": response.status_code, "resolvedFeedUrl": response.url, "durationMs": round((time.monotonic() - started) * 1000)}


def archive_snapshot(root: Path, payload: dict, kind: str, limit: int):
    folder = root / "data" / ("archive" if kind == "collection" else "briefings")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    atomic_json(folder / f"{kind}-{stamp}.json", payload)
    for obsolete in sorted(folder.glob(f"{kind}-*.json"))[:-limit]:
        obsolete.unlink()


def leave_synthetic_demo(dashboard: dict, root: Path) -> dict:
    """A real collection must not carry fictional held events into real news."""
    if dashboard.get("collection", {}).get("kind") != "synthetic_demo":
        return dashboard
    synthetic_ids = {a["id"] for a in dashboard.get("articles", [])}
    registry = load_json(root / "data/attention.json", {"events": {}})
    synthetic_events = {ident for ident, event in registry["events"].items()
                        if synthetic_ids.intersection(event.get("memberArticleIds", []))}
    registry["events"] = {ident: event for ident, event in registry["events"].items() if ident not in synthetic_events}
    atomic_json(root / "data/attention.json", registry)
    for filename, identifiers in (("summaries.json", synthetic_ids), ("analysis-requests.json", synthetic_ids),
                                  ("read-state.json", synthetic_ids | synthetic_events)):
        stored = load_json(root / "data" / filename, {})
        atomic_json(root / "data" / filename, {ident: value for ident, value in stored.items() if ident not in identifiers})
    dashboard["bookmarks"] = [ident for ident in dashboard.get("bookmarks", []) if ident not in synthetic_ids]
    atomic_json(root / "data/bookmarks.json", dashboard["bookmarks"])
    dashboard["articles"] = []
    dashboard["briefing"] = None
    return dashboard


def collect_dashboard(root: Path = ROOT, source_ids: set[str] | None = None, archive: bool = True, fetcher=fetch_source) -> dict:
    sources = load_sources(root)
    if source_ids and not source_ids.issubset({s["id"] for s in sources}):
        raise ValueError("An unknown source ID was requested")
    attempt = utc_now()
    selected = [s for s in sources if s.get("enabled") and (not source_ids or s["id"] in source_ids)]
    if not selected:
        raise ValueError("No enabled sources selected; configure a usable feed URL and enable the source before collection")
    results: dict[str, tuple[list[dict], dict] | Exception] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetcher, source, attempt): source for source in selected}
        for future in as_completed(futures):
            try:
                results[futures[future]["id"]] = future.result()
            except Exception as error:
                results[futures[future]["id"]] = error
    # Read the latest state only after downloading. A bookmark or briefing
    # written while requests are in flight is merged rather than overwritten.
    with storage_lock(root):
        previous = leave_synthetic_demo(read_dashboard(root), root)
        old_status = {s["id"]: s for s in previous.get("sources", [])}
        old_articles = {a["id"]: a for a in previous.get("articles", [])}
        saved_ids = set(previous.get("bookmarks", []))
        events = load_json(root / "data/attention.json", {"events": {}})["events"]
        states = load_json(root / "data/read-state.json", {})
        held_ids = {ident for event in events.values() if event.get("keepUntilRead") and not event_is_read(event, states)
                    for ident in event.get("memberArticleIds", [])}
        requested_ids = {ident for ident, request in load_json(root / "data/analysis-requests.json", {}).items() if request.get("status") == "pending"}
        protected_ids = saved_ids | held_ids | requested_ids
        all_articles: dict[str, dict] = {}
        refreshed_article_ids: set[str] = set()
        status = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=attention_policy(root)["retentionDays"])
        for source in sources:
            source_id = source["id"]
            old = old_status.get(source_id, {})
            meta = {**source, "status": "disabled" if not source.get("enabled") else old.get("status", "pending"), "itemCount": 0,
                    "lastSuccess": old.get("lastSuccess"), "lastAttempt": old.get("lastAttempt"), "error": None, "latestItemAt": old.get("latestItemAt")}
            cached = [a for a in old_articles.values() if a["sourceId"] == source_id or source_id in a.get("relatedSources", [])]
            result = results.get(source_id)
            fetched_ids: set[str] = set()
            if isinstance(result, Exception):
                meta.update(status="error", error=str(result)[:600], lastAttempt=attempt, outcome="cached_after_failure")
                candidates = cached
            elif result is not None:
                fetched, details = result
                meta.update(details, status="ok", lastSuccess=attempt, lastAttempt=attempt, outcome="fetched")
                latest_dates = [a["publishedAt"] for a in fetched if a.get("publishedAt")]
                meta["latestItemAt"] = max(latest_dates) if latest_dates else None
                # Keep recent entries no longer in the feed and their saved
                # analysis. Failed sources retain their cache even when older.
                recent_cached = [a for a in cached if a["id"] in protected_ids or (parse_time(a.get("publishedAt")) or parse_time(a.get("collectedAt")) or cutoff) >= cutoff]
                fetched_ids = {a["id"] for a in fetched}
                candidates = fetched + [a for a in recent_cached if a["id"] not in fetched_ids]
            elif source.get("enabled"):
                candidates = cached
                meta["error"] = old.get("error")
                meta["outcome"] = "not_requested"
            else:
                candidates = [a for a in cached if a["id"] in protected_ids]
                meta["outcome"] = "disabled"
            meta["itemCount"] = len(candidates)
            for article in candidates:
                article = copy.deepcopy(article)
                old_article = old_articles.get(article["id"])
                if old_article and fingerprint(article) == fingerprint(old_article):
                    for field in ("summary", "analysis", "summaryProvenance", "translatedSummary"):
                        if field in old_article:
                            article[field] = copy.deepcopy(old_article[field])
                elif old_article:
                    article["contentChangedSinceReview"] = bool(old_article.get("analysis") or old_article.get("contentChangedSinceReview"))
                article["sourceUnavailable"] = meta["status"] != "ok"
                refreshed = article["id"] in fetched_ids
                if article["id"] in all_articles:
                    existing = all_articles[article["id"]]
                    # A new response beats retained cache for the same URL,
                    # including cache from a healthy feed that dropped an item.
                    # Keep the winner's own fingerprint-based analysis decision:
                    # corrected content must not inherit the cached assessment.
                    winner = article if refreshed and article["id"] not in refreshed_article_ids else existing
                    related_sources = (set(existing.get("relatedSources", [])) | set(article.get("relatedSources", []))
                                       | {existing["sourceId"], article["sourceId"], source_id})
                    related_categories = (set(existing.get("relatedCategories", [existing["category"]]))
                                          | set(article.get("relatedCategories", [article["category"]])) | {source["category"]})
                    winner["relatedSources"] = sorted(related_sources - {winner["sourceId"]})
                    winner["relatedCategories"] = sorted(related_categories)
                    # A humanitarian-specific feed is a more useful category
                    # than UN's general all-news channel for the same URL.
                    if winner["category"] == "sdg" and "crisis" in related_categories:
                        winner["category"] = "crisis"
                    winner["sourceUnavailable"] = existing["sourceUnavailable"] and article["sourceUnavailable"]
                    all_articles[article["id"]] = winner
                else:
                    all_articles[article["id"]] = article
                if refreshed:
                    refreshed_article_ids.add(article["id"])
            status.append(meta)
        # A source removed from configuration should not erase saved reading.
        for ident in protected_ids - all_articles.keys():
            if ident in old_articles:
                retained = copy.deepcopy(old_articles[ident])
                retained["sourceUnavailable"] = True
                all_articles[ident] = retained
        articles = sorted(all_articles.values(), key=lambda a: a.get("publishedAt") or a.get("collectedAt") or "", reverse=True)
        now = utc_now()
        data = {"generatedAt": now, "lastRefreshAttempt": attempt, "articles": articles, "sources": status, "briefing": previous.get("briefing"),
                "bookmarks": previous.get("bookmarks", []), "schedule": previous.get("schedule"),
                "collection": {"kind": "rss", "parser": "TrendRadar", "requestedSources": len(selected), "succeeded": sum(not isinstance(r, Exception) for r in results.values()),
                               "failed": sum(isinstance(r, Exception) for r in results.values()), "finishedAt": now,
                               "note": "Collection timestamps describe this fetch. Article publication timestamps and per-source status describe news freshness."}}
        if data["briefing"]:
            data["briefing"]["isStale"] = True
        atomic_json(root / "data/dashboard.json", data)
        if archive:
            archive_snapshot(root, data, "collection", 30)
    return read_dashboard(root)


def bilingual(value: Any, label: str) -> dict:
    if not isinstance(value, dict) or any(not isinstance(value.get(lang), str) or not value[lang].strip() for lang in ("en", "zh")):
        raise ValueError(f"{label} requires nonempty en and zh text")
    if any(len(value[lang]) > 12000 for lang in ("en", "zh")):
        raise ValueError(f"{label} exceeds text length limit")
    if not re.search(r"[\u3400-\u4dbf\u4e00-\u9fff]", value["zh"]):
        raise ValueError(f"{label}.zh must contain Chinese text; copying English into zh does not complete bilingual coverage")
    allowed_keys(value, {"en", "zh"}, label)
    return {lang: value[lang].strip() for lang in ("en", "zh")}


def allowed_keys(value: dict, keys: set[str], label: str):
    unsupported = set(value) - keys
    if unsupported:
        raise ValueError(f"{label} contains unsupported fields: {', '.join(sorted(unsupported))}")


def evidence(value: Any, article: dict, label: str) -> list[dict]:
    if not isinstance(value, list) or not 1 <= len(value) <= 20:
        raise ValueError(f"{label} requires 1–20 evidence links")
    cleaned = []
    for item in value:
        if not isinstance(item, dict) or not isinstance(item.get("label"), str) or not item["label"].strip():
            raise ValueError(f"{label} evidence requires a label and URL")
        allowed_keys(item, {"label", "url"}, label + ".evidence")
        if len(item["label"]) > 400:
            raise ValueError(f"{label} evidence label exceeds 400 characters")
        cleaned.append({"label": item["label"].strip(), "url": safe_url(item.get("url"))})
    if canonical_url(article["url"]) not in {canonical_url(x["url"]) for x in cleaned}:
        raise ValueError(f"{label} must cite the linked article as evidence")
    return cleaned


def validate_attention(value: Any, label: str, root: Path) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an editorial assessment object")
    allowed_keys(value, {"importance", "reason", "horizonDays", "keepUntilRead", "eventKey", "updateKey"}, label)
    score, horizon = value.get("importance"), value.get("horizonDays")
    if not isinstance(score, int) or isinstance(score, bool) or not 0 <= score <= 100:
        raise ValueError(f"{label}.importance must be an integer from 0 to 100")
    if not isinstance(horizon, int) or isinstance(horizon, bool) or not 1 <= horizon <= 30:
        raise ValueError(f"{label}.horizonDays must be an integer from 1 to 30")
    if not isinstance(value.get("keepUntilRead"), bool):
        raise ValueError(f"{label}.keepUntilRead must be boolean")
    for key in ("eventKey", "updateKey"):
        if not isinstance(value.get(key), str) or not re.fullmatch(r"[a-z0-9][a-z0-9._:/-]{2,199}", value[key]):
            raise ValueError(f"{label}.{key} needs a stable descriptive lowercase key, 3–200 characters")
    return {**value, "reason": bilingual(value.get("reason"), label + ".reason"),
            "keepUntilRead": value["keepUntilRead"] or score >= attention_policy(root)["keepUntilReadThreshold"]}


def update_attention_events(registry: dict, article: dict, assessment: dict, generated: str):
    ident = event_id(assessment["eventKey"])
    prior = registry.get(ident, {})
    changed = bool(prior and prior.get("updateKey") != assessment["updateKey"])
    if changed:
        old = prior.get("articleSnapshot", {})
        same_facts = old.get("summary") == article.get("summary") and old.get("analysis", {}).get("context") == article.get("analysis", {}).get("context")
        old_urls = {canonical_url(link["url"]) for link in old.get("analysis", {}).get("evidence", [])}
        new_urls = {canonical_url(link["url"]) for link in article.get("analysis", {}).get("evidence", [])}
        additional_support = new_urls - old_urls - {canonical_url(article["url"])}
        if same_facts and not additional_support:
            raise ValueError("A changed updateKey requires a sourced material development: unchanged factual summary/context with only a new article URL or engagement counters cannot reopen a read event")
    reviewed = parse_time(generated)
    members = sorted(set(prior.get("memberArticleIds", [])) | {article["id"]})
    primary = article
    if prior and not changed:
        old_snapshot = prior.get("articleSnapshot", {})
        old_date = parse_time(old_snapshot.get("publishedAt")) or parse_time(prior.get("reviewedAt"))
        new_date = parse_time(article.get("publishedAt")) or reviewed
        if old_date and old_date > new_date:
            primary = old_snapshot
    snapshot = copy.deepcopy(primary)
    for field in ("attention", "eventId", "isRead"):
        snapshot.pop(field, None)
    registry[ident] = {**assessment, "eventId": ident, "articleId": primary["id"],
                       "memberArticleIds": members, "firstReviewedAt": prior.get("firstReviewedAt", generated),
                       "reviewedAt": generated, "relevanceUntil": (reviewed + timedelta(days=assessment["horizonDays"])).isoformat().replace("+00:00", "Z"),
                       "contentFingerprint": fingerprint(primary), "materialUpdate": changed,
                       "lastMaterialUpdateAt": generated if changed else prior.get("lastMaterialUpdateAt"),
                       "articleSnapshot": snapshot}


def apply_briefing(payload: dict, root: Path = ROOT) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Briefing input must be a JSON object")
    allowed_keys(payload, {"collectionGeneratedAt", "briefing", "articles"}, "input")
    with storage_lock(root):
        dashboard = read_dashboard(root)
        if not dashboard.get("generatedAt") or payload.get("collectionGeneratedAt") != dashboard["generatedAt"]:
            raise ValueError("collectionGeneratedAt must match the current dashboard snapshot; collect/read the current snapshot before writing analysis")
        articles = {a["id"]: a for a in dashboard.get("articles", [])}
        generated = utc_now()
        raw = payload.get("briefing")
        if not isinstance(raw, dict) or not isinstance(raw.get("items"), list) or not 1 <= len(raw["items"]) <= 12:
            raise ValueError("briefing requires 1–12 evidence-bearing items")
        allowed_keys(raw, {"title", "overview", "items"}, "briefing")
        validated = {"title": bilingual(raw.get("title"), "briefing.title"), "overview": bilingual(raw.get("overview"), "briefing.overview"),
                     "items": [], "generatedAt": generated, "collectionGeneratedAt": dashboard["generatedAt"], "isStale": False, "kind": "codex"}
        seen_items = set()
        for index, item in enumerate(raw["items"]):
            if not isinstance(item, dict) or item.get("articleId") not in articles:
                raise ValueError(f"briefing.items[{index}] refers to an unknown articleId")
            allowed_keys(item, {"articleId", "summary", "whyItMatters", "uncertainty", "watch", "evidence"}, f"briefing.items[{index}]")
            ident = item["articleId"]
            if ident in seen_items:
                raise ValueError("Briefing item articleIds must be unique")
            seen_items.add(ident)
            cleaned = {"articleId": ident}
            for field in ("summary", "whyItMatters", "uncertainty", "watch"):
                cleaned[field] = bilingual(item.get(field), f"briefing.items[{index}].{field}")
            cleaned["evidence"] = evidence(item.get("evidence"), articles[ident], f"briefing.items[{index}]")
            validated["items"].append(cleaned)
        enrichments = payload.get("articles", [])
        if not isinstance(enrichments, list) or len(enrichments) > 100:
            raise ValueError("articles must be an array with at most 100 enrichments")
        seen_articles = set()
        assessed = []
        for index, item in enumerate(enrichments):
            if not isinstance(item, dict) or item.get("articleId") not in articles:
                raise ValueError(f"articles[{index}] refers to an unknown articleId")
            allowed_keys(item, {"articleId", "summary", "analysis", "attention", "reverified"}, f"articles[{index}]")
            ident = item["articleId"]
            if ident in seen_articles:
                raise ValueError("Enrichment articleIds must be unique")
            seen_articles.add(ident)
            analysis = item.get("analysis")
            if not isinstance(analysis, dict):
                raise ValueError(f"articles[{index}].analysis is required")
            allowed_keys(analysis, {"context", "implications", "uncertainty", "watch", "evidence"}, f"articles[{index}].analysis")
            validated_analysis = {field: bilingual(analysis.get(field), f"articles[{index}].analysis.{field}")
                                  for field in ("context", "implications", "uncertainty", "watch")}
            validated_analysis.update(evidence=evidence(analysis.get("evidence"), articles[ident], f"articles[{index}].analysis"),
                                      kind="codex", analyzedAt=generated, collectionGeneratedAt=dashboard["generatedAt"], contentFingerprint=fingerprint(articles[ident]))
            summary = bilingual(item.get("summary"), f"articles[{index}].summary")
            if "reverified" in item and not isinstance(item["reverified"], bool):
                raise ValueError(f"articles[{index}].reverified must be boolean")
            previous_analysis = articles[ident].get("analysis")
            core_fields = ("context", "implications", "uncertainty", "watch", "evidence")
            unchanged = previous_analysis and articles[ident].get("summary") == summary and all(previous_analysis.get(field) == validated_analysis[field] for field in core_fields)
            if unchanged and not item.get("reverified"):
                for field in ("analyzedAt", "collectionGeneratedAt"):
                    validated_analysis[field] = previous_analysis[field]
            articles[ident]["summary"] = summary
            articles[ident]["analysis"] = validated_analysis
            articles[ident]["summaryProvenance"] = {"kind": "codex", "basis": "researched_analysis", "generatedAt": validated_analysis["analyzedAt"], "contentFingerprint": fingerprint(articles[ident])}
            articles[ident].pop("contentChangedSinceReview", None)
            if "attention" in item:
                assessed.append((articles[ident], validate_attention(item["attention"], f"articles[{index}].attention", root)))
        for item in validated["items"]:
            if item["articleId"] not in seen_articles:
                raise ValueError("Every briefing item requires a complete bilingual article analysis overlay in this import")
            if item["summary"] != articles[item["articleId"]]["summary"]:
                raise ValueError("Briefing and article summaries must match exactly in en and zh")
            if item["articleId"] not in {article["id"] for article, _ in assessed}:
                raise ValueError("Every selected briefing item requires an attention assessment so it appears in the ranked dashboard")
        registry = load_json(root / "data/attention.json", {"events": {}})
        event_versions = {}
        for _, assessment in assessed:
            key = assessment["eventKey"]
            version = tuple(assessment[field] for field in ("updateKey", "importance", "horizonDays", "keepUntilRead"))
            if key in event_versions and event_versions[key] != version:
                raise ValueError("Assessments grouped into one event must agree on updateKey, importance, horizonDays and keepUntilRead; mixed historical versions cannot overwrite the current event")
            event_versions[key] = version
        for article, assessment in assessed:
            update_attention_events(registry["events"], article, assessment, generated)
        queue = load_json(root / "data/analysis-requests.json", {})
        for ident in seen_articles:
            if ident in queue and queue[ident].get("status") == "pending":
                queue[ident].update(status="completed", completedAt=generated)
        dashboard["briefing"] = validated
        dashboard.pop("stats", None)
        for field in ("attention", "analysisQueue"):
            dashboard.pop(field, None)
        atomic_json(root / "data/attention.json", registry)
        atomic_json(root / "data/analysis-requests.json", queue)
        atomic_json(root / "data/dashboard.json", dashboard)
        archive_snapshot(root, {**payload, "appliedAt": generated}, "briefing", 60)
    return read_dashboard(root)


def set_bookmark(ident: str, saved: bool, root: Path = ROOT) -> list[str]:
    if not isinstance(ident, str) or not isinstance(saved, bool):
        raise ValueError("Bookmark requires an article id and boolean saved")
    with storage_lock(root):
        dashboard = read_dashboard(root)
        bookmarks = set(dashboard.get("bookmarks", []))
        if saved and ident not in {a["id"] for a in dashboard.get("articles", [])}:
            raise ValueError("Unknown article id")
        if saved:
            bookmarks.add(ident)
        else:
            bookmarks.discard(ident)
        atomic_json(root / "data/bookmarks.json", sorted(bookmarks))
        return sorted(bookmarks)


def apply_summaries(payload: dict, root: Path = ROOT) -> dict:
    """Import translation of publisher text without granting independent analysis."""
    if not isinstance(payload, dict):
        raise ValueError("Summary input must be a JSON object")
    allowed_keys(payload, {"collectionGeneratedAt", "summaries"}, "summary input")
    with storage_lock(root):
        dashboard = read_dashboard(root)
        if not dashboard.get("generatedAt") or payload.get("collectionGeneratedAt") != dashboard["generatedAt"]:
            raise ValueError("collectionGeneratedAt must match the current dashboard snapshot")
        raw = payload.get("summaries")
        if not isinstance(raw, list) or not 1 <= len(raw) <= 1000:
            raise ValueError("summaries requires 1–1000 bilingual summary entries")
        articles = {a["id"]: a for a in dashboard.get("articles", [])}
        stored = load_json(root / "data/summaries.json", {})
        seen = set()
        generated = utc_now()
        for index, item in enumerate(raw):
            if not isinstance(item, dict) or item.get("articleId") not in articles:
                raise ValueError(f"summaries[{index}] refers to an unknown articleId")
            allowed_keys(item, {"articleId", "summary", "basis"}, f"summaries[{index}]")
            ident = item["articleId"]
            if ident in seen:
                raise ValueError("Summary articleIds must be unique")
            seen.add(ident)
            if item.get("basis") not in {"publisher_excerpt", "headline"}:
                raise ValueError("Translation basis must be publisher_excerpt or headline")
            article = articles[ident]
            basis = "publisher_excerpt" if article.get("excerpt", "").strip() and item["basis"] == "publisher_excerpt" else "headline"
            stored[ident] = {"summary": bilingual(item.get("summary"), f"summaries[{index}].summary"),
                             "basis": basis, "kind": "publisher_excerpt_translation" if basis == "publisher_excerpt" else "headline_translation",
                             "generatedAt": generated, "collectionGeneratedAt": dashboard["generatedAt"],
                             "contentFingerprint": fingerprint(article)}
        atomic_json(root / "data/summaries.json", stored)
    return read_dashboard(root)


def set_read(ident: str, read: bool, root: Path = ROOT, update_key: str | None = None) -> dict:
    if not isinstance(ident, str) or not isinstance(read, bool):
        raise ValueError("Read action requires an article/event id and boolean read")
    if update_key is not None and not isinstance(update_key, str):
        raise ValueError("Read action updateKey must be a string when supplied")
    with storage_lock(root):
        dashboard = read_dashboard(root)
        events = load_json(root / "data/attention.json", {"events": {}})["events"]
        event = events.get(ident) or next((e for e in events.values() if ident in e.get("memberArticleIds", [])), None)
        if event:
            if update_key is not None and update_key != event["updateKey"]:
                raise ValueError("This event has a newer material development. Refresh and review it before changing its read status")
            key, update_key = event["eventId"], event["updateKey"]
        elif ident in {a["id"] for a in dashboard.get("articles", [])}:
            key, update_key = ident, None
        else:
            raise ValueError("Unknown article or event id")
        states = load_json(root / "data/read-state.json", {})
        states[key] = {"read": read, "readAt": utc_now() if read else None, "updateKey": update_key}
        atomic_json(root / "data/read-state.json", states)
    result = read_dashboard(root)
    return {"attention": result["attention"], "readStates": states}


def request_analysis(ident: str, root: Path = ROOT) -> dict:
    if not isinstance(ident, str):
        raise ValueError("Analysis request requires an article id")
    with storage_lock(root):
        dashboard = read_dashboard(root)
        article = next((a for a in dashboard.get("articles", []) if a["id"] == ident), None)
        if not article:
            raise ValueError("Unknown article id")
        queue = load_json(root / "data/analysis-requests.json", {})
        if article.get("analysis") and not article["analysis"].get("isStale"):
            queue[ident] = {"articleId": ident, "requestedAt": utc_now(), "status": "completed", "completedAt": article["analysis"]["analyzedAt"]}
        elif ident not in queue or queue[ident].get("status") != "pending":
            queue[ident] = {"articleId": ident, "requestedAt": utc_now(), "status": "pending", "contentFingerprint": fingerprint(article)}
        atomic_json(root / "data/analysis-requests.json", queue)
    return read_dashboard(root)["analysisQueue"]
