#!/bin/bash

# 🚀 CTIR Quick Launcher
# Versione semplificata per avvio rapido

set -e

echo "🚀 CTIR Quick Launcher"
echo "====================="

# Termina processi CTIR esistenti
echo "🔄 Controllo processi CTIR..."
pkill -f "tsx.*src/index.ts" 2>/dev/null || true
sleep 2

# Libera porta 3001
echo "🔄 Liberazione porta 3001..."
lsof -ti :3001 | xargs kill 2>/dev/null || true
sleep 2

# Avvia CTIR in background
echo "🚀 Avvio CTIR..."
nohup npx tsx src/index.ts > ctir.out.log 2> ctir.err.log &

# Aspetta avvio
echo "⏳ Attesa avvio CTIR..."
sleep 8

# Verifica stato
if curl -s http://localhost:3001/health >/dev/null; then
    echo "✅ CTIR attivo!"
else
    echo "❌ CTIR non risponde"
    exit 1
fi

# Configura e avvia Claude Code
echo "🎯 Avvio Claude Code con proxy CTIR..."
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"
export ANTHROPIC_API_KEY="ctir-proxy-token"

echo ""
echo "🔗 Proxy: http://localhost:3001"
echo "🎯 Modelli: OpenRouter (gratuiti + premium)"
echo ""

claude
