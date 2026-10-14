#!/usr/bin/env python3
"""Open the local dashboard, starting the loopback service when needed."""
import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "http://localhost:4310"

def ready():
    try:
        with urllib.request.urlopen(URL + "/api/health", timeout=2) as response:
            return json.load(response).get("service") == "meridian-local"
    except (OSError, ValueError, urllib.error.URLError):
        return False

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-open", action="store_true", help="Start/check the service without opening a browser")
    args = parser.parse_args()
    if not (ROOT / "dist/index.html").exists():
        print("Dashboard build missing. Run npm run build first.", file=sys.stderr)
        return 1
    if not ready():
        (ROOT / "data").mkdir(exist_ok=True)
        with (ROOT / "data/server.log").open("a") as log:
            process = subprocess.Popen([sys.executable, "-m", "server.app"], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
        for _ in range(30):
            if ready():
                break
            if process.poll() is not None:
                print("Could not start Meridian. Check data/server.log and whether port 4310 is in use.", file=sys.stderr)
                return 1
            time.sleep(0.2)
        else:
            print("Server readiness not confirmed. Check data/server.log.", file=sys.stderr)
            return 1
    print("Meridian is running at " + URL)
    if not args.no_open:
        webbrowser.open(URL)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
