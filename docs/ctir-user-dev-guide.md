# Guida Completa CTIR — Utenti e Sviluppatori

Questa guida spiega come installare, avviare e usare CTIR (Claude Task Intelligence Router) sia dal punto di vista dell’utente finale (Claude Code) che dello sviluppatore (integrazione, API, estensioni).

## 1) Cos’è CTIR
- **Proxy intelligente**: intercetta le richieste Anthropic e abilita il fallback automatico verso OpenRouter quando Claude non è disponibile o limitato.
- **Orchestrazione modelli**: seleziona il modello migliore (Claude/OpenRouter) in base al task e allo stato della sessione.
- **cc-sessions**: integrazione completa con DAIC (Discussion/Implementation), branch enforcement, statusline, gestione sessioni/task.
- **Indicatori**: endpoint e script per mostrare il modello attivo e lo stato della sessione.

## 2) Prerequisiti
- Node.js >= 18
- macOS o Linux (macOS consigliato per la dev experience)
- Python 3 (per i hook di cc-sessions)
- Chiave OpenRouter (obbligatoria per il fallback): `OPEN_ROUTER_API_KEY`
- (Opzionale) Chiave Anthropic API: `CLAUDE_API_KEY` (diversa dal piano Pro di claude.ai)

## 3) Installazione
```bash
git clone https://github.com/fulvian/ctir.git
cd ctir
npm install
git submodule update --init --recursive
```

### 3.1 Configurazione .env
```env
NODE_ENV=development
LOG_LEVEL=debug
OPEN_ROUTER_API_KEY=sk-or-v1-...
# CLAUDE_API_KEY=sk-ant-...     # opzionale, lasciare vuoto per usare SOLO OpenRouter
```

Suggerito (macOS): salva le chiavi nel Keychain ed evita di tenerle in chiaro nel repo/shell:
```bash
bash scripts/setup-keys-macos.sh
```
CTIR leggerà prima `.env`, poi **integra** i segreti mancanti dal Keychain.

### 3.2 Setup cc-sessions (una tantum)
```bash
bash local-development/scripts/setup-cc-sessions.sh
```
Installa i hook Python, lo script `daic`, la statusline e i file di stato in `.claude/`.

## 4) Avvio e utilizzo (Utenti)

### 4.1 Avvio consigliato (Claude con proxy CTIR)
```bash
./start-ctir-claude.sh
```
- Avvia CTIR in background (porta `3001`), testa il proxy, configura la shell di Claude:
  - `ANTHROPIC_BASE_URL=http://localhost:3001`
  - `unset ANTHROPIC_API_KEY` (evita bypass diretto dell’API Anthropic)

### 4.2 Solo OpenRouter (nessuna chiave Anthropic)
```bash
./start-claude-ctir-only.sh
```
- Usa CTIR come backend unico: tutte le richieste vanno su OpenRouter.

### 4.3 Avvio rapido
```bash
./quick-start.sh
```

### 4.4 Verifiche rapide
```bash
curl -s http://localhost:3001/health
./test-ctir-proxy.sh
curl -s http://localhost:3001/model-indicator | jq -r '.indicator'
```

Se in Claude Code vedi ancora “5-hour limit reached”, assicurati che l’override riporti:
```
Overrides (via env):
• API Base URL: http://localhost:3001
```

## 5) Fallback e routing
- Senza `CLAUDE_API_KEY` CTIR considera Claude “non disponibile” e instrada su OpenRouter automaticamente.
- Con `CLAUDE_API_KEY`, CTIR prova Claude e in caso di limite/errore passa a OpenRouter.
- Il formato delle risposte del fallback rispetta lo schema Anthropic (compatibilità con CLI/SDK).

## 6) cc-sessions — Funzionalità principali

### 6.1 DAIC (Discussion/Implementation)
- Toggle: `bash .claude/hooks/daic` oppure via API `POST /cc-sessions/toggle-daic`
- Stato: `GET /cc-sessions/daic-mode`
- Enforcement: in Discussion alcune tool (es. Write/Edit) sono bloccate.

### 6.2 Branch enforcement e Task
- Imposta task e branch: `POST /cc-sessions/set-task`
  ```json
  { "task": "implement-feature-x", "branch": "feature/feature-x", "services": [] }
  ```
- I file sessione sono in `.claude/sessions/` e `.claude/state/`.

### 6.3 Statusline
- Script: `.claude/hooks/statusline-script.sh`
- API: `GET /cc-sessions/statusline?format=simple|full`
- Integrazione footer/inline disponibile negli script in `scripts/`.

## 7) API CTIR (per strumenti/integrazione)
- `GET /health` — stato server
- `GET /model-indicator` — modello/fornitore che sta operando
- `POST /v1/messages` — endpoint compatibile Anthropic (proxy + routing)
- `POST /analyze-task` — analisi veloce e routing decision
- `GET /metrics` — metriche Prometheus
- cc-sessions:
  - `GET /cc-sessions/health`
  - `GET /cc-sessions/daic-mode`
  - `POST /cc-sessions/toggle-daic`
  - `POST /cc-sessions/set-task`
  - `GET /cc-sessions/statusline?format=simple|full`
  - `POST /cc-sessions/block-tool`

## 8) Troubleshooting
- “5-hour limit reached” in Claude Code: accertati che sia impostato `ANTHROPIC_BASE_URL=http://localhost:3001` nella shell del CLI.
- Errore “A.map is not a function”: risolto — il proxy ora restituisce content come array di blocchi.
- Porta 3001 occupata: gli start script liberano la porta; in caso, chiudi processi Node sospesi.
- Nessuna chiave Anthropic: CTIR userà solo OpenRouter; è supportato.

## 9) Sviluppo (Developers)
### 9.1 Avvio in sviluppo
```bash
npm run dev
```

### 9.2 Build e DB
```bash
npm run build
npm run db:setup
```

### 9.3 Struttura codice (principali)
- `src/index.ts` — bootstrap + secrets hydration
- `src/core/engine.ts` — core, modern session mgmt, indicator, proxy
- `src/integrations/ctir-proxy.ts` — API, routing dinamico e cc-sessions endpoints
- `src/core/claude-session-monitor.ts` — monitor disponibilità Claude
- `src/integrations/openrouter.ts` — integrazione OpenRouter
- `src/integrations/cc-sessions*.ts` — integrazione cc-sessions (hook, statusline, sessioni)
- `docs/` — documentazione

### 9.4 Estendere il routing
- Aggiungi strategie in `src/core/router-simple.ts`/`src/core/router.ts`.
- Aggiungi modelli OpenRouter in `src/integrations/openrouter.ts`.

### 9.5 Logging e metriche
- Livello log: `LOG_LEVEL` in `.env` (`debug|info|warn|error`).
- Metriche: `GET /metrics` (porta 9090 di default).

### 9.6 Test
- Vitest configurato; aggiungi test in `tests/` o `tests/integration/`.

## 10) Best Practices
- Tieni `ANTHROPIC_API_KEY` UNSET nella shell del CLI di Claude; metti la chiave (se usi Claude API) solo in `.env` o Keychain.
- Usa `OPEN_ROUTER_API_KEY` reale per garantire il fallback.
- Esegui il setup di cc-sessions per abilitare DAIC e statusline.

---

CTIR fornisce un’esperienza “plug-and-play” per Claude Code: quando Claude è limitato, il lavoro prosegue su OpenRouter in modo trasparente; cc-sessions aggiunge disciplina e visibilità al flusso di lavoro. Per dubbi o contributi, apri una issue/PR sul repository.

