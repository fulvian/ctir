#!/bin/bash
# Script per configurare Claude Code con proxy CTIR

echo "🔧 Configurazione Claude Code per CTIR Proxy"
echo "============================================="

# Verifica che CTIR sia attivo
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ CTIR Server non attivo. Avvio CTIR..."
    npx tsx src/index.ts &
    sleep 5
fi

echo "✅ CTIR Server attivo"

# Configura environment variables per Claude Code
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"
export ANTHROPIC_API_KEY="ctir-integration-key"
export CLAUDE_CODE_PROXY="http://localhost:3001"

echo "🔧 Environment variables configurate:"
echo "   • ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "   • ANTHROPIC_API_URL: $ANTHROPIC_API_URL"
echo "   • ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY"
echo "   • CLAUDE_CODE_PROXY: $CLAUDE_CODE_PROXY"

# Crea script di avvio
cat > start-claude-ctir.sh << 'EOF'
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
EOF

chmod +x start-claude-ctir.sh

echo -e "\n✅ Script creato: start-claude-ctir.sh"
echo "Per avviare Claude Code con CTIR:"
echo "   ./start-claude-ctir.sh"
