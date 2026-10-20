"""Reading-copy revisions must not become factual reviews or reopen events."""
import copy
import json
import unittest
from unittest.mock import patch

import test_newsroom as fixtures
from server.newsroom import apply_briefing, apply_editorial, atomic_json, collect_dashboard, read_dashboard, set_read, utc_now


class EditorialTests(unittest.TestCase):
    setUp = fixtures.NewsroomTests.setUp
    tearDown = fixtures.NewsroomTests.tearDown
    article = fixtures.NewsroomTests.article
    fetch = fixtures.NewsroomTests.fetch
    snapshot = fixtures.NewsroomTests.snapshot
    overlay = fixtures.NewsroomTests.overlay
    assessment = fixtures.NewsroomTests.assessment
    section_note = fixtures.NewsroomTests.section_note

    def initial(self):
        return apply_briefing(self.overlay(self.snapshot()), self.root)

    def editorial(self, dashboard, **kwargs):
        ident = dashboard["briefing"]["items"][0]["articleId"]
        return {"collectionGeneratedAt": dashboard["generatedAt"], "articles": [{
            "articleId": ident, "headline": {"en": "What the decision changes for households"},
            "readerBrief": {"en": "The reported decision changes one constraint. The reviewed evidence explains who is affected and what remains unresolved."},
            **kwargs,
        }]}

    def stores(self):
        return {path: path.read_bytes() for path in (self.root / "data").glob("*.json")}

    def test_main_import_validates_english_first_copy_and_excludes_it_from_factual_review(self):
        initial = self.initial()
        ident = initial["briefing"]["items"][0]["articleId"]
        original = next(article for article in initial["articles"] if article["id"] == ident)
        payload = self.overlay(initial)
        payload["articles"][0]["analysis"].update(self.editorial(initial)["articles"][0])
        payload["articles"][0]["analysis"].pop("articleId")
        saved = apply_briefing(payload, self.root)
        article = next(article for article in saved["articles"] if article["id"] == ident)
        self.assertEqual(article["analysis"]["headline"]["en"], "What the decision changes for households")
        for field in ("analyzedAt", "collectionGeneratedAt", "contentFingerprint"):
            self.assertEqual(article["analysis"][field], original["analysis"][field])
        self.assertEqual(article["summary"], original["summary"])
        self.assertEqual(article["title"], original["title"])
        self.assertNotIn("headline", saved["briefing"]["items"][0])
        self.assertEqual(saved["attention"]["items"][0]["updateKey"], initial["attention"]["items"][0]["updateKey"])

    def test_copy_survives_refresh_legacy_import_and_explicit_factual_review(self):
        initial = self.initial()
        edited = apply_editorial(self.editorial(initial, headline={"en": "A concrete headline", "zh": "具体标题"}), self.root)
        ident = edited["briefing"]["items"][0]["articleId"]
        expected = next(article for article in edited["articles"] if article["id"] == ident)["analysis"]
        refreshed = self.snapshot()
        for reverified in (False, True):
            payload = self.overlay(refreshed)
            payload["articles"][0]["reverified"] = reverified
            refreshed = apply_briefing(payload, self.root)
            article = next(article for article in refreshed["articles"] if article["id"] == ident)
            for field in ("headline", "readerBrief"):
                self.assertEqual(article["analysis"][field], expected[field])
                self.assertEqual(refreshed["attention"]["items"][0]["articleSnapshot"]["analysis"][field], expected[field])
        replacement = self.overlay(refreshed)
        replacement["articles"][0]["analysis"]["headline"] = {"en": "Replacement English headline"}
        replaced = apply_briefing(replacement, self.root)
        article = next(article for article in replaced["articles"] if article["id"] == ident)
        self.assertEqual(article["analysis"]["headline"], {"en": "Replacement English headline"})

    def test_changed_factual_core_drops_omitted_copy_and_accepts_explicit_new_copy(self):
        for field in ("summary", "context", "implications", "uncertainty", "watch", "evidence"):
            with self.subTest(field=field):
                initial = self.initial()
                edited = apply_editorial(self.editorial(initial), self.root)
                payload = self.overlay(edited)
                if field == "summary":
                    payload["articles"][0]["summary"] = fixtures.pair("A new documented development")
                    payload["briefing"]["items"][0]["summary"] = copy.deepcopy(payload["articles"][0]["summary"])
                elif field == "evidence":
                    payload["articles"][0]["analysis"]["evidence"].append({"label": "New supporting evidence", "url": "https://example.com/new-evidence"})
                else:
                    payload["articles"][0]["analysis"][field] = fixtures.pair("A changed factual analysis")
                saved = apply_briefing(payload, self.root)
                ident = payload["articles"][0]["articleId"]
                article = next(article for article in saved["articles"] if article["id"] == ident)
                self.assertNotIn("headline", article["analysis"])
                self.assertNotIn("readerBrief", article["analysis"])
                payload["articles"][0]["analysis"]["headline"] = {"en": "A headline for the changed facts"}
                rewritten = apply_briefing(payload, self.root)
                article = next(article for article in rewritten["articles"] if article["id"] == ident)
                self.assertEqual(article["analysis"]["headline"], {"en": "A headline for the changed facts"})

    def test_editorial_only_edits_preserve_facts_dates_attention_read_and_queue(self):
        initial = self.initial()
        event = initial["attention"]["items"][0]
        set_read(event["eventId"], True, self.root, update_key=event["updateKey"])
        ident = event["articleId"]
        atomic_json(self.root / "data/analysis-requests.json", {
            ident: {"articleId": ident, "status": "pending", "requiresReverification": True, "requestedAt": utc_now()}})
        before = self.stores()
        original_dashboard = json.loads(before[self.root / "data/dashboard.json"])
        original_registry = json.loads(before[self.root / "data/attention.json"])
        payload = self.editorial(initial)
        payload["briefing"] = {"title": fixtures.pair("A clearer daily question"),
                               "overview": fixtures.pair("A useful supported consequence"),
                               "sectionNotes": {"world": [self.section_note(ident)]}}
        saved = apply_editorial(payload, self.root)
        self.assertTrue(saved["attention"]["items"][0]["isRead"])
        self.assertEqual(saved["analysisQueue"]["pendingCount"], 1)
        after = self.stores()
        for name in ("read-state.json", "analysis-requests.json"):
            self.assertEqual(after[self.root / "data" / name], before[self.root / "data" / name])
        dashboard = json.loads(after[self.root / "data/dashboard.json"])
        registry = json.loads(after[self.root / "data/attention.json"])
        for article in dashboard["articles"]:
            for field in ("headline", "readerBrief"):
                article.get("analysis", {}).pop(field, None) if article.get("analysis") else None
        for stored in registry["events"].values():
            for field in ("headline", "readerBrief"):
                stored["articleSnapshot"]["analysis"].pop(field, None)
        for field in payload["briefing"]:
            dashboard["briefing"].pop(field, None)
            original_dashboard["briefing"].pop(field, None)
        self.assertEqual(dashboard, original_dashboard)
        self.assertEqual(registry, original_registry)
        receipt = next((self.root / "data/briefings").glob("editorial-*.json"))
        self.assertEqual(json.loads(receipt.read_text())["kind"], "editorial")

    def test_corrected_source_only_receives_copy_on_retained_reviewed_snapshot(self):
        initial = self.initial()
        ident = initial["briefing"]["items"][0]["articleId"]
        def corrected(source, collected):
            return [self.article(source, collected, title="Corrected source article")], {"httpStatus": 200}
        changed = collect_dashboard(self.root, archive=False, fetcher=corrected)
        payload = self.editorial(changed)
        saved = apply_editorial(payload, self.root)
        current = next(article for article in saved["articles"] if article["id"] == ident)
        self.assertIsNone(current["analysis"])
        retained = saved["attention"]["items"][0]["articleSnapshot"]
        self.assertEqual(retained["analysis"]["headline"], payload["articles"][0]["headline"])
        self.assertTrue(retained["analysis"]["isReviewedSnapshot"])
        self.assertTrue(retained["analysis"]["isStale"])
        self.assertEqual(retained["title"], "Published headline")
        self.assertEqual(retained["analysis"]["analyzedAt"], initial["attention"]["items"][0]["articleSnapshot"]["analysis"]["analyzedAt"])
        # A removed source still has a retained, explicitly reviewed artifact.
        raw = json.loads((self.root / "data/dashboard.json").read_text())
        raw["articles"] = [article for article in raw["articles"] if article["id"] != ident]
        atomic_json(self.root / "data/dashboard.json", raw)
        payload["articles"][0]["headline"] = {"en": "A retained review remains readable"}
        removed = apply_editorial(payload, self.root)
        self.assertNotIn(ident, {article["id"] for article in removed["articles"]})
        self.assertEqual(removed["attention"]["items"][0]["articleSnapshot"]["analysis"]["headline"], payload["articles"][0]["headline"])

    def test_current_copy_does_not_overwrite_different_retained_factual_analysis(self):
        initial = self.initial()
        registry = json.loads((self.root / "data/attention.json").read_text())
        event = next(iter(registry["events"].values()))
        event["articleSnapshot"]["analysis"]["implications"] = fixtures.pair("An older reviewed interpretation")
        atomic_json(self.root / "data/attention.json", registry)
        saved = apply_editorial(self.editorial(initial), self.root)
        ident = initial["briefing"]["items"][0]["articleId"]
        self.assertIn("headline", next(article for article in saved["articles"] if article["id"] == ident)["analysis"])
        persisted_registry = json.loads((self.root / "data/attention.json").read_text())
        retained = next(iter(persisted_registry["events"].values()))["articleSnapshot"]["analysis"]
        self.assertNotIn("headline", retained)

    def test_main_import_rejects_invalid_editorial_locales_before_storage_changes(self):
        initial = self.initial()
        before = self.stores()
        for field, value in (("headline", {"en": "A headline", "de": "German"}),
                             ("headline", {"en": ""}), ("readerBrief", {"en": "x" * 1601}),
                             ("readerBrief", {"en": "An English brief", "zh": ""})):
            with self.subTest(field=field, value=value):
                payload = self.overlay(initial)
                payload["articles"][0]["analysis"][field] = value
                with self.assertRaises(ValueError):
                    apply_briefing(payload, self.root)
                self.assertEqual(self.stores(), before)

    def test_article_and_briefing_rejections_do_not_write_any_store(self):
        initial = self.initial()
        raw_id = next(article["id"] for article in initial["articles"] if not article.get("analysis"))
        cases = [
            (lambda p: p.update(collectionGeneratedAt="stale"), "current dashboard snapshot"),
            (lambda p: p.update(reverified=True), "unsupported fields"),
            (lambda p: p["articles"].append(copy.deepcopy(p["articles"][0])), "unique"),
            (lambda p: p["articles"][0].update(articleId="unknown-id"), "unknown or unreviewed"),
            (lambda p: p["articles"][0].update(articleId=raw_id), "unknown or unreviewed"),
            (lambda p: p["articles"][0].update(summary=fixtures.pair("New fact")), "unsupported fields"),
            (lambda p: p["articles"][0].update(headline={"zh": "缺少英语"}), "nonempty en"),
            (lambda p: p["articles"][0].update(headline={"en": "English", "fr": "French"}), "unsupported fields"),
            (lambda p: p["articles"][0].update(headline={"en": "English", "zh": "English copied"}), "Chinese text"),
            (lambda p: p["articles"][0].update(headline={"en": "x" * 181}), "180 characters"),
            (lambda p: p["articles"][0].update(headline={"en": "First line\nSecond line"}), "single line"),
            (lambda p: p["articles"][0].update(readerBrief={"en": "word " * 221}), "220 English words"),
            (lambda p: p["articles"][0].update(readerBrief={"en": "one\n\ntwo\n\nthree\n\nfour\n\nfive"}), "4 paragraphs"),
            (lambda p: p.update(briefing={"generatedAt": utc_now()}), "unsupported fields"),
            (lambda p: p.update(briefing={"overview": {"en": "Missing Chinese"}}), "en and zh"),
            (lambda p: p.update(briefing={"sectionNotes": {"all": [self.section_note(raw_id)]}}), "unknown or unreviewed"),
        ]
        before = self.stores()
        for mutate, expected in cases:
            with self.subTest(expected=expected):
                payload = self.editorial(initial)
                mutate(payload)
                with self.assertRaisesRegex(ValueError, expected):
                    apply_editorial(payload, self.root)
                self.assertEqual(self.stores(), before)

    def test_invalid_reviewed_source_evidence_and_fingerprint_cannot_receive_copy(self):
        for corrupt in ("evidence", "fingerprint"):
            with self.subTest(corrupt=corrupt):
                initial = self.initial()
                ident = initial["briefing"]["items"][0]["articleId"]
                dashboard = json.loads((self.root / "data/dashboard.json").read_text())
                article = next(article for article in dashboard["articles"] if article["id"] == ident)
                registry = json.loads((self.root / "data/attention.json").read_text())
                targets = [article, *[event["articleSnapshot"] for event in registry["events"].values()]]
                for target in targets:
                    if corrupt == "evidence":
                        target["analysis"]["evidence"] = [{"label": "Unrelated URL", "url": "https://example.com/unrelated"}]
                    else:
                        target["analysis"]["contentFingerprint"] = "wrong-version"
                atomic_json(self.root / "data/dashboard.json", dashboard)
                atomic_json(self.root / "data/attention.json", registry)
                before = self.stores()
                with self.assertRaisesRegex(ValueError, "unknown or unreviewed"):
                    apply_editorial(self.editorial(initial), self.root)
                self.assertEqual(self.stores(), before)

    def test_broken_briefing_source_reference_rejects_editorial_briefing_edit(self):
        initial = self.initial()
        dashboard = json.loads((self.root / "data/dashboard.json").read_text())
        dashboard["briefing"]["items"][0]["evidence"] = [{"label": "Unrelated", "url": "https://example.com/unrelated"}]
        atomic_json(self.root / "data/dashboard.json", dashboard)
        payload = {"collectionGeneratedAt": initial["generatedAt"], "articles": [], "briefing": {"title": fixtures.pair("A clearer title")}}
        before = self.stores()
        with self.assertRaisesRegex(ValueError, "must cite the linked article"):
            apply_editorial(payload, self.root)
        self.assertEqual(self.stores(), before)

    def test_failed_storage_replacement_rolls_back_both_stores(self):
        initial = self.initial()
        before = self.stores()
        def fail_dashboard(path, payload):
            if path.name == "dashboard.json":
                raise OSError("simulated replacement failure")
            return atomic_json(path, payload)
        with patch("server.newsroom.atomic_json", side_effect=fail_dashboard):
            with self.assertRaisesRegex(OSError, "simulated replacement failure"):
                apply_editorial(self.editorial(initial), self.root)
        self.assertEqual(self.stores(), before)


if __name__ == "__main__":
    unittest.main()
