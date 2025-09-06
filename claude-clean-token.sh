#!/bin/bash

# 🔐 Claude Code Token Cleaner
# Rimuove completamente il token claude.ai per evitare conflitti

set -e

echo "🔐 Claude Code Token Cleaner"
echo "============================"

# Trova e rimuovi il file di configurazione di Claude Code
CLAUDE_CONFIG_DIR="$HOME/.claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/config.json"

if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    echo "⚠️  File di configurazione Claude trovato: $CLAUDE_CONFIG_FILE"
    echo "🔄 Backup e rimozione..."
    
    # Backup del file
    cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Rimuovi il file di configurazione
    rm "$CLAUDE_CONFIG_FILE"
    
    echo "✅ File di configurazione rimosso"
else
    echo "✅ Nessun file di configurazione Claude trovato"
fi

# Rimuovi anche eventuali file di token
TOKEN_FILES=(
    "$HOME/.claude/token"
    "$HOME/.claude/session"
    "$HOME/.claude/auth"
    "$HOME/.claude/credentials"
)

for token_file in "${TOKEN_FILES[@]}"; do
    if [ -f "$token_file" ]; then
        echo "⚠️  Token file trovato: $token_file"
        rm "$token_file"
        echo "✅ Token file rimosso"
    fi
done

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
echo ""
echo "📝 Note:"
echo "  - Il backup del file di configurazione è stato salvato"
echo "  - Tutti i token claude.ai sono stati rimossi"
echo "  - Claude Code userà solo il proxy CTIR"
