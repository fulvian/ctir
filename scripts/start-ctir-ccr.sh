#!/bin/bash
# Script per avviare CCR con CTIR Agent integrato

set -e

echo "🚀 Avviando CCR con CTIR Agent..."

# Vai alla directory CCR
cd submodules/claude-code-router

# Copia l'agent CTIR nella directory agents di CCR
echo "📦 Copiando CTIR Agent..."
cp ../../src/integrations/ctir-routing-agent.ts src/agents/ctir-router.ts

# Modifica il file agents/index.ts per includere CTIR Agent
echo "🔧 Configurando CCR per usare CTIR Agent..."

# Crea un file di configurazione temporaneo
cat > agents-config.js << 'EOF'
// CTIR Agent Configuration
import ctirRouter from './ctir-router';

export default {
  'ctir-router': ctirRouter
};
EOF

# Build CCR
echo "🔨 Building CCR..."
npm run build

# Avvia CCR con configurazione CTIR
echo "🎯 Avviando CCR con CTIR Agent..."
node dist/cli.js --config ../../ctir-ccr-config.json

echo "✅ CCR con CTIR Agent avviato!"
