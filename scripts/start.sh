#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x .venv/bin/python ]; then
  echo 'Run npm run setup first.'
  exit 1
fi
if [ ! -f dist/index.html ]; then npm run build; fi
exec .venv/bin/python -m server.app
