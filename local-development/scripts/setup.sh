#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Setting up CTIR development environment..."

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js 18+ required."
  exit 1
fi

MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Current: $(node --version)"
  exit 1
fi

echo "📦 Installing Node.js dependencies (run manually if offline)..."
echo "   > npm install"

echo "🐍 (Optional) Create Python venv for MCP servers"
echo "   > python3 -m venv local-development/venv && source local-development/venv/bin/activate && pip install -r local-development/requirements.txt"

if [ ! -f .env ]; then
  echo "⚙️ Creating .env file from .env.example"
  cp .env.example .env
fi

echo "💾 Build and setup database"
echo "   > npm run build && npm run db:setup"

echo "✅ Setup complete! Use 'npm run dev' to start development."

