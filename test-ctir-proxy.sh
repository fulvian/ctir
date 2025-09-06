#!/bin/bash

# 🧪 Test CTIR Proxy
# Verifica che il proxy funzioni correttamente

set -e

echo "🧪 Test CTIR Proxy"
echo "=================="

# Verifica che CTIR sia attivo
if ! curl -s http://localhost:3001/health >/dev/null; then
    echo "❌ CTIR non è attivo"
    echo "Avvia CTIR prima di eseguire questo test"
    exit 1
fi

echo "✅ CTIR attivo"

# Test del proxy
echo "🔍 Test proxy CTIR..."

TEST_RESPONSE=$(curl -s -X POST http://localhost:3001/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: ctir-key" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 50, "messages": [{"role": "user", "content": "Hello CTIR, test message"}]}' \
    --max-time 15 2>/dev/null)

if echo "$TEST_RESPONSE" | grep -q "content"; then
    echo "✅ Proxy CTIR funzionante"
    echo "📝 Risposta:"
    echo "$TEST_RESPONSE" | jq -r '.content[0].text' 2>/dev/null || echo "$TEST_RESPONSE"
else
    echo "❌ Proxy CTIR non funziona"
    echo "📝 Risposta: $TEST_RESPONSE"
fi

echo ""
echo "🎯 Per testare con Claude Code:"
echo "  export ANTHROPIC_BASE_URL=\"http://localhost:3001\""
echo "  export ANTHROPIC_API_URL=\"http://localhost:3001\"  # compatibilità"
echo "  unset ANTHROPIC_API_KEY                                 # assicura uso proxy"
echo "  claude"
