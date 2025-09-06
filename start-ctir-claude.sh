#!/bin/bash

# 🚀 CTIR + Claude Code Launcher
# Script completo per avviare CTIR e Claude Code con proxy automatico

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Funzione per logging colorato
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

# Header
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🚀 CTIR + Claude Code                     ║"
echo "║                    Launcher Automatico                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Controllo processi CTIR esistenti
log_step "Controllo processi CTIR esistenti..."

CTIR_PROCESSES=$(ps aux | grep -E "tsx.*src/index\.ts|node.*src/index\.ts" | grep -v grep | wc -l)

if [ "$CTIR_PROCESSES" -gt 0 ]; then
    log_warning "Trovati $CTIR_PROCESSES processi CTIR attivi"
    
    # Mostra processi attivi
    echo -e "${YELLOW}Processi CTIR attivi:${NC}"
    ps aux | grep -E "tsx.*src/index\.ts|node.*src/index\.ts" | grep -v grep
    
    log_info "Terminazione processi CTIR esistenti..."
    
    # Termina processi CTIR
    pkill -f "tsx.*src/index.ts" 2>/dev/null || true
    pkill -f "node.*src/index.ts" 2>/dev/null || true
    
    # Aspetta che i processi si chiudano
    sleep 3
    
    # Verifica che siano stati terminati
    REMAINING_PROCESSES=$(ps aux | grep -E "tsx.*src/index\.ts|node.*src/index\.ts" | grep -v grep | wc -l)
    
    if [ "$REMAINING_PROCESSES" -gt 0 ]; then
        log_error "Impossibile terminare tutti i processi CTIR"
        log_info "Tentativo di terminazione forzata..."
        pkill -9 -f "tsx.*src/index.ts" 2>/dev/null || true
        pkill -9 -f "node.*src/index.ts" 2>/dev/null || true
        sleep 2
    fi
    
    log_success "Processi CTIR terminati"
else
    log_success "Nessun processo CTIR attivo trovato"
fi

# Step 2: Controllo porta 3001
log_step "Controllo porta 3001..."

if lsof -i :3001 >/dev/null 2>&1; then
    log_warning "Porta 3001 occupata"
    PORT_PROCESS=$(lsof -ti :3001)
    log_info "Processo che occupa la porta: PID $PORT_PROCESS"
    
    # Termina il processo sulla porta 3001
    kill $PORT_PROCESS 2>/dev/null || true
    sleep 2
    
    # Verifica che la porta sia libera
    if lsof -i :3001 >/dev/null 2>&1; then
        log_error "Impossibile liberare la porta 3001"
        exit 1
    fi
    
    log_success "Porta 3001 liberata"
else
    log_success "Porta 3001 disponibile"
fi

# Step 3: Controllo dipendenze
log_step "Controllo dipendenze..."

# Controlla se siamo nella directory corretta
if [ ! -f "package.json" ] || [ ! -f "src/index.ts" ]; then
    log_error "Directory non valida. Assicurati di essere nella root del progetto CTIR"
    exit 1
fi

# Controlla se node_modules esiste
if [ ! -d "node_modules" ]; then
    log_warning "node_modules non trovato. Installazione dipendenze..."
    npm install
fi

# Controlla se tsx è disponibile
if ! command -v npx &> /dev/null; then
    log_error "npx non trovato. Installa Node.js"
    exit 1
fi

log_success "Dipendenze verificate"

# Step 4: Controllo file .env
log_step "Controllo configurazione..."

if [ ! -f ".env" ]; then
    log_warning "File .env non trovato"
    if [ -f "env.example" ]; then
        log_info "Copiando env.example in .env..."
        cp env.example .env
        log_warning "IMPORTANTE: Configura le API keys nel file .env"
    else
        log_error "Né .env né env.example trovati"
        exit 1
    fi
fi

# Controlla OPEN_ROUTER_API_KEY
if ! grep -q "OPEN_ROUTER_API_KEY=sk-" .env; then
    log_warning "OPEN_ROUTER_API_KEY non configurata nel file .env"
    log_info "Configura OPEN_ROUTER_API_KEY nel file .env per utilizzare OpenRouter"
fi

log_success "Configurazione verificata"

# Step 4.5: Caricamento automatico variabili ambiente (.env + Keychain)
log_step "Gestione automatica variabili ambiente..."

# Esporta tutte le variabili definite in .env (senza stampare segreti)
set -a
source ./.env 2>/dev/null || true
set +a

# Helper: leggi segreto dal Keychain (solo macOS)
read_keychain_secret() {
  local service="$1"; local account="$2";
  if [[ "$(uname -s)" == "Darwin" ]]; then
    security find-generic-password -s "$service" -a "$account" -w 2>/dev/null || true
  fi
}

