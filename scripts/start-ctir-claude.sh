#!/bin/bash

# CTIR + Claude Code Startup Script
# Avvia automaticamente CTIR e Claude Code con integrazione completa

echo "🎭 Avvio CTIR + Claude Code Integration..."
echo "========================================"

# Kill existing processes
echo "🔄 Pulizia processi esistenti..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "claude-code" 2>/dev/null || true
sleep 2

# Start CTIR
echo "🚀 Avvio CTIR..."
cd /Users/fulvioventura/Desktop/ctir
npm run dev &
CTIR_PID=$!

# Wait for CTIR to start
echo "⏳ Attesa avvio CTIR..."
sleep 5

# Check CTIR health
echo "🔍 Verifica stato CTIR..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ CTIR attivo e funzionante"
else
    echo "❌ Errore: CTIR non risponde"
    exit 1
fi

# Start Claude Code
echo "🎯 Avvio Claude Code con CTIR..."
/Users/fulvioventura/.ctir/start-claude-with-ctir.sh &
CLAUDE_PID=$!

# Wait for Claude Code to start
echo "⏳ Attesa avvio Claude Code..."
sleep 3

# Show integration status
echo ""
echo "🎭 CTIR Integration Status:"
echo "=========================="
./scripts/claude-code-ctir-indicator.sh show

echo ""
echo "📊 Endpoints Disponibili:"
echo "  Health: http://localhost:3001/health"
echo "  Model Indicator: http://localhost:3001/model-indicator"
echo "  Task Analysis: http://localhost:3001/analyze-task"

echo ""
echo "🎯 Comandi Utili:"
echo "  Status: ./scripts/claude-code-ctir-indicator.sh show"
echo "  Footer: ./scripts/claude-code-ctir-indicator.sh footer"
echo "  Monitor: watch -n 5 './scripts/claude-code-ctir-indicator.sh show'"

echo ""
echo "✅ Sistema CTIR + Claude Code completamente attivo!"
echo "   PIDs: CTIR=$CTIR_PID, Claude Code=$CLAUDE_PID"
echo ""
echo "Press Ctrl+C to stop all processes"

# Wait for user interrupt
trap 'echo ""; echo "🛑 Arresto processi..."; kill $CTIR_PID $CLAUDE_PID 2>/dev/null; exit 0' INT

# Keep script running
while true; do
    sleep 1
done
