"""Loopback-only HTTP service for the Meridian dashboard."""
from __future__ import annotations

import argparse
import json
import mimetypes
import threading
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from server.newsroom import ROOT, collect_dashboard, read_dashboard, request_analysis, set_bookmark, set_read, utc_now

MAX_BODY = 64 * 1024
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
ACTIVE_JOB: str | None = None


def start_refresh(root: Path = ROOT) -> tuple[dict, bool]:
    global ACTIVE_JOB
    with JOBS_LOCK:
        if ACTIVE_JOB and JOBS.get(ACTIVE_JOB, {}).get("status") in {"queued", "running"}:
            return dict(JOBS[ACTIVE_JOB]), False
        ident = uuid.uuid4().hex
        job = {"jobId": ident, "status": "queued", "startedAt": utc_now(), "finishedAt": None, "error": None}
        JOBS[ident] = job
        ACTIVE_JOB = ident
        for key in list(JOBS)[:-20]:
            if key != ident:
                JOBS.pop(key, None)

    def worker():
        global ACTIVE_JOB
        with JOBS_LOCK:
            job["status"] = "running"
        try:
            dashboard = collect_dashboard(root)
            with JOBS_LOCK:
                job.update(status="completed", finishedAt=utc_now(), generatedAt=dashboard["generatedAt"], stats=dashboard["stats"], collection=dashboard["collection"])
        except Exception as error:
            traceback.print_exc()
            with JOBS_LOCK:
                job.update(status="error", finishedAt=utc_now(), error=str(error)[:600])
        finally:
            with JOBS_LOCK:
                if ACTIVE_JOB == ident:
                    ACTIVE_JOB = None

    threading.Thread(target=worker, name=f"refresh-{ident[:6]}", daemon=True).start()
    return dict(job), True


class Handler(BaseHTTPRequestHandler):
    server_version = "MeridianLocal/1.0"

    @property
    def root(self) -> Path:
        return self.server.workspace_root

    def valid_host(self) -> bool:
        try:
            host = urlsplit("http://" + self.headers.get("Host", "")).hostname
        except ValueError:
            return False
        return host in {"localhost", "127.0.0.1", "::1"}

    def json_response(self, code: int, payload: dict):
        encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if not self.valid_host():
            self.json_response(403, {"error": "Local Host header required"})
            return
        path = urlsplit(self.path).path
        try:
            if path == "/api/health":
                dashboard = read_dashboard(self.root)
                with JOBS_LOCK:
                    active = dict(JOBS[ACTIVE_JOB]) if ACTIVE_JOB else None
                briefing = dashboard.get("briefing")
                self.json_response(200, {"status": "ok", "service": "meridian-local", "generatedAt": dashboard.get("generatedAt"),
                                         "refreshJob": active, "stats": dashboard["stats"], "analysisReady": dashboard["stats"]["readyAnalysisCount"] > 0,
                                         "briefingUpToDate": bool(briefing and not briefing.get("isStale")), "attentionAvailable": bool(dashboard["attention"]["items"]),
                                         "briefingAvailable": bool(briefing), "briefingIsStale": briefing.get("isStale") if briefing else None,
                                         "background": {key: value for key, value in dashboard.get("background", {}).items() if key != "guides"}})
            elif path == "/api/dashboard":
                self.json_response(200, read_dashboard(self.root))
            elif path.startswith("/api/jobs/"):
                with JOBS_LOCK:
                    job = dict(JOBS.get(path.rsplit("/", 1)[-1], {}))
                self.json_response(200 if job else 404, job or {"error": "Job not found; job history is reset when server restarts"})
            elif path.startswith("/api/"):
                self.json_response(404, {"error": "API route not found"})
            else:
                self.static_response(path)
        except (OSError, ValueError, KeyError) as error:
            self.json_response(500, {"error": str(error)[:600]})

    def static_response(self, request_path: str):
        dist = (self.root / "dist").resolve()
        relative = unquote(request_path).lstrip("/") or "index.html"
        requested = (dist / relative).resolve()
        if not requested.is_relative_to(dist):
            self.json_response(403, {"error": "Path outside dashboard assets"})
            return
        target = requested
        if not target.is_file():
            # SPA routes fall back to index; missing assets retain a 404.
            if "." in Path(relative).name:
                self.json_response(404, {"error": "Asset not found"})
                return
            target = dist / "index.html"
        if not target.is_file():
            self.json_response(503, {"error": "Dashboard frontend has not been built. Run npm run build; the API is available."})
            return
        body = target.read_bytes()
        self.send_response(200)
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_header("Content-Type", content_type + ("; charset=utf-8" if content_type.startswith("text/") else ""))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache" if target.name == "index.html" else "public, max-age=3600")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.valid_host():
            self.json_response(403, {"error": "Local Host header required"})
            return
        origin = self.headers.get("Origin")
        permitted = {f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (self.server.server_port, 5173, 4173)}
        if origin and origin not in permitted or self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.json_response(403, {"error": "Cross-origin updates are not allowed"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.json_response(400, {"error": "Invalid Content-Length"})
            return
        if length < 0 or length > MAX_BODY:
            self.json_response(413, {"error": "Request body must be at most 64 KiB"})
            return
        if length and self.headers.get("Content-Type", "").split(";", 1)[0] != "application/json":
            self.json_response(415, {"error": "Use application/json"})
            return
        try:
            payload = json.loads(self.rfile.read(length)) if length else {}
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object")
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.json_response(400, {"error": str(error)[:300]})
            return
        path = urlsplit(self.path).path
        try:
            if path == "/api/refresh":
                job, created = start_refresh(self.root)
                self.json_response(202, {**job, "alreadyRunning": not created})
            elif path == "/api/bookmarks":
                bookmarks = set_bookmark(payload.get("id"), payload.get("saved"), self.root)
                self.json_response(200, {"bookmarks": bookmarks})
            elif path == "/api/read":
                self.json_response(200, set_read(payload.get("id"), payload.get("read"), self.root, payload.get("updateKey")))
            elif path == "/api/analysis-requests":
                self.json_response(200, {"analysisQueue": request_analysis(payload.get("id"), self.root)})
            else:
                self.json_response(404, {"error": "API route not found"})
        except ValueError as error:
            self.json_response(400, {"error": str(error)[:600]})
        except OSError as error:
            self.json_response(500, {"error": str(error)[:600]})


def serve(root: Path = ROOT, port: int = 4310):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    server.workspace_root = root
    print(f"Meridian running at http://localhost:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve local dashboard and API")
    parser.add_argument("--port", type=int, default=4310)
    args = parser.parse_args()
    serve(port=args.port)
