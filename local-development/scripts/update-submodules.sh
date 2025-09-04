#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "🔄 Updating submodules to latest remote revisions..."
git submodule update --remote --recursive

echo "📦 Reinstalling submodule dependencies if needed..."
bash local-development/scripts/install-submodules.sh

echo "✅ Submodules updated."

