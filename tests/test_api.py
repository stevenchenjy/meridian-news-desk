"""Loopback API tests for validation and user-facing static delivery."""
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

import requests

from server.app import Handler
from server.newsroom import atomic_json


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        (cls.root / "dist").mkdir()
        (cls.root / "dist/index.html").write_text("<html><body>World Brief fixture</body></html>")
        atomic_json(cls.root / "data/dashboard.json", {"generatedAt": "2026-10-14T12:00:00Z", "articles": [], "sources": [], "briefing": None, "bookmarks": []})
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.server.workspace_root = cls.root
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def test_health_dashboard_and_spa_serving(self):
        self.assertEqual(requests.get(self.url + "/api/health", timeout=2).json()["status"], "ok")
        self.assertEqual(requests.get(self.url + "/api/dashboard", timeout=2).json()["articles"], [])
        self.assertIn("World Brief fixture", requests.get(self.url + "/briefing", timeout=2).text)
        self.assertEqual(requests.get(self.url + "/missing.js", timeout=2).status_code, 404)
        schedule = requests.get(self.url + "/api/dashboard", timeout=2).json()["schedule"]
        self.assertEqual(schedule["status"], "not_configured")
        self.assertNotIn("automationId", schedule)

    def test_dashboard_uses_private_schedule_override_without_modifying_public_default(self):
        canonical_path = self.root / "config/schedule.json"
        local_path = self.root / "config/schedule.local.json"
        canonical = {"time": "08:00", "timezone": "America/New_York", "status": "not_configured"}
        private = {**canonical, "status": "active", "automationId": "local-fixture-automation", "kind": "heartbeat"}
        try:
            atomic_json(canonical_path, canonical)
            atomic_json(local_path, private)
            schedule = requests.get(self.url + "/api/dashboard", timeout=2).json()["schedule"]
            self.assertEqual(schedule, private)
            self.assertEqual(json.loads(canonical_path.read_text()), canonical)
        finally:
            local_path.unlink(missing_ok=True)
            canonical_path.unlink(missing_ok=True)

    def test_cross_origin_and_rebinding_updates_rejected(self):
        response = requests.post(self.url + "/api/bookmarks", json={"id": "x", "saved": True}, headers={"Origin": "https://example.com"}, timeout=2)
        self.assertEqual(response.status_code, 403)
        response = requests.get(self.url + "/api/dashboard", headers={"Host": "evil.example"}, timeout=2)
        self.assertEqual(response.status_code, 403)

    def test_invalid_json_and_oversized_body_rejected(self):
        response = requests.post(self.url + "/api/bookmarks", data="{", headers={"Content-Type": "application/json"}, timeout=2)
        self.assertEqual(response.status_code, 400)
        response = requests.post(self.url + "/api/bookmarks", data="x" * 65537, headers={"Content-Type": "application/json"}, timeout=2)
        self.assertEqual(response.status_code, 413)
        response = requests.post(self.url + "/api/bookmarks", json={"id": "x", "saved": "yes"}, timeout=2)
        self.assertEqual(response.status_code, 400)

    def test_read_and_analysis_request_routes_persist_and_validate(self):
        path = self.root / "data/dashboard.json"
        original = path.read_text()
        try:
            atomic_json(path, {"generatedAt": "2026-10-14T12:00:00Z", "articles": [{"id": "fixture", "title": "Fixture", "url": "https://example.com/report", "excerpt": "Source report", "analysis": None}], "sources": [], "briefing": None, "bookmarks": []})
            response = requests.post(self.url + "/api/read", json={"id": "fixture", "read": True}, timeout=2)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(requests.get(self.url + "/api/dashboard", timeout=2).json()["articles"][0]["isRead"])
            self.assertTrue(json.loads((self.root / "data/read-state.json").read_text())["fixture"]["read"])
            response = requests.post(self.url + "/api/analysis-requests", json={"id": "fixture"}, timeout=2)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["analysisQueue"]["pendingCount"], 1)
            self.assertEqual(requests.post(self.url + "/api/read", json={"id": "fixture", "read": "yes"}, timeout=2).status_code, 400)
            self.assertEqual(requests.post(self.url + "/api/read", json={"id": "fictional", "read": True}, timeout=2).status_code, 400)
            self.assertEqual(requests.post(self.url + "/api/analysis-requests", json={"id": "fictional"}, timeout=2).status_code, 400)
            self.assertEqual(requests.post(self.url + "/api/read", json={"id": "fixture", "read": False}, headers={"Origin": "https://example.com"}, timeout=2).status_code, 403)
        finally:
            path.write_text(original)


if __name__ == "__main__":
    unittest.main()
