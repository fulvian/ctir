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

render_footer_once() {
  # Ottiene 2 righe statusline dallo script cc-sessions
  local ctx
  ctx='{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Claude Sonnet 4"},"session_id":"ctir-session"}'
  local out
  out=$(echo "$ctx" | bash .claude/hooks/statusline-script.sh 2>/dev/null || true)
  local line1 line2
  line1=$(echo "$out" | sed -n '1p')
  line2=$(echo "$out" | sed -n '2p')

  # Stampa nelle ultime 2 righe del terminale
  local rows
  rows=$(tput lines 2>/dev/null || echo 24)
  tput sc 2>/dev/null || true
  tput civis 2>/dev/null || true
  tput cup $((rows-2)) 0 2>/dev/null || true
  printf "%s\033[K\n" "${line1}"
  tput cup $((rows-1)) 0 2>/dev/null || true
  printf "%s\033[K" "${line2}"
  tput rc 2>/dev/null || true
}

footer_loop() {
  while kill -0 "$1" >/dev/null 2>&1; do
    render_footer_once
    sleep 5
  done
  # Cleanup footer (ripristina cursore)
  tput cnorm 2>/dev/null || true
}

launch_claude_with_footer() {
  if ! command -v claude >/dev/null 2>&1; then
    err "Claude Code CLI non trovato (npm i -g @anthropic-ai/claude)"
    exit 1
  fi
  ok "Avvio Claude Code..."
  claude &
  CLAUDE_PID=$!
  # Avvia il loop footer legato al PID di Claude
  footer_loop "$CLAUDE_PID" &
  FOOTER_PID=$!

  # Pulizia su Ctrl+C o uscita
  trap 'kill "$FOOTER_PID" 2>/dev/null || true; tput cnorm 2>/dev/null || true; exit 0' INT TERM

  # Attendi Claude
  wait "$CLAUDE_PID" || true
  kill "$FOOTER_PID" 2>/dev/null || true
  tput cnorm 2>/dev/null || true
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

