#!/usr/bin/env bash
set -euo pipefail

# CTIR — Avvio all'interno di una sessione Claude Code / Cursor
# - Compila il progetto
# - Avvia CTIR in background con logging su ctir.out.log / ctir.err.log
# - Attende la creazione/aggiornamento dello stato .claude/ctir-status.json
# - Mostra lo stato corrente e suggerisce comandi utili

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_OUT="$ROOT_DIR/ctir.out.log"
LOG_ERR="$ROOT_DIR/ctir.err.log"
PID_FILE="$ROOT_DIR/.ctir.pid"
STATUS_FILE="$ROOT_DIR/.claude/ctir-status.json"

banner() {
  echo "===================================================="
  echo "CTIR — Avvio sessione (Claude Code / Cursor)"
  echo "Dir: $ROOT_DIR"
  echo "===================================================="
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "[ERRORE] Node.js non trovato. Installa Node >= 18."
    exit 1
  fi
  local major
  major=$(node -p "process.versions.node.split('.') [0]")
  if (( major < 18 )); then
    echo "[AVVISO] Node $(node -v) rilevato; si raccomanda >= 18."
  fi
}

build_ctir() {
  echo "[INFO] Compilazione TypeScript..."
  (cd "$ROOT_DIR" && npm run build)
}

discover_cursor_log() {
  local base="$HOME/Library/Application Support/Cursor/logs"
  if [[ -d "$base" ]]; then
    local log
    log=$(\find "$base" -type f -name "*Claude Code.log" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -n1 || true)
    if [[ -n "${log:-}" ]]; then
      echo "[INFO] Log Claude Code (Cursor) trovato: $log"
    else
      echo "[WARN] Nessun log 'Claude Code.log' trovato in $base"
    fi
  else
    echo "[WARN] Percorso Cursor non trovato: $base"
  fi
}

start_ctir() {
  echo "[INFO] Avvio CTIR in background..."
  : >"$LOG_OUT"; : >"$LOG_ERR"
  (cd "$ROOT_DIR" && nohup node dist/index.js >>"$LOG_OUT" 2>>"$LOG_ERR" & echo $! >"$PID_FILE")
  sleep 1
  if [[ -s "$PID_FILE" ]]; then
    echo "[INFO] CTIR PID: $(cat "$PID_FILE")"
  else
    echo "[ERRORE] Impossibile ottenere il PID di CTIR. Controlla i log: $LOG_ERR"
    exit 1
  fi
}

wait_status() {
  echo "[INFO] Attendo aggiornamento stato (.claude/ctir-status.json)..."
  local attempts=0
  while (( attempts < 30 )); do
    if [[ -f "$STATUS_FILE" ]]; then
      break
    fi
    sleep 1
    attempts=$((attempts+1))
  done

  if [[ -f "$STATUS_FILE" ]]; then
    echo "[INFO] Stato rilevato:"
    (cd "$ROOT_DIR" && npm run --silent status || true)
  else
    echo "[WARN] Stato non disponibile entro il timeout. Verifica i log: $LOG_ERR"
  fi
}

print_hints() {
  echo ""
  echo "Suggerimenti Utili"
  echo "- Verifica stato:    npm run status"
  echo "- Simula limite:     npm run set-limit"
  echo "- Simula reset:      npm run simulate-reset"
  echo "- Log (out):         tail -f '$LOG_OUT'"
  echo "- Log (err):         tail -f '$LOG_ERR'"
  echo "- Arresta CTIR:      kill \$(cat '$PID_FILE') && rm -f '$PID_FILE'"
  echo ""
  echo "Esegui questo script dal terminale integrato in Cursor/Claude Code per un test UX realistico."
}

main() {
  banner
  check_node
  discover_cursor_log
  build_ctir
  start_ctir
  wait_status
  print_hints
}

main "$@"

