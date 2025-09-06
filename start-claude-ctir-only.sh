#!/bin/bash
# Script per avviare Claude Code SOLO con CTIR (senza API key Anthropic)

echo "🚀 Avvio Claude Code SOLO con CTIR (bypass limite)"
echo "=================================================="

# Rimuovi completamente l'API key di Anthropic
unset ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY=""

# Configura SOLO CTIR come proxy
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"

echo "🔧 Configurazione:"
echo "   • ANTHROPIC_API_KEY: RIMOSSA"
echo "   • ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "   • ANTHROPIC_API_URL: $ANTHROPIC_API_URL"

# Verifica che CTIR sia attivo
echo -e "\n🔍 Verificando CTIR..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ CTIR Server attivo"
else
    echo "❌ CTIR Server non attivo. Avvio CTIR..."
    npx tsx src/index.ts &
    sleep 5
fi

# Mostra stato sistema
echo -e "\n📊 Stato sistema CTIR + CC-Sessions:"
echo "===================================="

# Model Indicator
echo "🎭 Model Indicator:"
curl -s http://localhost:3001/model-indicator | jq -r '.indicator'

# DAIC Mode
echo -e "\n🔄 DAIC Mode:"
bash .claude/hooks/daic 2>/dev/null | grep -o "Discussion Mode\|Implementation Mode"

# Statusline
echo -e "\n📊 Statusline:"
echo '{"workspace":{"current_dir":"'$(pwd)'"},"model":{"display_name":"Claude Sonnet 4"},"session_id":"ctir-session"}' | bash .claude/hooks/statusline-script.sh

echo -e "\n🎯 Avvio Claude Code con SOLO CTIR..."
echo "======================================"
echo "✅ Nessuna API key Anthropic"
echo "✅ Tutte le richieste vanno a CTIR"
echo "✅ Bypass completo del limite 5 ore"
echo "✅ Accesso a tutte le funzionalità cc-sessions"

echo -e "\n🚀 Avvio Claude Code..."
claude
