#!/bin/bash

# 🔐 Claude Code Logout Script
# Risolve i conflitti di autenticazione

set -e

echo "🔐 Claude Code Logout Script"
echo "============================"

# Controlla se c'è un token claude.ai attivo
if claude /status 2>/dev/null | grep -q "claude.ai"; then
    echo "⚠️  Token claude.ai attivo rilevato"
    echo "🔄 Logout da claude.ai..."
    
    # Logout automatico da claude.ai
    echo "n" | claude /logout 2>/dev/null || true
    sleep 2
    
    echo "✅ Logout da claude.ai completato"
else
    echo "✅ Nessun token claude.ai attivo"
fi

# Configurazione per CTIR
echo "🔧 Configurazione per CTIR..."
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"
unset ANTHROPIC_API_KEY

echo "✅ Configurazione completata:"
echo "  - ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "  - ANTHROPIC_API_URL: $ANTHROPIC_API_URL"
echo "  - ANTHROPIC_API_KEY: (unset - usa proxy)"

echo ""
echo "🎯 Ora puoi avviare Claude Code con:"
echo "  claude"
