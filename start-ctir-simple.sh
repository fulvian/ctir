#!/bin/bash

# 🚀 CTIR + Claude Code - Versione Semplificata
# Gestisce automaticamente logout da claude.ai

set -e

echo "🚀 CTIR + Claude Code Launcher"
echo "==============================="

# Termina processi CTIR esistenti
echo "🔄 Pulizia processi CTIR..."
pkill -f "tsx.*src/index.ts" 2>/dev/null || true
sleep 2

# Libera porta 3001
echo "🔄 Liberazione porta 3001..."
lsof -ti :3001 | xargs kill 2>/dev/null || true
sleep 2

# Avvia CTIR
echo "🚀 Avvio CTIR..."
nohup npx tsx src/index.ts > ctir.out.log 2> ctir.err.log &
sleep 8

# Verifica CTIR
if curl -s http://localhost:3001/health >/dev/null; then
    echo "✅ CTIR attivo!"
else
    echo "❌ CTIR non risponde"
    exit 1
fi

# Gestione autenticazione Claude Code
echo "🔐 Gestione autenticazione..."

# Logout da claude.ai se necessario
if claude /status 2>/dev/null | grep -q "claude.ai"; then
    echo "⚠️  Logout da claude.ai..."
    echo "n" | claude /logout 2>/dev/null || true
    sleep 2
    echo "✅ Logout completato"
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
