#!/bin/bash
# Script per configurare CTIR come proxy per Claude Code (metodo CCR)

set -e

echo "🔧 Configurando CTIR come proxy per Claude Code (metodo CCR)..."

# Verifica che CTIR sia attivo
echo "📡 Verificando CTIR Proxy..."
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ CTIR Proxy non è attivo su localhost:3001"
    echo "   Avvia CTIR con: npm start"
    exit 1
fi

echo "✅ CTIR Proxy attivo"

# Crea directory configurazione CTIR
CTIR_CONFIG_DIR="$HOME/.ctir"
mkdir -p "$CTIR_CONFIG_DIR"

# Crea configurazione CTIR (stile CCR)
echo "📋 Creando configurazione CTIR..."
cat > "$CTIR_CONFIG_DIR/config.json" << 'EOF'
{
  "PROVIDERS": [
    {
      "name": "anthropic",
      "apiKey": "your_anthropic_api_key_here",
      "models": [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022"
      ]
    },
    {
      "name": "ollama",
      "apiKey": "",
      "baseURL": "http://localhost:11434",
      "models": [
        "qwen2.5-coder:7b",
        "phi4-mini:3.8b"
      ]
    }
  ],
  "ROUTER": {
    "default": "anthropic,claude-3-5-sonnet-20241022",
    "longContext": "anthropic,claude-3-5-sonnet-20241022",
    "background": "ollama,qwen2.5-coder:7b",
    "longContextThreshold": 60000
  },
  "HOST": "localhost",
  "PORT": 3001,
  "LOG": true,
  "LOG_LEVEL": "debug",
  "CTIR_ROUTING": true,
  "CTIR_INTELLIGENT_ROUTING": true
}
EOF

# Crea script per avviare Claude Code con CTIR
echo "🚀 Creando script di avvio Claude Code con CTIR..."
cat > "$CTIR_CONFIG_DIR/start-claude-with-ctir.sh" << 'EOF'
#!/bin/bash
# Avvia Claude Code con CTIR come proxy

# Carica configurazione CTIR
CTIR_CONFIG_DIR="$HOME/.ctir"
CTIR_CONFIG="$CTIR_CONFIG_DIR/config.json"

if [ ! -f "$CTIR_CONFIG" ]; then
    echo "❌ Configurazione CTIR non trovata: $CTIR_CONFIG"
    exit 1
fi

# Leggi porta da configurazione
CTIR_PORT=$(jq -r '.PORT // 3001' "$CTIR_CONFIG")

# Verifica che CTIR sia attivo
if ! curl -s "http://localhost:$CTIR_PORT/health" > /dev/null; then
    echo "❌ CTIR Proxy non è attivo su localhost:$CTIR_PORT"
    echo "   Avvia CTIR con: npm start"
    exit 1
fi

echo "🎯 Avviando Claude Code con CTIR Proxy..."

# Imposta variabili d'ambiente per intercettare le richieste (metodo CCR)
export ANTHROPIC_BASE_URL="http://localhost:$CTIR_PORT"
export ANTHROPIC_API_KEY=""
export ANTHROPIC_AUTH_TOKEN="ctir-proxy-token"
export API_TIMEOUT_MS="600000"

# Avvia Claude Code
claude "$@"
EOF

chmod +x "$CTIR_CONFIG_DIR/start-claude-with-ctir.sh"

# Crea alias per facilità d'uso
echo "🔗 Creando alias per facilità d'uso..."
cat > "$CTIR_CONFIG_DIR/setup-alias.sh" << 'EOF'
#!/bin/bash
# Aggiungi alias per CTIR

echo "Aggiungendo alias CTIR al tuo shell..."

# Aggiungi alias per .bashrc
if [ -f "$HOME/.bashrc" ]; then
    echo 'alias ctir-claude="$HOME/.ctir/start-claude-with-ctir.sh"' >> "$HOME/.bashrc"
    echo "✅ Alias aggiunto a .bashrc"
fi

# Aggiungi alias per .zshrc
if [ -f "$HOME/.zshrc" ]; then
    echo 'alias ctir-claude="$HOME/.ctir/start-claude-with-ctir.sh"' >> "$HOME/.zshrc"
    echo "✅ Alias aggiunto a .zshrc"
fi

echo ""
echo "🎯 Per usare Claude Code con CTIR:"
echo "   ctir-claude"
echo ""
echo "   Oppure direttamente:"
echo "   $HOME/.ctir/start-claude-with-ctir.sh"
EOF

chmod +x "$CTIR_CONFIG_DIR/setup-alias.sh"

echo "✅ Configurazione CTIR completata!"
echo ""
echo "🎯 Prossimi passi:"
echo "1. Configura la tua API key in: $CTIR_CONFIG_DIR/config.json"
echo "2. Esegui: $CTIR_CONFIG_DIR/setup-alias.sh"
echo "3. Riavvia il terminale"
echo "4. Usa: ctir-claude"
echo ""
echo "📊 Monitoraggio:"
echo "   - Health: curl http://localhost:3001/health"
echo "   - Logs: tail -f ctir.out.log"
echo "   - Status: npm run status"
