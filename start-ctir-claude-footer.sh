#!/bin/bash

# CTIR + Claude Code — Avvio con Footer Permanente stile cc-sessions
# Un unico script: avvia CTIR, integra cc-sessions e mostra SEMPRE il footer a 2 righe.

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

header() {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                🚀 CTIR + Claude Code (Footer)               ║"
  echo "║           Avvio con footer cc-sessions permanente           ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

log()   { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}"; }

ensure_ctir() {
  log "Verifica CTIR..."
  if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    ok "CTIR attivo"
    return
  fi
  warn "CTIR non attivo. Avvio..."
  nohup npx tsx src/index.ts > ctir.out.log 2> ctir.err.log &
  sleep 6
  if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    ok "CTIR avviato su :3001"
  else
    err "CTIR non risponde dopo l'avvio"
    exit 1
  fi
}

ensure_cc_sessions() {
  log "Verifica integrazione cc-sessions..."
  local missing=0
  [[ -f ".claude/hooks/statusline-script.sh" ]] || missing=1
  [[ -f ".claude/hooks/daic" ]] || missing=1
  if [[ $missing -eq 1 ]]; then
    warn "Hook mancanti. Installazione..."
    if [[ -f "local-development/scripts/setup-cc-sessions.sh" ]]; then
      bash local-development/scripts/setup-cc-sessions.sh || true
    else
      err "Script setup cc-sessions non trovato"
    fi
  else
    ok "Hook cc-sessions presenti"
  fi
  chmod +x .claude/hooks/statusline-script.sh 2>/dev/null || true
}

ensure_env() {
  # Usa CTIR come endpoint per Claude CLI
  export ANTHROPIC_BASE_URL="http://localhost:3001"
  export ANTHROPIC_API_URL="http://localhost:3001"
  unset ANTHROPIC_API_KEY
  ok "Ambiente CLI configurato (proxy CTIR)"
}

launch_claude_with_footer() {
  if ! command -v claude >/dev/null 2>&1; then
    err "Claude Code CLI non trovato (npm i -g @anthropic-ai/claude)"
    exit 1
  fi

  local PROJECT_DIR="$PWD"

  if ! command -v tmux >/dev/null 2>&1; then
    err "tmux non trovato. Installa tmux (es. brew install tmux) per avere 2 pane senza aprire altre finestre."
    exit 1
  fi

  # Sessione tmux: un'unica finestra con 2 pane
  tmux has-session -t ctir_footer 2>/dev/null && tmux kill-session -t ctir_footer 2>/dev/null || true

  # Pane superiore: Claude CLI (cc-sessions originale)
  if command -v script >/dev/null 2>&1; then
    # Usa 'script' per garantire un pty valido anche in ambienti con TTY limitato
    if ! script -q /dev/null tmux new-session -d -s ctir_footer bash -lc 'export ANTHROPIC_BASE_URL="http://localhost:3001"; export ANTHROPIC_API_URL="http://localhost:3001"; unset ANTHROPIC_API_KEY; claude'; then
      err "Impossibile creare la sessione tmux (anche con script). Controlla TTY/permessi."
      exit 1
    fi
  else
    if ! tmux new-session -d -s ctir_footer bash -lc 'export ANTHROPIC_BASE_URL="http://localhost:3001"; export ANTHROPIC_API_URL="http://localhost:3001"; unset ANTHROPIC_API_KEY; claude'; then
      err "Impossibile creare la sessione tmux (controlla TTY/permessi)."
      exit 1
    fi
  fi

  # Pane inferiore (20%): statusline cc-sessions + CTIR footer
  tmux split-window -v -p 20 -t ctir_footer:0 bash -lc "cd '$PROJECT_DIR'; \
    while true; do \
      clear; \
      ctx='{\"workspace\":{\"current_dir\":\"'$PROJECT_DIR'\"},\"model\":{\"display_name\":\"Claude Sonnet 4\"},\"session_id\":\"ctir-session\"}'; \
      echo \"$ctx\" | bash .claude/hooks/statusline-script.sh 2>/dev/null || echo '(statusline non disponibile)'; \
      echo; \
      ./scripts/claude-code-ctir-indicator.sh footer 2>/dev/null || echo '(CTIR footer non disponibile)'; \
      sleep 5; \
    done"

  # Abilita mouse (click per cambiare pane) e seleziona automaticamente il pane superiore (Claude)
  tmux set-option -t ctir_footer mouse on 2>/dev/null || true
  # Seleziona esplicitamente il pane 0.0 (top) per garantire focus input
  tmux select-pane -t ctir_footer:0.0 2>/dev/null || tmux select-pane -U -t ctir_footer:0 2>/dev/null || true

  # Attacca alla sessione
  # Attacca assicurandosi che il pane selezionato resti quello superiore
  tmux attach -t ctir_footer
}

main() {
  header
  ensure_ctir
  ensure_cc_sessions
  ensure_env
  # Info
  echo ""
  ok "Footer cc-sessions attivo (aggiornamento ogni 5s)"
  echo ""
  launch_claude_with_footer
}

main "$@"
