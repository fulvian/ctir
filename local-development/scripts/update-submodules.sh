#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "🔄 Updating submodules to latest remote revisions..."

# Get list of submodule paths from .gitmodules
SUBS=$(git config -f .gitmodules --get-regexp "submodule\\..*\\.path" | awk '{print $2}')
for S in $SUBS; do
  echo "→ Updating $S"
  if ! git submodule update --remote --recursive "$S"; then
    echo "⚠️  Skipping $S due to fetch error (repo may be private/moved)."
  fi
done

echo "📦 Reinstalling submodule dependencies if needed..."
bash local-development/scripts/install-submodules.sh || true

echo "✅ Submodules updated."
