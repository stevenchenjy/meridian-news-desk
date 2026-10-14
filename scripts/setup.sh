#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
skip_collect=false
for argument in "$@"; do
  case "$argument" in
    --skip-collect) skip_collect=true ;;
    --help|-h)
      echo 'Usage: bash scripts/setup.sh [--skip-collect]'
      echo 'Install dependencies and build. --skip-collect skips publisher feed requests.'
      exit 0 ;;
    *) echo "Unknown setup argument: $argument" >&2; exit 1 ;;
  esac
done
for executable in python3 node npm; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    echo "Missing $executable. Install Python 3.10+ and Node.js 20+ before setup." >&2
    exit 1
  fi
done
python3 - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit('Meridian needs Python 3.10+; make a supported python3 available on PATH.')
if sys.platform == 'win32':
    raise SystemExit('On Windows, run Meridian inside WSL; native Windows file locking is unsupported.')
PY
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Meridian needs Node.js 20+."); process.exit(1); }'
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
npm run build
if [ "$skip_collect" = false ]; then
  .venv/bin/python scripts/collect.py
else
  echo 'Build complete. Feed collection was skipped; use the synthetic demo or npm run collect.'
fi
