#!/bin/bash
# Script per avviare Claude Code con proxy CTIR

echo "🚀 Avvio Claude Code con proxy CTIR"
echo "===================================="

# Configura proxy (SDK legge ANTHROPIC_BASE_URL; manteniamo anche ANTHROPIC_API_URL)
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"
export ANTHROPIC_API_KEY="ctir-integration-key"

echo "📊 Stato CTIR:"
curl -s http://localhost:3001/health | jq -r '.status'

echo -e "\n🎭 Model Indicator:"
curl -s http://localhost:3001/model-indicator | jq -r '.indicator'

echo -e "\n🔄 DAIC Mode:"
bash .claude/hooks/daic 2>/dev/null | grep -o "Discussion Mode\|Implementation Mode"

echo -e "\n📊 Statusline:"
echo '{"workspace":{"current_dir":"'$(pwd)'"},"model":{"display_name":"Claude Sonnet 4"},"session_id":"ctir-session"}' | bash .claude/hooks/statusline-script.sh

echo -e "\n🎯 Avvio Claude Code con proxy CTIR..."
echo "Tutte le richieste passeranno attraverso CTIR"
echo "Avrai accesso a tutte le funzionalità cc-sessions"

# Avvia Claude Code
claude
