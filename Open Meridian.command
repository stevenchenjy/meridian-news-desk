#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ] || [ ! -f dist/index.html ]; then
  echo 'First run: setting up Meridian.'
  bash scripts/setup.sh
fi
.venv/bin/python scripts/launch.py
