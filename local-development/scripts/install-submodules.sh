#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "🔗 Initializing/updating git submodules..."
git submodule update --init --recursive

echo "📦 Installing dependencies in submodules..."

install_with_pm() {
  local dir="$1";
  local name="$2";
  pushd "$dir" >/dev/null

  if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
    echo "➡️  [$name] Using pnpm"
    pnpm install
  elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
    echo "➡️  [$name] Using yarn"
    yarn install
  elif [ -f package.json ]; then
    echo "➡️  [$name] Using npm"
    npm install
  else
    echo "ℹ️  [$name] No package manager file found, skipping"
  fi

  popd >/dev/null
}

# cc-sessions
if [ -d submodules/cc-sessions ]; then
  install_with_pm submodules/cc-sessions cc-sessions
else
  echo "⚠️ submodules/cc-sessions not found"
fi

# claude-code-router
if [ -d submodules/claude-code-router ]; then
  install_with_pm submodules/claude-code-router claude-code-router
else
  echo "⚠️ submodules/claude-code-router not found"
fi

# Note: local-llm-mcp submodule has been replaced by internal ctir-ollama-mcp

echo "✅ Submodules installation complete."

echo "📦 Installing CTIR MCP (ctir-ollama-mcp)..."
npm --prefix mcp/ctir-ollama-mcp install || true
npm --prefix mcp/ctir-ollama-mcp run build || true

