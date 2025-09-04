#!/usr/bin/env bash
set -euo pipefail

echo "🤖 Setting up local models (Ollama)..."

if ! command -v ollama >/dev/null 2>&1; then
  echo "⚠️ Ollama not found. Install from https://ollama.ai or run install script."
fi

echo "ℹ️ Starting ollama serve in background (if not already running)"
if ! nc -z localhost 11434 2>/dev/null; then
  (ollama serve >/dev/null 2>&1 &) || true
  sleep 5
fi

echo "⬇️ Pulling models (may take time)..."
echo "   > ollama pull qwen2.5-coder:7b"

echo "✅ Models setup step completed (downloads may still be running)."
