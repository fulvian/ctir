## CTIR Enhanced Plan v1 — Integrazione cc-sessions, CCR e MCP locale

Obiettivo: prima release stabile in produzione con integrazione completa di cc-sessions (task/memoria), CCR (instradamento locale e fallback su limite 5 ore) e MCP locale (deleghe autonome), mantenendo auto-resume e status già presenti. Nessuno stub/mock/placeholder: implementazioni reali e verificabili end-to-end.

### Fase 1 — Specifiche e contratti (non invasive)
- Definisci interfacce TypeScript per:
  - cc-sessions: gestione task, pesatura, memoria/sessione (create/read/update, snapshot/restore).
  - CCR: API per `claude_direct`, `ccr_local`, `mcp_delegate`, e `localOnlyMode`.
  - MCP: client con `health()`, `callTool(name, payload, opts)` con timeout, retry, backoff, logging.
- Output: file di interfaccia con JSDoc chiaro; nessuna modifica distruttiva al core.

### Fase 2 — Adapter minimi (implementazioni concrete)
- cc-sessions adapter: implementa CRUD task, persistenza memoria, snapshot/restore sessione integrati con filesystem/SQLite già presenti.
- CCR adapter: switching modelli locali e modalità `local-only` quando `fallbackMode=true`.
- MCP client: integrazione con server `ctir-ollama-mcp` (tool: `analyze_error`, `generate_unit_tests`, `format_code`) con health/timeout/retry.

### Fase 3 — Routing Engine v1 (wiring)
- Integra `TaskClassifier` + `RoutingEngine` con matrice decisionale:
  - semplice → CCR
  - medio/specializzato → MCP
  - complesso/alto budget → Claude
- Override: se `fallbackMode=true` (5h scadute) forza CCR/MCP locale, disabilita cloud.

### Fase 4 — Auto-Resume completo
- Collega auto-resume a cc-sessions: snapshot lavoro+contesto e ripristino alla ripartenza.
- Usa `templates/auto-resume.md` per resume message; logga esito e tempi.

### Fase 5 — Osservabilità e CLI
- Estendi `npm run status`: mostra integrazioni (cc-sessions/CCR/MCP), routing corrente, ultimi errori.
- Log strutturati JSON per ogni decisione di routing.

### Fase 6 — Test E2E e accettazione
- Scenari:
  - Normale: semplice→CCR; medio→MCP; complesso→Claude.
  - Fallback: `set-limit` → tutto locale (CCR/MCP).
  - Reset: `simulate-reset` → ritorno normale; resume contesto.
- Criteri: nessuna regressione start/stop/status; routing coerente/loggato; MCP robusto con retry; resume funzionante.

### Fase 7 — Deployment produzione
- Script e checklist (systemd/launchd), `.env` completo, verifica Ollama/MCP health, rotazione log.

### Regole operative
- Modifiche minimali e non distruttive; conferma prima di cambiare API pubbliche.
- Aggiornare questo piano e `CHANGELOG.md` al termine di ogni fase o attività rilevante.

### Stato iniziale
- Auto-resume, status e MCP interno sono presenti (MVP).
- cc-sessions e CCR risultano stub: da implementare gli adapter reali e wiring nel router.

### Avanzamento
- Fase 1 COMPLETATA: creati contratti TS per cc-sessions, CCR e MCP (`src/integrations/contracts/*`).
- Fase 2 (parziale) COMPLETATA: adapter cc-sessions su filesystem (`local-development/session-data/`), adapter CCR con `local-only mode`, client MCP stdio con `health` e `callTool` con timeout/retry.
- Fase 3 COMPLETATA: router aggiornato con `localOnlyMode` per forzare CCR/MCP quando la finestra 5h è esaurita.
- Fase 4 COMPLETATA: Auto‑Resume collegato a cc-sessions (snapshot/save/restore) oltre al work‑state.
- Fase 5 COMPLETATA: `npm run status` arricchito con health integrazioni e stato routing.

### Prossimi passi
- Fase 6: Definire e implementare test E2E per scenari normale/fallback/reset.
- Fase 7: Rifinire script di deploy (systemd/launchd), checklist produzione ed env hardening.


