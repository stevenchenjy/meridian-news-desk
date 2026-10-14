#!/usr/bin/env python3
"""Serve Meridian on loopback, default http://localhost:4310."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.app import serve

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4310)
    args = parser.parse_args()
    serve(port=args.port)
