#!/bin/bash
# Script per configurare Claude Code con CTIR

set -e

echo "🔧 Configurando Claude Code per usare CTIR..."

# Verifica che CTIR sia attivo
echo "📡 Verificando CTIR Proxy..."
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ CTIR Proxy non è attivo su localhost:3001"
    echo "   Avvia CTIR con: npm start"
    exit 1
fi

echo "✅ CTIR Proxy attivo"

# Trova la directory di configurazione di Claude Code
CLAUDE_CONFIG_DIR=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Cursor/User/globalStorage/anthropic.claude-code"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CLAUDE_CONFIG_DIR="$HOME/.config/Cursor/User/globalStorage/anthropic.claude-code"
else
    echo "❌ Sistema operativo non supportato: $OSTYPE"
    exit 1
fi

echo "📁 Directory configurazione Claude Code: $CLAUDE_CONFIG_DIR"

# Crea directory se non esiste
mkdir -p "$CLAUDE_CONFIG_DIR"

# Copia configurazione CTIR
echo "📋 Copiando configurazione CTIR..."
cp claude-code-ctir-config.json "$CLAUDE_CONFIG_DIR/ctir-config.json"

# Crea file di configurazione principale
echo "⚙️ Creando configurazione principale..."
cat > "$CLAUDE_CONFIG_DIR/settings.json" << 'EOF'
{
  "claude.apiEndpoint": "http://localhost:3001",
  "claude.routingEnabled": true,
  "claude.ctirProxy": true,
  "claude.fallbackToDirect": true,
  "claude.timeout": 30000,
  "claude.retries": 3
}
EOF

echo "✅ Configurazione completata!"
echo ""
echo "🎯 Prossimi passi:"
echo "1. Riavvia Claude Code completamente"
echo "2. Verifica che CTIR sia attivo: curl http://localhost:3001/health"
echo "3. Testa il routing con un task semplice"
echo ""
echo "📊 Monitoraggio:"
echo "   - Health: http://localhost:3001/health"
echo "   - Logs: tail -f ctir.out.log"
echo "   - Status: npm run status"
