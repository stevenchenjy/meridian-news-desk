"""Research persistence, evidence integrity, and honest freshness for background."""
import copy
import json
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from server.background import apply_background, read_background, validate_guide
from server.newsroom import atomic_json, read_dashboard


def pair(text):
    return {"en": text, "zh": "中文：" + text}


def guide(ident="trade-policy", category="economy"):
    return {
        "id": ident, "category": category, "title": pair("How trade policy works"),
        "subtitle": pair("Actors, disputes and historical context"), "keywords": ["tariff", "关税"],
        "reviewedAt": "2020-03-02", "coverageThrough": "2020-03-01",
        "overview": pair("This is dated background, not a claim about today's policy."),
        "takeaways": [pair("A tariff is collected at the border."), pair("Economic costs can be shared."),
                       pair("A proposal is distinct from a policy in force.")],
        "actors": [{"name": pair("Government"), "role": pair("Sets policy within legal powers"),
                    "position": pair("Government states its dated rationale."), "sourceIds": ["trade-history"]}],
        "roots": pair("Earlier trade disputes and industrial policy explain the current institutions."),
        "timeline": [{"date": "1994-01-01", "title": pair("An agreement takes effect"),
                      "detail": pair("The historical record establishes this event."), "sourceIds": ["trade-history"]}],
        "terms": [{"term": pair("Tariff"), "meaning": pair("A tax on an imported good.")}],
        "readingLens": [pair("Identify the instrument, authority and effective date.")],
        "sources": [{"id": "trade-history", "title": "Official trade agreement history", "publisher": "Historical archive",
                     "url": "https://example.org/history", "kind": "historical-record"}],
    }


class BackgroundTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.snapshot = "2020-03-03T12:00:00.000001Z"
        atomic_json(self.root / "data/dashboard.json", {"generatedAt": self.snapshot, "articles": [], "sources": []})

    def tearDown(self):
        self.temp.cleanup()

    def payload(self, *guides, **extra):
        return {"collectionGeneratedAt": self.snapshot, "guides": list(guides or [guide()]), **extra}

    def stored(self):
        return json.loads((self.root / "data/background-guides.json").read_text())

    def bytes_on_disk(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file() and path.name != ".write.lock"}

    def test_empty_library_and_dynamic_bundled_discovery(self):
        empty = read_background(self.root)
        self.assertEqual(empty["guides"], [])
        self.assertIsNone(empty["generatedAt"])
        self.assertTrue(empty["isStale"])
        atomic_json(self.root / "config/background-unanticipated-topic.json", guide("food-systems", "development"))
        library = read_background(self.root)
        self.assertEqual(library["guideCount"], 1)
        self.assertEqual(library["categoryCounts"]["development"], 1)
        self.assertEqual(library["guides"][0]["contentOrigin"], "bundled")
        self.assertEqual(library["guides"][0]["reviewedAt"], "2020-03-02")

    def test_runtime_upsert_overrides_bundled_and_preserves_unrelated_guides(self):
        atomic_json(self.root / "config/background-base.json", guide())
        atomic_json(self.root / "config/background-other.json", guide("climate-policy", "development"))
        updated = guide()
        updated["overview"] = pair("Research adds a dated, evidenced explanation.")
        added = guide("semiconductors", "industry")
        first = apply_background(self.payload(updated, added), self.root)
        self.assertEqual((first["addedCount"], first["updatedCount"]), (1, 1))
        self.assertEqual(first["guideCount"], 3)
        self.assertFalse(first["isStale"])
        unrelated_before = next(g for g in first["guides"] if g["id"] == "semiconductors")
        updated["roots"] = pair("A further sourced correction to the same guide.")
        second = apply_background(self.payload(updated), self.root)
        by_id = {g["id"]: g for g in second["guides"]}
        self.assertEqual(by_id["trade-policy"]["overview"], updated["overview"])
        self.assertEqual(by_id["trade-policy"]["contentOrigin"], "daily_research")
        self.assertEqual(by_id["climate-policy"]["contentOrigin"], "bundled")
        self.assertEqual(by_id["semiconductors"], unrelated_before)
        self.assertEqual({g["id"] for g in self.stored()["guides"]}, {"trade-policy", "semiconductors"})

    def test_live_read_sees_new_import_without_rebuild_and_keeps_prior_guides_when_collection_changes(self):
        self.assertEqual(read_background(self.root)["guideCount"], 0)
        applied = apply_background(self.payload(), self.root)
        self.assertEqual(read_background(self.root)["generatedAt"], applied["generatedAt"])
        atomic_json(self.root / "data/dashboard.json", {"generatedAt": "2020-03-04T12:00:00Z", "articles": []})
        changed = read_background(self.root)
        self.assertTrue(changed["isStale"])
        self.assertEqual(changed["guides"], applied["guides"])
        self.assertEqual(changed["collectionGeneratedAt"], self.snapshot)
        self.assertEqual(changed["guides"][0]["reviewedAt"], "2020-03-02")

    def test_dashboard_api_read_includes_dynamic_background_without_changing_collection_identity(self):
        atomic_json(self.root / "config/background-original.json", guide())
        before = read_dashboard(self.root)
        self.assertEqual(before["background"]["guides"][0]["contentOrigin"], "bundled")
        changed = guide()
        changed["overview"] = pair("Current saved research overrides the bootstrap explanation.")
        applied = apply_background(self.payload(changed), self.root)
        dashboard = read_dashboard(self.root)
        self.assertEqual(dashboard["generatedAt"], self.snapshot)
        self.assertEqual(dashboard["background"], {key: value for key, value in applied.items()
                         if key not in {"appliedCount", "addedCount", "updatedCount", "unchangedCount"}})
        self.assertEqual(dashboard["background"]["guides"][0]["overview"], changed["overview"])
        self.assertEqual(dashboard["background"]["guides"][0]["contentOrigin"], "daily_research")

    def test_stale_snapshot_rejected_without_mutation_including_archives(self):
        apply_background(self.payload(), self.root)
        original = self.bytes_on_disk()
        payload = self.payload(guide("new-topic"))
        payload["collectionGeneratedAt"] = "2020-03-01T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "current dashboard snapshot"):
            apply_background(payload, self.root)
        self.assertEqual(self.bytes_on_disk(), original)

    def test_snapshot_is_read_after_shared_lock_is_acquired(self):
        @contextmanager
        def collection_finishes_before_lock(root):
            atomic_json(root / "data/dashboard.json", {"generatedAt": "2020-03-04T00:00:00Z"})
            yield
        with patch("server.newsroom.storage_lock", collection_finishes_before_lock):
            with self.assertRaisesRegex(ValueError, "current dashboard snapshot"):
                apply_background(self.payload(), self.root)
        self.assertFalse((self.root / "data/background-guides.json").exists())
        self.assertFalse((self.root / "data/background-imports").exists())

    def test_import_receipt_reports_if_collection_advances_after_import_lock_releases(self):
        from server.newsroom import storage_lock as shared_lock

        @contextmanager
        def next_collection_finishes_after_import(root):
            with shared_lock(root):
                yield
            atomic_json(root / "data/dashboard.json", {"generatedAt": "2020-03-04T00:00:00Z"})
        with patch("server.newsroom.storage_lock", next_collection_finishes_after_import):
            receipt = apply_background(self.payload(), self.root)
        self.assertEqual(receipt["collectionGeneratedAt"], self.snapshot)
        self.assertTrue(receipt["isStale"])
        self.assertEqual(receipt["guideCount"], 1)

    def test_invalid_inputs_rejected_without_any_research_mutation(self):
        apply_background(self.payload(), self.root)
        original = self.bytes_on_disk()
        invalid = []
        bad = self.payload(); bad["guides"][0]["unknown"] = "x" * 10000; invalid.append(bad)
        bad = self.payload(); bad["guides"][0]["title"] = {"en": "Missing Chinese"}; invalid.append(bad)
        bad = self.payload(); bad["guides"][0]["takeaways"] = [pair("Only one")]; invalid.append(bad)
        bad = self.payload(); bad["guides"][0]["id"] = "Temporary / unstable ID"; invalid.append(bad)
        bad = self.payload(); bad["guides"][0]["category"] = "world"; invalid.append(bad)
        bad = self.payload(); bad["guides"][0]["keywords"] = ["tariff", "TARIFF"]; invalid.append(bad)
        bad = self.payload(); bad["guides"].append(copy.deepcopy(bad["guides"][0])); invalid.append(bad)
        bad = self.payload(); bad["reverified"] = "yes"; invalid.append(bad)
        bad = self.payload(); bad.pop("guides"); invalid.append(bad)
        bad = self.payload(); bad["guides"][0]["roots"]["en"] = "x" * 8001; invalid.append(bad)
        for payload in invalid:
            with self.subTest(payload=repr(payload)[:120]):
                with self.assertRaises(ValueError):
                    apply_background(payload, self.root)
                self.assertEqual(self.bytes_on_disk(), original)

    def test_valid_dates_and_historical_precision_are_distinct_from_review_date(self):
        past = guide()
        past["timeline"][0]["date"] = "1994"
        past["sources"][0]["publishedAt"] = "2020-03-02"
        applied = apply_background(self.payload(past), self.root)
        self.assertEqual(applied["guides"][0]["timeline"][0]["date"], "1994")
        # A retrospective source can be published after the covered event or
        # cutoff. Its publication date never becomes the timeline event date.
        self.assertEqual(applied["guides"][0]["sources"][0]["publishedAt"], "2020-03-02")
        self.assertEqual(applied["guides"][0]["coverageThrough"], "2020-03-01")
        past["timeline"][0]["date"] = "1994-01"
        self.assertEqual(validate_guide(past)["timeline"][0]["date"], "1994-01")
        for field, value in (("reviewedAt", "2020-3-02"), ("reviewedAt", "2999-01-01"),
                             ("coverageThrough", "2020-03-03"), ("coverageThrough", "2020-02-30")):
            bad = guide(); bad[field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate_guide(bad)
        for value in ("2020-03-02", "2999", "2999-01", "1994-13", "1994-1-01", "unknown", "0000"):
            bad = guide(); bad["timeline"][0]["date"] = value
            with self.subTest(date=value), self.assertRaises(ValueError):
                validate_guide(bad)

    def test_evidence_requires_https_typed_sources_and_resolved_actor_and_timeline_references(self):
        for url in ("http://example.org/history", "javascript:alert(1)", "https://u:p@example.org/history", "https://example.org/a b"):
            bad = guide(); bad["sources"][0]["url"] = url
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "HTTPS"):
                validate_guide(bad)
        for kind in ("official", "independent", None, {}):
            bad = guide(); bad["sources"][0]["kind"] = kind
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, "kind"):
                validate_guide(bad)
        for field in ("actors", "timeline"):
            for source_ids in ([], ["unknown-source"], ["trade-history", "trade-history"]):
                bad = guide(); bad[field][0]["sourceIds"] = source_ids
                with self.subTest(field=field, ids=source_ids), self.assertRaises(ValueError):
                    validate_guide(bad)
        bad = guide(); bad["sources"].append(copy.deepcopy(bad["sources"][0]))
        with self.assertRaisesRegex(ValueError, "IDs must be unique"):
            validate_guide(bad)

    def test_noop_copy_cannot_reset_review_or_coverage_dates_but_explicit_recheck_can(self):
        atomic_json(self.root / "config/background-original.json", guide())
        copied = guide()
        copied.update(reviewedAt="2020-04-02", coverageThrough="2020-04-01")
        imported = apply_background(self.payload(copied), self.root)
        self.assertEqual(imported["unchangedCount"], 1)
        self.assertEqual(imported["guides"][0]["reviewedAt"], "2020-03-02")
        self.assertEqual(imported["guides"][0]["coverageThrough"], "2020-03-01")
        again = apply_background(self.payload(copied), self.root)
        self.assertEqual(again["guides"][0]["reviewedAt"], "2020-03-02")
        copied["keywords"].append("trade barriers")
        copied["title"] = pair("Clearer title for the same factual guide")
        metadata_only = apply_background(self.payload(copied), self.root)
        self.assertEqual(metadata_only["guides"][0]["reviewedAt"], "2020-03-02")
        self.assertEqual(metadata_only["guides"][0]["title"], copied["title"])
        rechecked = apply_background(self.payload(copied, reverified=True), self.root)
        self.assertEqual(rechecked["guides"][0]["reviewedAt"], "2020-04-02")
        self.assertEqual(rechecked["guides"][0]["coverageThrough"], "2020-04-01")
        archives = sorted((self.root / "data/background-imports").glob("*.json"))
        self.assertTrue(json.loads(archives[-1].read_text())["reverified"])

    def test_substantive_changed_guide_uses_its_submitted_review_dates(self):
        apply_background(self.payload(), self.root)
        corrected = guide()
        corrected["overview"] = pair("A newly verified correction with supporting source links.")
        corrected.update(reviewedAt="2020-04-02", coverageThrough="2020-04-01")
        result = apply_background(self.payload(corrected), self.root)
        self.assertEqual(result["updatedCount"], 1)
        self.assertEqual(result["guides"][0]["reviewedAt"], "2020-04-02")

    def test_new_daily_import_and_explicit_recheck_do_not_relabel_retained_guides_as_reviewed(self):
        apply_background(self.payload(guide(), guide("other-topic", "industry")), self.root)
        self.snapshot = "2020-04-03T12:00:00Z"
        atomic_json(self.root / "data/dashboard.json", {"generatedAt": self.snapshot, "articles": []})
        checked = guide()
        checked.update(reviewedAt="2020-04-02", coverageThrough="2020-04-01")
        library = apply_background(self.payload(checked, reverified=True), self.root)
        by_id = {item["id"]: item for item in library["guides"]}
        self.assertFalse(library["isStale"])
        self.assertEqual(library["collectionGeneratedAt"], self.snapshot)
        self.assertEqual(by_id["trade-policy"]["reviewedAt"], "2020-04-02")
        self.assertEqual(by_id["other-topic"]["reviewedAt"], "2020-03-02")
        self.assertEqual(by_id["other-topic"]["coverageThrough"], "2020-03-01")

    def test_empty_daily_maintenance_batch_preserves_every_guide_and_factual_date(self):
        atomic_json(self.root / "config/background-original.json", guide())
        initial = apply_background(self.payload(guide("other-topic", "industry")), self.root)
        previous_saved_guides = self.stored()["guides"]
        self.snapshot = "2020-04-03T12:00:00Z"
        atomic_json(self.root / "data/dashboard.json", {"generatedAt": self.snapshot, "articles": []})
        empty = {"collectionGeneratedAt": self.snapshot, "guides": []}
        receipt = apply_background(empty, self.root)
        self.assertEqual(receipt["guides"], initial["guides"])
        self.assertEqual(self.stored()["guides"], previous_saved_guides)
        self.assertEqual(receipt["collectionGeneratedAt"], self.snapshot)
        self.assertNotEqual(receipt["generatedAt"], initial["generatedAt"])
        self.assertFalse(receipt["isStale"])
        for field in ("appliedCount", "addedCount", "updatedCount", "unchangedCount"):
            self.assertEqual(receipt[field], 0)
        latest = sorted((self.root / "data/background-imports").glob("*.json"))[-1]
        archived = json.loads(latest.read_text())
        self.assertEqual(archived["guides"], [])
        self.assertEqual(archived["collectionGeneratedAt"], self.snapshot)

    def test_empty_maintenance_can_record_first_review_of_bundled_library(self):
        atomic_json(self.root / "config/background-original.json", guide())
        original = read_background(self.root)["guides"]
        receipt = apply_background({"collectionGeneratedAt": self.snapshot, "guides": []}, self.root)
        self.assertEqual(receipt["guides"], original)
        self.assertEqual(self.stored()["guides"], [])
        self.assertIsNotNone(receipt["generatedAt"])
        self.assertFalse(receipt["isStale"])
        self.assertEqual(receipt["dailyResearchCount"], 0)

    def test_stale_empty_maintenance_batch_rejected_without_mutation(self):
        apply_background(self.payload(), self.root)
        original = self.bytes_on_disk()
        with self.assertRaisesRegex(ValueError, "current dashboard snapshot"):
            apply_background({"collectionGeneratedAt": "2020-03-01T00:00:00Z", "guides": []}, self.root)
        self.assertEqual(self.bytes_on_disk(), original)

    def test_empty_maintenance_batch_cannot_overwrite_corrupt_persisted_research(self):
        filename = self.root / "data/background-guides.json"
        for broken in ("{bad json", "null", '{"guides": []}'):
            filename.write_text(broken)
            original = self.bytes_on_disk()
            with self.subTest(broken=broken), self.assertRaises(ValueError):
                apply_background({"collectionGeneratedAt": self.snapshot, "guides": []}, self.root)
            self.assertEqual(self.bytes_on_disk(), original)

    def test_invalid_persisted_content_reports_load_error_and_blocks_overwrite(self):
        atomic_json(self.root / "config/background-original.json", guide())
        filename = self.root / "data/background-guides.json"
        for broken in ("{bad json", "null", '{"guides": []}'):
            filename.write_text(broken)
            before = self.bytes_on_disk()
            library = read_background(self.root)
            self.assertIn("loadError", library)
            self.assertEqual(library["guides"][0]["contentOrigin"], "bundled")
            with self.assertRaises(ValueError):
                apply_background(self.payload(), self.root)
            self.assertEqual(self.bytes_on_disk(), before)

    def test_acceptance_archive_is_bounded_and_unrelated_files_are_retained(self):
        folder = self.root / "data/background-imports"
        folder.mkdir()
        for index in range(62):
            (folder / f"background-20000101T000000{index:06d}Z.json").write_text("{}")
        unrelated = folder / "notes.json"
        unrelated.write_text('{"note":"keep"}')
        apply_background(self.payload(), self.root)
        self.assertEqual(len(list(folder.glob("background-*.json"))), 60)
        self.assertEqual(unrelated.read_text(), '{"note":"keep"}')


class BundledBackgroundTests(unittest.TestCase):
    def test_every_actual_bundled_guide_validates_and_ids_are_unique(self):
        # Fixture-only import tests cannot catch an authored guide that would
        # break the actual dashboard's dynamic discovery path.
        root = Path(__file__).resolve().parents[1]
        files = sorted((root / "config").glob("background-*.json"))
        self.assertTrue(files, "The shipped library must contain background guides")
        identifiers = []
        for filename in files:
            with self.subTest(filename=filename.name):
                validated = validate_guide(json.loads(filename.read_text(encoding="utf-8")), filename.name)
                identifiers.append(validated["id"])
        self.assertEqual(len(identifiers), len(set(identifiers)), "Bundled guide IDs must be unique")


if __name__ == "__main__":
    unittest.main()
