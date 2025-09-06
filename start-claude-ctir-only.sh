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

# Setup rapido cc-sessions se mancano gli hook
echo -e "\n🧩 Verifica integrazione cc-sessions..."
if [[ ! -f ".claude/hooks/statusline-script.sh" ]] || [[ ! -f ".claude/hooks/daic" ]]; then
    echo "⚠️  Hook cc-sessions mancanti. Installazione..."
    if [[ -f "local-development/scripts/setup-cc-sessions.sh" ]]; then
        bash local-development/scripts/setup-cc-sessions.sh || true
    else
        echo "❌ Script setup cc-sessions non trovato"
    fi
else
    echo "✅ Hook cc-sessions presenti"
fi

# Assicura permessi esecuzione per hook CTIR
chmod +x scripts/ctir-cc-sessions-hook.sh 2>/dev/null || true

# Inietta CTIR nel footer/statusline di cc-sessions (wrapper idempotente)
if [[ -f ".claude/hooks/statusline-script.sh" ]] && ! grep -q "CTIR wrapper" .claude/hooks/statusline-script.sh 2>/dev/null; then
  echo "🔧 Attivo CTIR nel footer cc-sessions..."
  cp .claude/hooks/statusline-script.sh .claude/hooks/statusline-script.orig.sh 2>/dev/null || true
  cat > .claude/hooks/statusline-script.sh << 'EOF'
#!/bin/bash
# CTIR wrapper per statusline cc-sessions (non distruttivo)
# Legge contesto da stdin, delega allo script originale e aggiunge indicatore CTIR inline

ORIG_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ORIG_SCRIPT="$ORIG_SCRIPT_DIR/statusline-script.orig.sh"

read -r INPUT_JSON
ORIG_OUTPUT=$(echo "$INPUT_JSON" | bash "$ORIG_SCRIPT" 2>/dev/null || true)

LINE1=$(echo "$ORIG_OUTPUT" | sed -n '1p')
LINE2=$(echo "$ORIG_OUTPUT" | sed -n '2p')

# Prende indicatore CTIR
CTIR_INDICATOR=$(./scripts/ctir-cc-sessions-hook.sh inline 2>/dev/null || echo "CTIR: Offline")

# Stampa due righe originali + indicatore CTIR inline
echo "$LINE1"
if [[ -n "$LINE2" ]]; then
  echo "$LINE2 | $CTIR_INDICATOR"
else
  echo "$CTIR_INDICATOR"
fi
EOF
  chmod +x .claude/hooks/statusline-script.sh
  echo "✅ Footer cc-sessions ora include CTIR"
fi

# Health cc-sessions via API
if curl -s http://localhost:3001/cc-sessions/health | grep -q '"ok":true'; then
    echo "✅ cc-sessions API attiva"
else
    echo "⚠️  cc-sessions API non raggiungibile (continua con hook locali)"
fi
if curl -s http://localhost:3001/cc-sessions/daic-mode >/dev/null 2>&1; then
  echo -n "🛈 Modalità DAIC API: "; curl -s http://localhost:3001/cc-sessions/daic-mode | jq -r '.mode' 2>/dev/null || true
fi

# Mostra stato sistema
echo -e "\n📊 Stato sistema CTIR + CC-Sessions:"
echo "===================================="

# Model Indicator
echo "🎭 Model Indicator:"
curl -s http://localhost:3001/model-indicator | jq -r '.indicator'

# DAIC Mode
echo -e "\n🔄 DAIC Mode:"
if [[ -x ".claude/hooks/daic" ]]; then
  bash .claude/hooks/daic 2>/dev/null | grep -o "Discussion Mode\|Implementation Mode" || echo "(script DAIC non disponibile)"
else
  echo "(script DAIC non disponibile)"
fi

# Statusline
echo -e "\n📊 Statusline:"
if [[ -x ".claude/hooks/statusline-script.sh" ]]; then
  echo '{"workspace":{"current_dir":"'$(pwd)'"},"model":{"display_name":"Claude Sonnet 4"},"session_id":"ctir-session"}' | bash .claude/hooks/statusline-script.sh || echo "(statusline script errore)"
else
  echo "(statusline script non disponibile)"
fi

echo -e "\n🎯 Avvio Claude Code con SOLO CTIR..."
echo "======================================"
echo "✅ Nessuna API key Anthropic"
echo "✅ Tutte le richieste vanno a CTIR"
echo "✅ Bypass completo del limite 5 ore"
echo "✅ Accesso a tutte le funzionalità cc-sessions"

echo -e "\n🚀 Avvio Claude Code..."
claude
