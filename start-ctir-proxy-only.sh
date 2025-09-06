#!/bin/bash

# 🚀 CTIR + Claude Code - Versione Definitiva
# Forza l'uso del proxy CTIR bypassando i limiti interni

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

# Configurazione per Claude Code
echo "🔐 Configurazione Claude Code..."

# UNSET qualsiasi API key esistente per evitare conflitti
unset ANTHROPIC_API_KEY

# Imposta solo l'URL del proxy
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"

echo "✅ Configurazione completata:"
echo "  - ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "  - ANTHROPIC_API_URL: $ANTHROPIC_API_URL"
echo "  - ANTHROPIC_API_KEY: (unset - usa proxy)"

echo ""
echo "🎯 Avvio Claude Code con proxy CTIR..."
echo "🔗 Proxy: http://localhost:3001"
echo "🎯 Modelli: OpenRouter (gratuiti + premium)"
echo ""

# Avvia Claude Code con configurazione forzata
claude
