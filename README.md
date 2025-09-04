## CTIR — Claude Task Intelligence Router

CTIR ottimizza l’uso di Claude Code orchestrando i task tra Claude, modelli locali via Ollama e tool MCP dedicati. Include un sistema di auto-resume per sfruttare al massimo le finestre di 5 ore e minimizzare tempi morti.

Per i dettagli progettuali e di visione, consulta i documenti in `docs/idee_fondanti/*`.
Per l’uso operativo dettagliato (installazione, produzione, utilizzo, manutenzione), vedi `docs/guida_ctir.md`.

**Caratteristiche Principali**
- Routing intelligente dei task: instrada verso Claude, CCR (Claude Code Router) o MCP locali in base a categoria e complessità.
- Integrazione modelli locali: supporto Ollama con modelli specializzati per debug, generazione test, formattazione.
- MCP server incluso: `ctir-ollama-mcp` espone strumenti per delega locale coerenti con il Model Context Protocol.
- Auto-resume MVP: tracciamento finestre e salvataggio stato lavoro per ripresa automatica.

---

**Architettura**
- Core Engine (TypeScript): orchestrazione, bootstrap e caricamento configurazioni.
- Task Classifier: euristiche keyword-based per categoria e stima complessità.
- Routing Engine: regole MVP basate su punteggio di complessità e budget token.
- Integrazioni stub: cc-sessions, CCR e MCP (estendibili per la produzione).
- MCP server interno: `mcp/ctir-ollama-mcp` con strumenti:
  - `analyze_error`: analisi errore + fix minimo + test rapido.
  - `generate_unit_tests`: generazione test unitari con framework opzionale.
  - `format_code`: formattazione codice per linguaggio/stile.

File di riferimento principali:
- `src/index.ts`
- `src/core/engine.ts`
- `src/core/classifier.ts`
- `src/core/router.ts`
- `src/core/autoResume.ts`
- `src/integrations/mcp.ts`
- `config/default.json`
- `.env.example`
- `mcp/ctir-ollama-mcp/src/index.ts`

---

**Prerequisiti**
- Node.js: `>= 18`
- macOS consigliato (Apple Silicon supportato), ma cross‑platform per Node.
- Ollama installato e in esecuzione: https://ollama.ai/
- PNPM opzionale (CCR usa `pnpm`, lo script effettua fallback a `npm`/`yarn`).

---

**Installazione Rapida**
- Clona il repository e posizionati nella cartella.
- Crea l’ambiente e builda:
  - `cp .env.example .env` e personalizza valori chiave
  - `npm install`
  - `npm run build && npm run db:setup`
- Inizializza submodules e dipendenze:
  - `npm run submodules:install`
- Prepara i modelli locali (Ollama):
  - `bash local-development/scripts/setup-models.sh`
  - Oppure: `ollama pull qwen2.5-coder:7b`

Avvio in sviluppo:
- CTIR: `npm run dev`
- MCP server (opzionale in sessione separata):
  - Installazione: `npm run mcp:install`
  - Health check: `npm run mcp:health`
  - Dev: `npm run mcp:dev`
  - Start: `npm run mcp:start`

---

**Configurazione**
- Env file: `.env` (vedi `.env.example`)
  - `DB_PATH`: percorso DB SQLite locale
  - `OLLAMA_HOST`: endpoint di Ollama (es. `http://localhost:11434`)
  - `DEFAULT_DEBUG_MODEL`, `DEFAULT_GENERATION_MODEL`, `DEFAULT_FORMATTING_MODEL`
  - `CLAUDE_API_KEY`, `TOKEN_BUDGET_LIMIT`
  - Percorsi configurazione per cc-sessions/CCR se utilizzati
- Config JSON: `config/default.json`
  - `ctir.tokenBudget`: soglie conservative/aggressive/critical
  - `ctir.models`: modelli locali predefiniti
  - `ctir.integrations`: abilitazione cc-sessions/CCR/MCP e lista server MCP (`ctir-ollama-mcp`)
  - `ctir.autoResume`: parametri di backup e timing

---

**Struttura Progetto**
- `src/core`: engine, classifier, router, auto-resume
- `src/integrations`: stub cc-sessions, CCR e MCP
- `src/models`: tipi per task/session/routing
- `src/scripts`: script TypeScript (es. setup DB)
- `config`: configurazioni progetto
- `local-development`: script e requisiti di sviluppo
- `mcp/ctir-ollama-mcp`: server MCP interno per Ollama
- `submodules`: cc-sessions e claude-code-router (opzionali)

---

**Script NPM Principali**
- `dev`: avvia CTIR in watch mode
- `build`: compila TypeScript ed esegue alias
- `start`: avvia CTIR compilato
- `db:setup`: inizializza il DB SQLite locale
- `submodules:install`: init/update submodules e install dei pacchetti
- `submodules:update`: aggiornamento remoto submodules + reinstall
- `mcp:install` / `mcp:build` / `mcp:dev` / `mcp:start` / `mcp:health`

---

**Come Funziona (MVP)**
- Classificazione: `TaskClassifier` assegna categoria e punteggio complessità con euristiche veloci.
- Routing: `RoutingEngine` decide `claude_direct`, `ccr_local` o `mcp_delegate` considerando complessità e budget token.
- Auto‑Resume: `SessionTimingTracker` pianifica il resume della finestra; `WorkStatePersistence` salva snapshot su filesystem (`local-development/backups/`).
- MCP: `ctir-ollama-mcp` fornisce strumenti per delegare attività specifiche a modelli locali.

---

**Uso MCP Interno (Ollama)**
- Strumenti disponibili:
  - `analyze_error(code, error, model?)`
  - `generate_unit_tests(language, code, framework?, requirements?, model?)`
  - `format_code(language, code, style?, model?)`
- Modelli di default letti da `.env` (sovrascrivibili via parametro `model`).
- Health‑check: `npm run mcp:health` (esce con codice `0` se ok).

File MCP principali:
- `mcp/ctir-ollama-mcp/src/index.ts`
- `mcp/ctir-ollama-mcp/package.json`

---

**Gestione Submodules**
- Inizializza e installa: `npm run submodules:install`
- Aggiorna alla revisione remota: `npm run submodules:update`

Submodules inclusi:
- `submodules/cc-sessions` → https://github.com/GWUDCAP/cc-sessions
- `submodules/claude-code-router` → https://github.com/musistudio/claude-code-router

Nota: Il precedente submodule `local-llm-mcp` è stato rimosso in favore di un MCP interno (`ctir-ollama-mcp`).

---

**Limitazioni Note (MVP)**
- Integrazioni cc-sessions e CCR sono stub: vanno completate le chiamate reali.
- Auto‑resume: persistenza su filesystem; DB schema pronto ma non ancora usato in runtime.
- Notifiche desktop e resume automatico verso l’IDE non sono ancora cablati.
- Nessuna CLI/REST pubblica ancora esposta (solo bootstrap e logica core).

---

**Roadmap Breve**
- Completare integrazioni cc-sessions/CCR (routing e contesto).
- Token budget monitor reale e metrica performance modelli.
- Migliorare auto‑resume (DB + notifiche + prompt generator configurabile).
- API di controllo (CLI/REST) e health endpoint.
- Test e benchmark completi.

---

**Contribuire**
- Issue e PR sono benvenute. Discuti prima le modifiche sostanziali aprendo una issue.

**Supporto**
- Apri una issue su GitHub se incontri problemi o hai richieste di feature.
- Health: `npm run mcp:health`
