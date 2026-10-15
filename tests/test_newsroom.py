"""Integrity checks for real-feed storage and the analysis boundary."""
import copy
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from server.newsroom import apply_briefing, apply_summaries, atomic_json, canonical_url, collect_dashboard, fetch_source, fingerprint, normalize_time, plain_text, read_dashboard, request_analysis, set_bookmark, set_read, stable_id, utc_now


def pair(text):
    return {"en": text, "zh": "中文：" + text}


class NewsroomTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.published_at = utc_now()
        self.sources = [
            {"id": "one", "name": "One", "url": "https://example.com/one.xml", "siteUrl": "https://example.com", "category": "world", "region": "world", "type": "newsroom", "enabled": True},
            {"id": "two", "name": "Two", "url": "https://example.com/two.xml", "siteUrl": "https://example.com", "category": "crisis", "region": "world", "type": "official", "enabled": True},
            {"id": "disabled", "name": "Optional", "url": None, "siteUrl": "https://example.com", "category": "industry", "region": "world", "type": "community", "enabled": False},
        ]
        atomic_json(self.root / "config/sources.json", {"sources": self.sources})

    def tearDown(self):
        self.temp.cleanup()

    def article(self, source, collected, url=None, title="Published headline"):
        url = url or f"https://example.com/{source['id']}/article"
        return {"id": stable_id(url), "title": title, "url": canonical_url(url), "sourceId": source["id"], "sourceName": source["name"], "publishedAt": self.published_at, "collectedAt": collected,
                "category": source["category"], "region": source["region"], "sourceType": source["type"], "excerpt": "Publisher's description.", "provenance": "source_excerpt", "summary": None, "analysis": None}

    def fetch(self, source, collected):
        return [self.article(source, collected)], {"httpStatus": 200}

    def snapshot(self):
        return collect_dashboard(self.root, archive=False, fetcher=self.fetch)

    def overlay(self, dashboard):
        article = dashboard["articles"][0]
        evidence = [{"label": "Original report", "url": article["url"]}]
        return {"collectionGeneratedAt": dashboard["generatedAt"],
                "briefing": {"title": pair("Daily briefing"), "overview": pair("Evidence is limited to publisher excerpts."), "items": [{"articleId": article["id"], "summary": pair("Reported fact"), "whyItMatters": pair("Possible implication"), "uncertainty": pair("Not independently verified"), "watch": pair("Read the next release"), "evidence": evidence}]},
                "articles": [{"articleId": article["id"], "summary": pair("Reported fact"), "attention": self.assessment(), "analysis": {"context": pair("Source context"), "implications": pair("Conditional interpretation"), "uncertainty": pair("Evidence limitation"), "watch": pair("Next indicator"), "evidence": evidence}}]}

    def assessment(self, score=90, event="major-world-event", update="initial-development", horizon=30):
        return {"importance": score, "reason": pair("Broad consequences supported by the linked reporting"), "horizonDays": horizon,
                "keepUntilRead": False, "eventKey": event, "updateKey": update}

    def assessed_overlay(self, dashboard, **kwargs):
        payload = self.overlay(dashboard)
        payload["articles"][0]["attention"] = self.assessment(**kwargs)
        return payload

    def section_note(self, ident):
        return {"title": {"en": "What to watch", "zh": "后续关注"},
                "summary": {"en": "Follow the reported development and the next documented response. The reviewed evidence leaves specific questions unresolved.",
                            "zh": "关注事件进展和下一步正式回应；现有核查证据仍有具体问题尚未解决。"},
                "articleIds": [ident]}

    def test_stable_dedup_ignores_tracking_and_fragments(self):
        self.assertEqual(stable_id("https://example.com/a?x=1&utm_source=rss#here"), stable_id("https://example.com/a?x=1"))
        def shared(source, collected):
            return [self.article(source, collected, "https://example.com/shared")], {"httpStatus": 200}
        dashboard = collect_dashboard(self.root, archive=False, fetcher=shared)
        self.assertEqual(len(dashboard["articles"]), 1)
        self.assertEqual(dashboard["articles"][0]["relatedSources"], ["two"])
        self.assertIsNone(dashboard["articles"][0]["analysis"])
        self.assertIsNone(dashboard["articles"][0]["summary"])

    def test_dates_use_utc_and_invalid_dates_stay_unknown(self):
        self.assertEqual(normalize_time("2026-10-14T08:00:00-04:00"), "2026-10-14T12:00:00Z")
        self.assertEqual(normalize_time("2026-10-14T12:00:00"), "2026-10-14T12:00:00Z")
        self.assertIsNone(normalize_time("not a date"))

    def test_fresh_clone_schedule_is_unconfigured_and_private_override_preserves_activation(self):
        canonical = {"time": "08:00", "timezone": "America/New_York", "status": "not_configured"}
        atomic_json(self.root / "config/schedule.json", canonical)
        # A cached snapshot is not evidence that a schedule exists on a clone.
        atomic_json(self.root / "data/dashboard.json", {"articles": [], "sources": [], "bookmarks": [], "schedule": {"status": "active", "automationId": "old-cached-personal-id"}})
        fresh = read_dashboard(self.root)["schedule"]
        self.assertEqual(fresh, canonical)
        self.assertNotIn("automationId", fresh)
        receipt = {"time": "08:00", "timezone": "America/New_York", "status": "active", "automationId": "local-fixture-automation", "kind": "heartbeat"}
        atomic_json(self.root / "config/schedule.local.json", receipt)
        self.assertEqual(read_dashboard(self.root)["schedule"], receipt)
        self.assertEqual(self.snapshot()["schedule"], receipt)
        self.assertEqual(json.loads((self.root / "config/schedule.json").read_text()), canonical)

    def test_first_real_collection_does_not_retain_fictional_demo_events_or_reading_state(self):
        demo = self.snapshot()
        demo["collection"]["kind"] = "synthetic_demo"
        for article in demo["articles"]:
            article["title"] = "[DEMO] Fictional event for interface illustration"
        atomic_json(self.root / "data/dashboard.json", demo)
        demo = apply_briefing(self.assessed_overlay(read_dashboard(self.root)), self.root)
        fictional_ids = {a["id"] for a in demo["articles"]}
        selected = demo["attention"]["items"][0]
        set_bookmark(selected["articleId"], True, self.root)
        set_read(selected["eventId"], True, self.root, selected["updateKey"])
        raw = next(a for a in demo["articles"] if a["id"] != selected["articleId"])
        request_analysis(raw["id"], self.root)
        apply_summaries({"collectionGeneratedAt": demo["generatedAt"], "summaries": [
            {"articleId": raw["id"], "summary": pair("Fictional demo source text"), "basis": "publisher_excerpt"}]}, self.root)
        def real_feed(source, collected):
            return [self.article(source, collected, f"https://example.com/{source['id']}/real-report")], {"httpStatus": 200}
        live = collect_dashboard(self.root, archive=False, fetcher=real_feed)
        self.assertEqual(live["collection"]["kind"], "rss")
        self.assertTrue(fictional_ids.isdisjoint({a["id"] for a in live["articles"]}))
        self.assertEqual(live["attention"]["items"], [])
        self.assertEqual(live["bookmarks"], [])
        self.assertEqual(live["analysisQueue"]["items"], [])
        self.assertIsNone(live["briefing"])
        self.assertEqual(json.loads((self.root / "data/read-state.json").read_text()), {})
        self.assertEqual(json.loads((self.root / "data/summaries.json").read_text()), {})

    def test_plain_text_hides_script_and_style_content(self):
        value = plain_text('<p>Real <a href="https://example.com">text</a></p><script>bad()</script><style>hidden</style>')
        self.assertEqual(value, "Real text")

    def test_real_trendradar_parser_filters_bad_links_and_duplicate_items(self):
        raw = b'''<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Fixture feed</title>
        <item><title>Published headline</title><link>https://example.com/report?utm_source=rss</link><pubDate>Wed, 14 Oct 2026 08:00:00 -0400</pubDate><description><![CDATA[Actual excerpt<script>bad()</script>]]></description></item>
        <item><title>Duplicate</title><link>https://example.com/report</link></item>
        <item><title>Bad link</title><link>javascript:alert(1)</link></item>
        </channel></rss>'''
        class Response:
            status_code = 200
            url = "https://example.com/one.xml"
            encoding = "utf-8"
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def raise_for_status(self): pass
            def iter_content(self, chunk_size): yield raw
        with patch("server.newsroom.requests.get", return_value=Response()):
            articles, metadata = fetch_source(self.sources[0], utc_now())
        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]["publishedAt"], "2026-10-14T12:00:00Z")
        self.assertEqual(articles[0]["excerpt"], "Actual excerpt")
        self.assertEqual(metadata["httpStatus"], 200)

    def test_failed_feed_retains_articles_and_last_success(self):
        before = self.snapshot()
        def partial(source, collected):
            if source["id"] == "one":
                raise TimeoutError("Fixture network timeout")
            return self.fetch(source, collected)
        after = collect_dashboard(self.root, archive=False, fetcher=partial)
        source = next(s for s in after["sources"] if s["id"] == "one")
        old_source = next(s for s in before["sources"] if s["id"] == "one")
        self.assertEqual(source["status"], "error")
        self.assertEqual(source["lastSuccess"], old_source["lastSuccess"])
        self.assertEqual(source["itemCount"], 1)
        retained = next(a for a in after["articles"] if a["sourceId"] == "one")
        self.assertTrue(retained["sourceUnavailable"])
        self.assertEqual(retained["collectedAt"], next(a for a in before["articles"] if a["sourceId"] == "one")["collectedAt"])
        self.assertEqual(after["stats"]["failedSources"], 1)

    def test_stale_state_depends_on_source_and_collection_dates(self):
        dashboard = self.snapshot()
        old = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        dashboard["generatedAt"] = old
        dashboard["sources"][0]["lastSuccess"] = old
        dashboard["articles"][0]["collectedAt"] = old
        atomic_json(self.root / "data/dashboard.json", dashboard)
        result = read_dashboard(self.root)
        self.assertTrue(result["sources"][0]["stale"])
        self.assertTrue(result["articles"][0]["isStale"])
        self.assertGreaterEqual(result["stats"]["collectionAgeHours"], 48)

    def test_missing_or_unrelated_evidence_rejected_without_mutation(self):
        dashboard = self.snapshot()
        bad = self.overlay(dashboard)
        bad["briefing"]["items"][0]["evidence"] = [{"label": "Unrelated", "url": "https://example.com/unrelated"}]
        with self.assertRaisesRegex(ValueError, "must cite"):
            apply_briefing(bad, self.root)
        self.assertIsNone(read_dashboard(self.root)["briefing"])
        bad = self.overlay(dashboard)
        bad["articles"][0]["analysis"]["evidence"] = []
        with self.assertRaisesRegex(ValueError, "evidence"):
            apply_briefing(bad, self.root)
        self.assertIsNone(read_dashboard(self.root)["briefing"])

    def test_stale_overlay_unknown_ids_and_missing_chinese_rejected(self):
        dashboard = self.snapshot()
        for mutate, expected in [
            (lambda x: x.update(collectionGeneratedAt="2020-01-01T00:00:00Z"), "collectionGeneratedAt"),
            (lambda x: x["briefing"]["items"][0].update(articleId="made-up-id"), "unknown articleId"),
            (lambda x: x["briefing"]["overview"].pop("zh"), "en and zh"),
        ]:
            with self.subTest(expected=expected):
                bad = self.overlay(dashboard)
                mutate(bad)
                with self.assertRaisesRegex(ValueError, expected):
                    apply_briefing(bad, self.root)

    def test_analysis_preservation_and_invalidation_on_content_change(self):
        dashboard = self.snapshot()
        enriched = apply_briefing(self.overlay(dashboard), self.root)
        ident = enriched["briefing"]["items"][0]["articleId"]
        again = self.snapshot()
        self.assertTrue(again["briefing"]["isStale"])
        self.assertEqual(next(a for a in again["articles"] if a["id"] == ident)["analysis"]["kind"], "codex")
        def changed(source, collected):
            return [self.article(source, collected, title="Corrected headline")], {"httpStatus": 200}
        changed_result = collect_dashboard(self.root, archive=False, fetcher=changed)
        self.assertIsNone(next(a for a in changed_result["articles"] if a["id"] == ident)["analysis"])

    def test_refreshed_duplicate_replaces_cached_primary_and_checks_content(self):
        url = "https://example.com/shared-report"
        ident = stable_id(url)
        def shared(source, collected):
            return [self.article(source, collected, url)], {"httpStatus": 200}
        for primary_outcome in ("failed", "article_absent"):
            for corrected in (False, True):
                with self.subTest(primary_outcome=primary_outcome, corrected=corrected):
                    before = collect_dashboard(self.root, archive=False, fetcher=shared)
                    enriched = apply_briefing(self.overlay(before), self.root)
                    original_analysis = next(a for a in enriched["articles"] if a["id"] == ident)["analysis"]
                    title = "Corrected headline" if corrected else "Published headline"
                    excerpt = "Corrected publisher description." if corrected else "Publisher's description."
                    def fallback(source, collected):
                        if source["id"] == "one":
                            if primary_outcome == "failed":
                                raise TimeoutError("Primary feed unavailable")
                            return [self.article(source, collected, "https://example.com/other-report")], {"httpStatus": 200}
                        article = self.article(source, collected, url, title=title)
                        article["excerpt"] = excerpt
                        return [article], {"httpStatus": 200}
                    result = collect_dashboard(self.root, archive=False, fetcher=fallback)
                    article = next(a for a in result["articles"] if a["id"] == ident)
                    self.assertEqual(article["sourceId"], "two")
                    self.assertEqual(article["title"], title)
                    self.assertEqual(article["excerpt"], excerpt)
                    self.assertEqual(article["collectedAt"], result["lastRefreshAttempt"])
                    self.assertFalse(article["sourceUnavailable"])
                    self.assertEqual(article["relatedSources"], ["one"])
                    self.assertEqual(article["relatedCategories"], ["crisis", "world"])
                    if corrected:
                        self.assertIsNone(article["summary"])
                        self.assertIsNone(article["analysis"])
                    else:
                        self.assertEqual(article["summary"], pair("Reported fact"))
                        self.assertEqual(article["analysis"]["analyzedAt"], original_analysis["analyzedAt"])
                        self.assertFalse(article["analysis"]["isStale"])
                        self.assertTrue(article["analysis"]["collectionChanged"])

    def test_bookmark_roundtrip_and_unknown_ids(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        self.assertEqual(set_bookmark(ident, True, self.root), [ident])
        self.assertEqual(read_dashboard(self.root)["bookmarks"], [ident])
        self.snapshot()
        self.assertEqual(read_dashboard(self.root)["bookmarks"], [ident])
        self.assertEqual(set_bookmark(ident, False, self.root), [])
        with self.assertRaisesRegex(ValueError, "Unknown"):
            set_bookmark("fictional", True, self.root)

    def test_old_saved_article_survives_disabled_and_removed_source(self):
        dashboard = self.snapshot()
        article = next(a for a in dashboard["articles"] if a["sourceId"] == "one")
        ident = article["id"]
        set_bookmark(ident, True, self.root)
        article["publishedAt"] = "2000-01-01T00:00:00Z"
        article["collectedAt"] = "2000-01-01T00:00:00Z"
        atomic_json(self.root / "data/dashboard.json", dashboard)
        self.sources[0]["enabled"] = False
        atomic_json(self.root / "config/sources.json", {"sources": self.sources})
        disabled = self.snapshot()
        self.assertIn(ident, {a["id"] for a in disabled["articles"]})
        self.assertTrue(next(a for a in disabled["articles"] if a["id"] == ident)["sourceUnavailable"])
        atomic_json(self.root / "config/sources.json", {"sources": self.sources[1:]})
        removed = self.snapshot()
        self.assertIn(ident, {a["id"] for a in removed["articles"]})
        self.assertEqual(removed["bookmarks"], [ident])

    def test_disabled_collection_and_unsupported_analysis_fields_rejected(self):
        with self.assertRaisesRegex(ValueError, "No enabled sources"):
            collect_dashboard(self.root, {"disabled"}, archive=False, fetcher=self.fetch)
        dashboard = self.snapshot()
        payload = self.overlay(dashboard)
        payload["briefing"]["generatedAt"] = "invented timestamp"
        with self.assertRaisesRegex(ValueError, "unsupported"):
            apply_briefing(payload, self.root)

    def test_selected_briefing_items_require_matching_complete_article_analysis(self):
        dashboard = self.snapshot()
        payload = self.overlay(dashboard)
        payload["articles"] = []
        with self.assertRaisesRegex(ValueError, "Every briefing item"):
            apply_briefing(payload, self.root)
        payload = self.overlay(dashboard)
        payload["articles"][0]["summary"]["zh"] = "不一致的摘要"
        with self.assertRaisesRegex(ValueError, "must match exactly"):
            apply_briefing(payload, self.root)
        self.assertIsNone(read_dashboard(self.root)["briefing"])
        payload = self.overlay(dashboard)
        payload["articles"][0].pop("attention")
        with self.assertRaisesRegex(ValueError, "requires an attention assessment"):
            apply_briefing(payload, self.root)

    def test_legacy_briefing_and_linked_section_notes_preserve_factual_review_dates(self):
        initial = apply_briefing(self.overlay(self.snapshot()), self.root)
        self.assertNotIn("sectionNotes", initial["briefing"])
        ident = initial["briefing"]["items"][0]["articleId"]
        checked_at = next(a for a in initial["articles"] if a["id"] == ident)["analysis"]["analyzedAt"]
        payload = self.overlay(initial)
        payload["briefing"]["sectionNotes"] = {"all": [self.section_note(ident)], "world": [self.section_note(ident)]}
        saved = apply_briefing(payload, self.root)
        self.assertEqual(saved["briefing"]["sectionNotes"], payload["briefing"]["sectionNotes"])
        self.assertEqual(read_dashboard(self.root)["briefing"]["sectionNotes"], payload["briefing"]["sectionNotes"])
        self.assertEqual(next(a for a in saved["articles"] if a["id"] == ident)["analysis"]["analyzedAt"], checked_at)
        self.assertNotEqual(saved["briefing"]["generatedAt"], checked_at)
        latest_archive = sorted((self.root / "data/briefings").glob("briefing-*.json"))[-1]
        self.assertEqual(json.loads(latest_archive.read_text())["briefing"]["sectionNotes"], payload["briefing"]["sectionNotes"])

    def test_section_notes_reject_wrong_topics_unknown_or_raw_ids_and_invalid_bilingual_objects(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        raw_id = dashboard["articles"][1]["id"]
        for section_notes, expected in [
            ({"us": [self.section_note(ident)]}, "outside the us topic"),
            ({"all": [self.section_note("unknown-id")]}, "unknown or unreviewed articleId"),
            ({"crisis": [self.section_note(raw_id)]}, "unknown or unreviewed articleId"),
            ({"world": [{**self.section_note(ident), "summary": {"en": "Chinese is missing"}}]}, "en and zh"),
            ({"world": ["A paragraph without a note object"]}, "must be a note object"),
            ({"world": []}, "requires 1–3"),
            ({"local": [self.section_note(ident)]}, "unsupported fields"),
            ({}, "nonempty object"),
            ([], "nonempty object"),
            ({"world": [{**self.section_note(ident), "articleIds": []}]}, "1–12 reviewed article IDs"),
        ]:
            with self.subTest(section_notes=section_notes):
                payload = self.overlay(dashboard)
                payload["briefing"]["sectionNotes"] = section_notes
                with self.assertRaisesRegex(ValueError, expected):
                    apply_briefing(payload, self.root)
                self.assertIsNone(read_dashboard(self.root)["briefing"])

    def test_section_notes_can_cite_existing_current_review_and_related_topic(self):
        dashboard = self.snapshot()
        world = dashboard["articles"][0]
        world["relatedCategories"] = ["world", "economy"]
        atomic_json(self.root / "data/dashboard.json", dashboard)
        reviewed = apply_briefing(self.overlay(dashboard), self.root)
        crisis = next(a for a in reviewed["articles"] if a["id"] != world["id"])
        reviewed["articles"] = [crisis] + [a for a in reviewed["articles"] if a["id"] != crisis["id"]]
        payload = self.assessed_overlay(reviewed, event="distinct-crisis-event")
        payload["briefing"]["sectionNotes"] = {"economy": [self.section_note(world["id"])], "crisis": [self.section_note(crisis["id"])]}
        saved = apply_briefing(payload, self.root)
        self.assertEqual(saved["briefing"]["sectionNotes"]["economy"][0]["articleIds"], [world["id"]])

    def test_section_note_background_roundtrip_preserves_legacy_and_factual_review_date(self):
        initial = apply_briefing(self.overlay(self.snapshot()), self.root)
        ident = initial["briefing"]["items"][0]["articleId"]
        factual_date = next(a for a in initial["articles"] if a["id"] == ident)["analysis"]["analyzedAt"]
        legacy_note = self.section_note(ident)
        payload = self.overlay(initial)
        payload["briefing"]["sectionNotes"] = {"all": [legacy_note]}
        legacy = apply_briefing(payload, self.root)
        self.assertNotIn("background", legacy["briefing"]["sectionNotes"]["all"][0])
        payload = self.overlay(legacy)
        note = self.section_note(ident)
        note["background"] = {"en": "The reviewed source explains the institutions and earlier decisions that frame this event.",
                              "zh": "已核查的来源解释了相关机构与先前决定，为理解此次事件提供背景。"}
        payload["briefing"]["sectionNotes"] = {"world": [note]}
        saved = apply_briefing(payload, self.root)
        self.assertEqual(saved["briefing"]["sectionNotes"]["world"][0], note)
        self.assertEqual(next(a for a in saved["articles"] if a["id"] == ident)["analysis"]["analyzedAt"], factual_date)
        self.assertEqual(read_dashboard(self.root)["briefing"]["sectionNotes"]["world"][0]["background"], note["background"])
        latest_archive = sorted((self.root / "data/briefings").glob("briefing-*.json"))[-1]
        self.assertEqual(json.loads(latest_archive.read_text())["briefing"]["sectionNotes"]["world"][0]["background"], note["background"])

    def test_section_note_background_requires_complete_concise_bilingual_text_when_supplied(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        for background, expected in (
            (None, "en and zh"),
            ("A background paragraph", "en and zh"),
            ({"en": "English only"}, "en and zh"),
            ({"en": "Context", "zh": "English copied into Chinese"}, "Chinese text"),
            ({"en": "word " * 76, "zh": "背景"}, "concise"),
            ({"en": "x" * 651, "zh": "背景"}, "concise"),
            ({"en": "Context", "zh": "中" * 181}, "concise"),
            ({"en": "First.\n\nSecond.\n\nThird.", "zh": "背景"}, "concise"),
            ({"en": "Context", "zh": "第一段。\n\n第二段。\n\n第三段。"}, "concise"),
        ):
            with self.subTest(background=background):
                payload = self.overlay(dashboard)
                note = self.section_note(ident)
                note["background"] = background
                payload["briefing"]["sectionNotes"] = {"world": [note]}
                with self.assertRaisesRegex(ValueError, expected):
                    apply_briefing(payload, self.root)
                self.assertIsNone(read_dashboard(self.root)["briefing"])

    def test_section_notes_can_cite_retained_reviewed_snapshot_without_relabeling_it_current(self):
        reviewed = apply_briefing(self.overlay(self.snapshot()), self.root)
        old_id = reviewed["briefing"]["items"][0]["articleId"]
        old_date = next(a for a in reviewed["articles"] if a["id"] == old_id)["analysis"]["analyzedAt"]
        reviewed["articles"] = [a for a in reviewed["articles"] if a["id"] != old_id]
        atomic_json(self.root / "data/dashboard.json", reviewed)
        payload = self.assessed_overlay(read_dashboard(self.root), event="distinct-crisis-event")
        payload["briefing"]["sectionNotes"] = {"world": [self.section_note(old_id)]}
        saved = apply_briefing(payload, self.root)
        self.assertNotIn(old_id, {a["id"] for a in saved["articles"]})
        snapshot = next(e["articleSnapshot"] for e in saved["attention"]["items"] if e["articleId"] == old_id)
        self.assertTrue(snapshot["isReviewedSnapshot"])
        self.assertTrue(snapshot["analysis"]["isStale"])
        self.assertEqual(snapshot["analysis"]["analyzedAt"], old_date)
        self.assertEqual(saved["briefing"]["sectionNotes"]["world"][0]["articleIds"], [old_id])

    def test_section_notes_limit_length_words_and_paragraphs_without_restricting_legacy_overview(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        for mutation in (
            lambda note: note["title"].update(en="x" * 121),
            lambda note: note["summary"].update(en="word " * 76),
            lambda note: note["summary"].update(en="x" * 651),
            lambda note: note["summary"].update(zh="中" * 181),
            lambda note: note["summary"].update(en="One paragraph.\n\nAnother paragraph.\n\nA third paragraph."),
            lambda note: note["summary"].update(zh="一段。\n\n第二段。\n\n第三段。"),
        ):
            note = self.section_note(ident)
            mutation(note)
            payload = self.overlay(dashboard)
            payload["briefing"]["sectionNotes"] = {"world": [note]}
            with self.assertRaisesRegex(ValueError, "at most|concise"):
                apply_briefing(payload, self.root)
        legacy = self.overlay(dashboard)
        legacy["briefing"]["overview"] = pair("An existing long overview remains supported. " * 30)
        self.assertTrue(apply_briefing(legacy, self.root)["briefing"])

    def test_bilingual_translations_persist_without_promoting_them_to_analysis(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        translated = apply_summaries({"collectionGeneratedAt": dashboard["generatedAt"], "summaries": [
            {"articleId": ident, "summary": pair("Publisher reports an event"), "basis": "publisher_excerpt"}]}, self.root)
        article = next(a for a in translated["articles"] if a["id"] == ident)
        self.assertIsNone(article["analysis"])
        self.assertEqual(article["summaryProvenance"]["kind"], "publisher_excerpt_translation")
        again = self.snapshot()
        article = next(a for a in again["articles"] if a["id"] == ident)
        self.assertEqual(article["summary"]["zh"], "中文：Publisher reports an event")
        def changed(source, collected):
            return [self.article(source, collected, title="Corrected event")], {"httpStatus": 200}
        newer = collect_dashboard(self.root, archive=False, fetcher=changed)
        article = next(a for a in newer["articles"] if a["id"] == ident)
        self.assertIsNone(article["summary"])
        self.assertTrue(article["translationPending"])

    def test_translation_import_cannot_replace_independent_analysis_and_requires_snapshot(self):
        dashboard = apply_briefing(self.overlay(self.snapshot()), self.root)
        ident = dashboard["briefing"]["items"][0]["articleId"]
        payload = {"collectionGeneratedAt": dashboard["generatedAt"], "summaries": [
            {"articleId": ident, "summary": pair("Translated excerpt"), "basis": "publisher_excerpt"}]}
        result = apply_summaries(payload, self.root)
        article = next(a for a in result["articles"] if a["id"] == ident)
        self.assertEqual(article["summary"], pair("Reported fact"))
        self.assertEqual(article["translatedSummary"], pair("Translated excerpt"))
        self.assertEqual(article["summaryProvenance"]["kind"], "codex")
        payload["collectionGeneratedAt"] = "obsolete"
        with self.assertRaisesRegex(ValueError, "collectionGeneratedAt"):
            apply_summaries(payload, self.root)

    def test_english_copy_in_chinese_field_cannot_claim_bilingual_coverage(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        with self.assertRaisesRegex(ValueError, "must contain Chinese"):
            apply_summaries({"collectionGeneratedAt": dashboard["generatedAt"], "summaries": [
                {"articleId": ident, "summary": {"en": "Reported event", "zh": "Reported event"}, "basis": "publisher_excerpt"}]}, self.root)
        self.assertEqual(read_dashboard(self.root)["stats"]["bilingualSummaryCount"], 0)

    def test_empty_excerpt_is_labeled_headline_translation(self):
        dashboard = self.snapshot()
        dashboard["articles"][0]["excerpt"] = ""
        atomic_json(self.root / "data/dashboard.json", dashboard)
        ident = dashboard["articles"][0]["id"]
        result = apply_summaries({"collectionGeneratedAt": dashboard["generatedAt"], "summaries": [
            {"articleId": ident, "summary": pair("Headline only"), "basis": "publisher_excerpt"}]}, self.root)
        self.assertEqual(next(a for a in result["articles"] if a["id"] == ident)["summaryProvenance"]["kind"], "headline_translation")

    def test_read_state_survives_reload_refresh_and_minor_event_reports(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        event = dashboard["attention"]["items"][0]
        self.assertTrue(event["keepUntilRead"])
        set_read(event["articleId"], True, self.root)
        self.assertTrue(read_dashboard(self.root)["attention"]["items"][0]["isRead"])
        refreshed = self.snapshot()
        self.assertTrue(refreshed["attention"]["items"][0]["isRead"])
        # A different article about the same assessed development does not reopen it.
        second = next(a for a in refreshed["articles"] if a["id"] != event["articleId"])
        refreshed["articles"] = [second] + [a for a in refreshed["articles"] if a["id"] != second["id"]]
        minor = apply_briefing(self.assessed_overlay(refreshed), self.root)
        self.assertTrue(minor["attention"]["items"][0]["isRead"])
        self.assertEqual(minor["attention"]["unreadCount"], 0)
        self.assertEqual(len(minor["attention"]["items"][0]["memberArticleIds"]), 2)

    def test_material_development_reopens_read_event_and_manual_unread_persists(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        event = dashboard["attention"]["items"][0]
        set_read(event["eventId"], True, self.root)
        payload = self.assessed_overlay(read_dashboard(self.root), update="confirmed-material-development")
        payload["articles"][0]["summary"] = pair("A newly confirmed material development is reported")
        payload["briefing"]["items"][0]["summary"] = copy.deepcopy(payload["articles"][0]["summary"])
        changed = apply_briefing(payload, self.root)
        newer = changed["attention"]["items"][0]
        self.assertFalse(newer["isRead"])
        self.assertTrue(newer["materialUpdate"])
        self.assertEqual(newer["eventId"], event["eventId"])
        set_read(newer["eventId"], True, self.root)
        set_read(newer["eventId"], False, self.root)
        self.assertFalse(read_dashboard(self.root)["attention"]["items"][0]["isRead"])

    def test_new_update_key_cannot_reopen_unchanged_or_republished_facts(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        first = dashboard["attention"]["items"][0]
        set_read(first["eventId"], True, self.root)
        payload = self.assessed_overlay(read_dashboard(self.root), update="invented-new-development")
        with self.assertRaisesRegex(ValueError, "sourced material development"):
            apply_briefing(payload, self.root)
        # A different report URL alone is insufficient when factual text is identical.
        other = next(a for a in dashboard["articles"] if a["id"] != first["articleId"])
        dashboard["articles"] = [other] + [a for a in dashboard["articles"] if a["id"] != other["id"]]
        with self.assertRaisesRegex(ValueError, "sourced material development"):
            apply_briefing(self.assessed_overlay(dashboard, update="same-facts-new-url"), self.root)
        current = read_dashboard(self.root)["attention"]["items"][0]
        self.assertTrue(current["isRead"])
        self.assertEqual(current["updateKey"], "initial-development")

    def test_one_import_cannot_mix_current_and_older_event_versions(self):
        dashboard = self.snapshot()
        payload = self.assessed_overlay(dashboard)
        other = next(a for a in dashboard["articles"] if a["id"] != payload["articles"][0]["articleId"])
        second = copy.deepcopy(payload["articles"][0])
        second["articleId"] = other["id"]
        second["analysis"]["evidence"] = [{"label": "Other original report", "url": other["url"]}]
        second["attention"]["updateKey"] = "older-development-key"
        payload["articles"].append(second)
        with self.assertRaisesRegex(ValueError, "must agree on updateKey"):
            apply_briefing(payload, self.root)
        self.assertEqual(read_dashboard(self.root)["attention"]["items"], [])
        self.assertIsNone(read_dashboard(self.root)["briefing"])

    def test_reading_an_older_modal_cannot_mark_unseen_material_update_read(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        first = dashboard["attention"]["items"][0]
        payload = self.assessed_overlay(dashboard, update="confirmed-new-development")
        payload["articles"][0]["summary"] = pair("New material facts arrived while the earlier modal was open")
        payload["briefing"]["items"][0]["summary"] = copy.deepcopy(payload["articles"][0]["summary"])
        changed = apply_briefing(payload, self.root)
        with self.assertRaisesRegex(ValueError, "newer material development"):
            set_read(first["eventId"], True, self.root, first["updateKey"])
        self.assertFalse(read_dashboard(self.root)["attention"]["items"][0]["isRead"])
        current = changed["attention"]["items"][0]
        set_read(current["eventId"], True, self.root, current["updateKey"])
        self.assertTrue(read_dashboard(self.root)["attention"]["items"][0]["isRead"])

    def test_priority_reassessment_preserves_factual_review_time_unless_reverified(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        ident = dashboard["attention"]["items"][0]["articleId"]
        original = next(a for a in dashboard["articles"] if a["id"] == ident)["analysis"]
        refreshed = self.snapshot()
        repeated = apply_briefing(self.assessed_overlay(refreshed, score=91), self.root)
        article = next(a for a in repeated["articles"] if a["id"] == ident)
        self.assertEqual(article["analysis"]["analyzedAt"], original["analyzedAt"])
        self.assertEqual(article["analysis"]["collectionGeneratedAt"], original["collectionGeneratedAt"])
        self.assertNotEqual(repeated["attention"]["items"][0]["reviewedAt"], original["analyzedAt"])
        payload = self.assessed_overlay(repeated)
        payload["articles"][0]["reverified"] = True
        checked = apply_briefing(payload, self.root)
        self.assertNotEqual(next(a for a in checked["articles"] if a["id"] == ident)["analysis"]["analyzedAt"], original["analyzedAt"])

    def test_old_important_unread_event_survives_horizon_retention_and_removed_source(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        event = dashboard["attention"]["items"][0]
        old = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
        for article in dashboard["articles"]:
            if article["id"] == event["articleId"]:
                article["publishedAt"] = old
                article["collectedAt"] = old
        atomic_json(self.root / "data/dashboard.json", dashboard)
        registry = json.loads((self.root / "data/attention.json").read_text())
        stored = registry["events"][event["eventId"]]
        stored["reviewedAt"] = old
        stored["relevanceUntil"] = old
        atomic_json(self.root / "data/attention.json", registry)
        source_id = next(a["sourceId"] for a in dashboard["articles"] if a["id"] == event["articleId"])
        atomic_json(self.root / "config/sources.json", {"sources": [s for s in self.sources if s["id"] != source_id]})
        result = self.snapshot()
        self.assertIn(event["articleId"], {a["id"] for a in result["articles"]})
        held = result["attention"]["items"][0]
        self.assertTrue(held["active"])
        self.assertTrue(held["heldUntilRead"])
        self.assertTrue(held["needsReview"])
        set_read(event["eventId"], True, self.root)
        self.assertFalse(read_dashboard(self.root)["attention"]["items"][0]["active"])

    def test_older_high_importance_outranks_recent_minor_event_and_low_event_expires(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot(), score=90), self.root)
        first = dashboard["attention"]["items"][0]
        registry = json.loads((self.root / "data/attention.json").read_text())
        registry["events"][first["eventId"]]["reviewedAt"] = (datetime.now(timezone.utc) - timedelta(days=29)).isoformat()
        atomic_json(self.root / "data/attention.json", registry)
        other = next(a for a in dashboard["articles"] if a["id"] != first["articleId"])
        dashboard["articles"] = [other] + [a for a in dashboard["articles"] if a["id"] != other["id"]]
        result = apply_briefing(self.assessed_overlay(dashboard, score=45, event="minor-local-event", horizon=1), self.root)
        self.assertEqual(result["attention"]["items"][0]["eventId"], first["eventId"])
        registry = json.loads((self.root / "data/attention.json").read_text())
        minor = next(e for e in registry["events"].values() if e["eventKey"] == "minor-local-event")
        minor["relevanceUntil"] = "2000-01-01T00:00:00Z"
        atomic_json(self.root / "data/attention.json", registry)
        self.assertFalse(next(e for e in read_dashboard(self.root)["attention"]["items"] if e["eventKey"] == "minor-local-event")["active"])

    def test_changed_content_preserves_reviewed_event_snapshot_and_requests_review(self):
        dashboard = apply_briefing(self.assessed_overlay(self.snapshot()), self.root)
        ident = dashboard["attention"]["items"][0]["articleId"]
        def changed(source, collected):
            return [self.article(source, collected, title="Corrected publisher headline")], {"httpStatus": 200}
        result = collect_dashboard(self.root, archive=False, fetcher=changed)
        self.assertIsNone(next(a for a in result["articles"] if a["id"] == ident)["analysis"])
        event = result["attention"]["items"][0]
        self.assertTrue(event["contentChanged"])
        self.assertTrue(event["needsReview"])
        self.assertTrue(event["articleSnapshot"]["analysis"])
        self.assertTrue(event["articleSnapshot"]["analysis"]["isStale"])
        self.assertTrue(event["articleSnapshot"]["analysis"]["isReviewedSnapshot"])
        self.assertFalse(event["articleSnapshot"]["summaryProvenance"]["isCurrentSourceVersion"])
        self.assertEqual(event["articleSnapshot"]["title"], "Published headline")

    def test_dashboard_read_cannot_count_outdated_fingerprint_as_current_bilingual_coverage(self):
        dashboard = apply_briefing(self.overlay(self.snapshot()), self.root)
        ident = dashboard["briefing"]["items"][0]["articleId"]
        article = next(a for a in dashboard["articles"] if a["id"] == ident)
        article["title"] = "A different corrected publisher report"
        atomic_json(self.root / "data/dashboard.json", dashboard)
        read = read_dashboard(self.root)
        current = next(a for a in read["articles"] if a["id"] == ident)
        self.assertIsNone(current["analysis"])
        self.assertIsNone(current["summary"])
        self.assertTrue(current["outdatedAnalysis"]["contentChanged"])
        self.assertEqual(read["stats"]["readyAnalysisCount"], 0)
        self.assertEqual(read["stats"]["bilingualSummaryCount"], 0)
        # A current publisher translation completes reading coverage, while the
        # older researched analysis remains visibly a reviewed snapshot.
        updated = apply_summaries({"collectionGeneratedAt": read["generatedAt"], "summaries": [
            {"articleId": ident, "summary": pair("Translation of the corrected report"), "basis": "publisher_excerpt"}]}, self.root)
        current = next(a for a in updated["articles"] if a["id"] == ident)
        self.assertEqual(updated["stats"]["bilingualSummaryCount"], 1)
        self.assertEqual(updated["stats"]["readyAnalysisCount"], 0)
        self.assertEqual(current["summaryProvenance"]["kind"], "publisher_excerpt_translation")
        self.assertTrue(current["summaryProvenance"]["isCurrentSourceVersion"])
        self.assertTrue(updated["attention"]["items"][0]["articleSnapshot"]["isReviewedSnapshot"])

    def test_analysis_requests_survive_refresh_and_complete_only_with_analysis(self):
        dashboard = self.snapshot()
        ident = dashboard["articles"][0]["id"]
        self.assertEqual(request_analysis(ident, self.root)["pendingCount"], 1)
        self.assertEqual(self.snapshot()["analysisQueue"]["pendingCount"], 1)
        dashboard = apply_briefing(self.overlay(read_dashboard(self.root)), self.root)
        self.assertEqual(dashboard["analysisQueue"]["pendingCount"], 0)
        self.assertEqual(dashboard["analysisQueue"]["items"][0]["status"], "completed")

    def test_due_review_queues_existing_analysis_and_requires_a_fresh_factual_review(self):
        dashboard = apply_briefing(self.overlay(self.snapshot()), self.root)
        event = dashboard["attention"]["items"][0]
        ident = event["articleId"]
        original_review = next(a for a in dashboard["articles"] if a["id"] == ident)["analysis"]["analyzedAt"]
        registry = json.loads((self.root / "data/attention.json").read_text())
        registry["events"][event["eventId"]]["relevanceUntil"] = "2000-01-01T00:00:00Z"
        atomic_json(self.root / "data/attention.json", registry)
        self.assertTrue(read_dashboard(self.root)["attention"]["items"][0]["needsReview"])
        queue = request_analysis(ident, self.root)
        self.assertEqual(queue["pendingCount"], 1)
        self.assertTrue(queue["items"][0]["requiresReverification"])
        requested_at = queue["items"][0]["requestedAt"]
        # Priority reassessment alone can extend the horizon, but does not
        # satisfy the reader's request to review the factual evidence.
        copied = apply_briefing(self.overlay(read_dashboard(self.root)), self.root)
        self.assertFalse(copied["attention"]["items"][0]["needsReview"])
        self.assertEqual(copied["analysisQueue"]["pendingCount"], 1)
        self.assertEqual(next(a for a in copied["articles"] if a["id"] == ident)["analysis"]["analyzedAt"], original_review)
        repeated = request_analysis(ident, self.root)
        self.assertEqual(repeated["pendingCount"], 1)
        self.assertEqual(repeated["items"][0]["requestedAt"], requested_at)
        reverified = self.overlay(read_dashboard(self.root))
        reverified["articles"][0]["reverified"] = True
        checked = apply_briefing(reverified, self.root)
        self.assertEqual(checked["analysisQueue"]["pendingCount"], 0)
        self.assertEqual(checked["analysisQueue"]["items"][0]["status"], "completed")
        self.assertNotEqual(next(a for a in checked["articles"] if a["id"] == ident)["analysis"]["analyzedAt"], original_review)

    def test_existing_current_analysis_without_review_due_keeps_completed_request_behavior(self):
        dashboard = apply_briefing(self.overlay(self.snapshot()), self.root)
        ident = dashboard["briefing"]["items"][0]["articleId"]
        self.assertFalse(dashboard["attention"]["items"][0]["needsReview"])
        queue = request_analysis(ident, self.root)
        self.assertEqual(queue["pendingCount"], 0)
        self.assertEqual(queue["items"][0]["status"], "completed")
        self.assertNotIn("requiresReverification", queue["items"][0])

    def test_community_counter_changes_do_not_invalidate_analysis_fingerprint(self):
        article = self.article(self.sources[0], utc_now())
        article["sourceType"] = "community"
        article["sourceId"] = "hacker-news"
        article["excerpt"] = "Article URL: https://example.com/report Comments URL: https://news.ycombinator.com/item?id=1 Points: 4 # Comments: 0"
        changed = copy.deepcopy(article)
        changed["excerpt"] = changed["excerpt"].replace("Points: 4 # Comments: 0", "Points: 500 # Comments: 20")
        self.assertEqual(fingerprint(article), fingerprint(changed))
        changed["title"] = "Substantive corrected headline"
        self.assertNotEqual(fingerprint(article), fingerprint(changed))
        other = copy.deepcopy(article)
        other["sourceId"] = "other-community"
        corrected = copy.deepcopy(other)
        corrected["excerpt"] = corrected["excerpt"].replace("Points: 4", "Points: 500")
        self.assertNotEqual(fingerprint(other), fingerprint(corrected))

    def test_hacker_news_refresh_preserves_analysis_and_translation_when_only_votes_change(self):
        self.sources[0].update(id="hacker-news", type="community")
        atomic_json(self.root / "config/sources.json", {"sources": self.sources})
        def hn(points):
            def fetch(source, collected):
                article = self.article(source, collected)
                if source["id"] == "hacker-news":
                    article["excerpt"] = f"Article URL: https://example.com/report Comments URL: https://news.ycombinator.com/item?id=1 Points: {points} # Comments: 9"
                return [article], {"httpStatus": 200}
            return fetch
        initial = collect_dashboard(self.root, archive=False, fetcher=hn(71))
        reviewed = apply_briefing(self.assessed_overlay(initial), self.root)
        ident = reviewed["attention"]["items"][0]["articleId"]
        apply_summaries({"collectionGeneratedAt": reviewed["generatedAt"], "summaries": [
            {"articleId": ident, "summary": pair("Article link and discussion metadata"), "basis": "publisher_excerpt"}]}, self.root)
        refreshed = collect_dashboard(self.root, archive=False, fetcher=hn(76))
        article = next(a for a in refreshed["articles"] if a["id"] == ident)
        self.assertEqual(article["summary"], pair("Reported fact"))
        self.assertEqual(article["translatedSummary"], pair("Article link and discussion metadata"))
        self.assertFalse(article["analysis"]["isStale"])
        self.assertFalse(refreshed["attention"]["items"][0]["contentChanged"])


if __name__ == "__main__":
    unittest.main()