# Helper: imposta variabile se mancante (ordine: env/.env già caricata -> Keychain -> prompt)
ensure_secret_var() {
  local var_name="$1"; local service="$2"; local description="$3"; local current_val
  current_val="${!var_name}"
  # Consideriamo placeholder valori del tipo your_*_here (case-insensitive non necessario qui)
  if [[ -n "$current_val" ]] && [[ ! "$current_val" == your_*_here ]]; then
    log_success "$var_name già impostata (da .env o ambiente)"
    return 0
  fi

  # Prova Keychain (macOS)
  local kc_val
  kc_val=$(read_keychain_secret "$service" "$USER")
  if [[ -n "$kc_val" ]]; then
    export "$var_name"="$kc_val"
    log_success "$var_name caricata dal Keychain"
    return 0
  fi

  # Prompt interattivo
  echo -n "Inserisci $description (lascia vuoto per saltare): "
  read -r secret_val
  if [[ -n "$secret_val" ]]; then
    export "$var_name"="$secret_val"
    # Offri salvataggio in Keychain
    if [[ "$(uname -s)" == "Darwin" ]]; then
      echo -n "Salvare in Keychain per usi futuri? (y/N): "
      read -n 1 -r reply; echo
      if [[ $reply =~ ^[Yy]$ ]]; then
        security add-generic-password -a "$USER" -s "$service" -w "$secret_val" -U >/dev/null 2>&1 || true
        log_success "$var_name salvata in Keychain"
      fi
    fi
  else
    log_warning "$var_name non impostata; alcune funzioni potrebbero non essere disponibili"
  fi
}

# Imposta chiavi richieste per il server CTIR
ensure_secret_var "OPEN_ROUTER_API_KEY" "CTIR_OPEN_ROUTER_API_KEY" "OpenRouter OPEN_ROUTER_API_KEY"
ensure_secret_var "CLAUDE_API_KEY" "CTIR_CLAUDE_API_KEY" "Anthropic CLAUDE_API_KEY"

log_success "Variabili ambiente per CTIR pronte (senza stampa dei valori)"

# Step 5: Avvio CTIR
log_step "Avvio CTIR..."

log_info "Avvio server CTIR in background..."
nohup npx tsx src/index.ts > ctir.out.log 2> ctir.err.log &

# Aspetta che CTIR si avvii
log_info "Attesa avvio CTIR (10 secondi)..."
sleep 10

# Verifica che CTIR sia attivo
log_step "Verifica stato CTIR..."

MAX_RETRIES=6
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        log_success "CTIR attivo e funzionante su porta 3001"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_warning "Tentativo $RETRY_COUNT/$MAX_RETRIES - CTIR non ancora pronto"
        sleep 5
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "CTIR non si è avviato correttamente"
    log_info "Controlla i log:"
    echo "  - Output: tail -f ctir.out.log"
    echo "  - Errori: tail -f ctir.err.log"
    exit 1
fi

# Step 6: Test rapido del proxy
log_step "Test proxy CTIR..."

TEST_RESPONSE=$(curl -s -X POST http://localhost:3001/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: ctir-key" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 20, "messages": [{"role": "user", "content": "Test"}]}' \
    --max-time 15 2>/dev/null)

if echo "$TEST_RESPONSE" | grep -q "content"; then
    log_success "Proxy CTIR funzionante"
else
    log_warning "Proxy CTIR potrebbe non funzionare correttamente"
    log_info "Risposta test: $TEST_RESPONSE"
fi

# Step 7: Configurazione Claude Code
log_step "Configurazione Claude Code..."

# Esporta variabili d'ambiente per Claude Code
# Nota: il CLI/SDK ufficiale usa ANTHROPIC_BASE_URL; manteniamo anche ANTHROPIC_API_URL per compatibilità
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"

log_success "Variabili d'ambiente configurate:"
echo "  - ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "  - ANTHROPIC_API_URL: $ANTHROPIC_API_URL"

# Step 8: Verifica Claude Code CLI
log_step "Verifica Claude Code CLI..."

if ! command -v claude &> /dev/null; then
    log_error "Claude Code CLI non trovato"
    log_info "Installa Claude Code CLI:"
    echo "  npm install -g @anthropic-ai/claude"
    exit 1
fi

log_success "Claude Code CLI disponibile"

# Step 8.5: Gestione autenticazione Claude Code
log_step "Gestione autenticazione Claude Code..."

# Controlla se c'è un token claude.ai attivo
if claude /status 2>/dev/null | grep -q "claude.ai"; then
    log_warning "Token claude.ai attivo rilevato"
    log_info "Logout da claude.ai per evitare conflitti..."
    
    # Logout automatico da claude.ai
    echo "n" | claude /logout 2>/dev/null || true
    sleep 2
    
    log_success "Logout da claude.ai completato"
else
    log_success "Nessun token claude.ai attivo"
fi

# Step 8.6: Configurazione finale per evitare conflitti
log_step "Configurazione finale per evitare conflitti..."

# UNSET qualsiasi API key esistente per evitare conflitti
unset ANTHROPIC_API_KEY

# Imposta solo l'URL del proxy
export ANTHROPIC_BASE_URL="http://localhost:3001"
export ANTHROPIC_API_URL="http://localhost:3001"

log_success "Configurazione finale completata:"
echo "  - ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "  - ANTHROPIC_API_URL: $ANTHROPIC_API_URL"
echo "  - ANTHROPIC_API_KEY: (unset - usa proxy)"

# Step 9: Avvio Claude Code
log_step "Avvio Claude Code..."

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🎯 AVVIO CLAUDE CODE                      ║"
echo "║                                                              ║"
echo "║  CTIR Proxy: http://localhost:3001                         ║"
echo "║  Modelli disponibili: OpenRouter (gratuiti + premium)       ║"
echo "║  Funzionalità: DAIC, Statusline, Task Management           ║"
echo "║                                                              ║"
echo "║  Per interrompere: Ctrl+C                                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_success "Sistema pronto! Avvio Claude Code..."

# Avvia Claude Code
claude

# Cleanup quando Claude Code si chiude
log_info "Claude Code chiuso. Script terminato."
