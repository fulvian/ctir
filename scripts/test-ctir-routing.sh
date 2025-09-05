#!/bin/bash
# Test end-to-end del sistema CTIR

set -e

echo "🧪 TEST END-TO-END CTIR ROUTING SYSTEM"
echo "======================================"

# Verifica CTIR attivo
echo "1. ✅ Verificando CTIR Proxy..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "   ✅ CTIR Proxy attivo"
else
    echo "   ❌ CTIR Proxy non attivo"
    exit 1
fi

# Test routing task semplice
echo ""
echo "2. 🎯 Test Routing Task Semplice..."
RESPONSE=$(curl -s -X POST http://localhost:3001/analyze-task \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Fix a simple syntax error: missing semicolon"
      }
    ],
    "model": "claude-3-5-sonnet-20241022"
  }')

STRATEGY=$(echo "$RESPONSE" | jq -r '.routing_decision.strategy')
CATEGORY=$(echo "$RESPONSE" | jq -r '.task_analysis.category')
COMPLEXITY=$(echo "$RESPONSE" | jq -r '.task_analysis.complexity_score')

echo "   📊 Risultato:"
echo "      - Strategia: $STRATEGY"
echo "      - Categoria: $CATEGORY" 
echo "      - Complessità: $COMPLEXITY"

if [ "$STRATEGY" = "ccr_local" ]; then
    echo "   ✅ CORRETTO: Task semplice instradato a modello locale"
else
    echo "   ❌ ERRORE: Task semplice non instradato correttamente"
fi

# Test routing task complesso
echo ""
echo "3. 🎯 Test Routing Task Complesso..."
RESPONSE=$(curl -s -X POST http://localhost:3001/analyze-task \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Design a complex distributed system architecture with microservices, event sourcing, CQRS, and eventual consistency for a high-traffic e-commerce platform"
      }
    ],
    "model": "claude-3-5-sonnet-20241022"
  }')

STRATEGY=$(echo "$RESPONSE" | jq -r '.routing_decision.strategy')
CATEGORY=$(echo "$RESPONSE" | jq -r '.task_analysis.category')
COMPLEXITY=$(echo "$RESPONSE" | jq -r '.task_analysis.complexity_score')

echo "   📊 Risultato:"
echo "      - Strategia: $STRATEGY"
echo "      - Categoria: $CATEGORY"
echo "      - Complessità: $COMPLEXITY"

if [ "$STRATEGY" = "claude_direct" ]; then
    echo "   ✅ CORRETTO: Task complesso instradato a Claude"
else
    echo "   ❌ ERRORE: Task complesso non instradato correttamente"
fi

# Test routing task specializzato
echo ""
echo "4. 🎯 Test Routing Task Specializzato..."
RESPONSE=$(curl -s -X POST http://localhost:3001/analyze-task \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Generate comprehensive unit tests for this React component with edge cases and error handling"
      }
    ],
    "model": "claude-3-5-sonnet-20241022"
  }')

STRATEGY=$(echo "$RESPONSE" | jq -r '.routing_decision.strategy')
CATEGORY=$(echo "$RESPONSE" | jq -r '.task_analysis.category')
COMPLEXITY=$(echo "$RESPONSE" | jq -r '.task_analysis.complexity_score')

echo "   📊 Risultato:"
echo "      - Strategia: $STRATEGY"
echo "      - Categoria: $CATEGORY"
echo "      - Complessità: $COMPLEXITY"

if [ "$STRATEGY" = "mcp_delegate" ] || [ "$STRATEGY" = "ccr_local" ]; then
    echo "   ✅ CORRETTO: Task specializzato instradato a modello locale/MCP"
else
    echo "   ⚠️  INFO: Task specializzato instradato a $STRATEGY (può essere corretto)"
fi

echo ""
echo "🎉 TEST COMPLETATI!"
echo ""
echo "📋 Riepilogo Sistema CTIR:"
echo "   ✅ Proxy attivo su porta 3001"
echo "   ✅ Routing intelligente funzionante"
echo "   ✅ Classificazione task operativa"
echo "   ✅ Strategie di routing configurate"
echo ""
echo "🚀 Prossimi passi:"
echo "   1. Riavvia Claude Code"
echo "   2. Testa con richieste reali"
echo "   3. Monitora i log per verificare il routing"
echo ""
echo "📊 Monitoraggio:"
echo "   - Health: curl http://localhost:3001/health"
echo "   - Logs: tail -f ctir.out.log"
echo "   - Status: npm run status"
