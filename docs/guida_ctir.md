# Guida CTIR — Installazione, Deployment, Utilizzo, Manutenzione

Questa guida è il riferimento operativo per sviluppatori e utenti tecnici per installare, avviare, mettere in produzione e mantenere CTIR (Claude Task Intelligence Router).

Obiettivi principali:
- Ottimizzare l’uso di Claude Code con routing intelligente dei task.
- Delegare compiti a modelli locali (Ollama) tramite server MCP dedicati.
- Gestire finestre di 5 ore con auto‑resume e persistenza dello stato.

Sezioni:
- Installazione (sviluppo)
- Deployment in produzione
- Utilizzo (sviluppo/integrazione MCP)
- Manutenzione e aggiornamenti
- Troubleshooting e FAQ

---

## 1) Prerequisiti

- Sistema operativo: macOS (Apple Silicon consigliato). Linux supportato per produzione.
- Node.js: >= 18
- Git: per clonare e gestire submodules
- Ollama: https://ollama.ai/ (in esecuzione con i modelli necessari)
- PNPM opzionale (CCR usa pnpm; lo script fa fallback a npm/yarn)
- Spazio disco: dipende dai modelli (almeno 10–20 GB consigliati per 7B)

Risorse consigliate (sviluppo su MBP 16GB):
- RAM: >= 16 GB
- CPU/GPU: Apple Silicon

---

## 2) Installazione (Ambiente di Sviluppo)

### 2.1 Clonare il repository

```bash
git clone https://github.com/fulvian/ctir.git
cd ctir
```

### 2.2 Configurare variabili d’ambiente

```bash
cp .env.example .env
# Modifica .env con editor e imposta:
# - DB_PATH (es. ./local-development/ctir.db)
# - OLLAMA_HOST (es. http://localhost:11434)
# - DEFAULT_DEBUG_MODEL, DEFAULT_GENERATION_MODEL, DEFAULT_FORMATTING_MODEL
# - CLAUDE_API_KEY (se necessario per CCR/Claude)
```

### 2.3 Dipendenze e build

```bash
npm install
npm run build
npm run db:setup
```

### 2.4 Submodules e pacchetti

```bash
npm run submodules:install
# Installa e builda i submodules (cc-sessions, claude-code-router) e il MCP interno
```

### 2.5 Modelli Ollama

```bash
# Avvia Ollama e scarica i modelli (se non presenti)
bash local-development/scripts/setup-models.sh
# Oppure manualmente:
ollama pull qwen2.5-coder:7b
```

### 2.6 Avvio in sviluppo

```bash
# Avvia CTIR (watch mode)
npm run dev

# (opzionale) Avvia MCP interno in un altro terminale
npm run mcp:install
npm run mcp:build
npm run mcp:dev

# Health-check MCP
npm run mcp:health
```

---

## 3) Deployment in Produzione

Nota: l’attuale codebase fornisce il core CTIR e un MCP interno; le integrazioni CCR/cc-sessions sono stub e vanno completate per l’uso avanzato in produzione.

### 3.1 Build dist e assets

```bash
# Su macchina di deploy (Linux/macOS)
git clone https://github.com/fulvian/ctir.git
cd ctir
npm install
npm run build
npm run db:setup

# MCP interno
npm run mcp:install
npm run mcp:build
```

### 3.2 Variabili d’ambiente (produzione)

- Copia `.env` o usa un environment file dedicato (non committare segreti).
- Imposta `NODE_ENV=production`, aggiorna `DB_PATH` per una posizione persistente (es. `/var/lib/ctir/ctir.db`).

### 3.3 Linux (systemd)

Unit file esempio per CTIR (`/etc/systemd/system/ctir.service`):

```ini
[Unit]
Description=CTIR - Claude Task Intelligence Router
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/ctir
EnvironmentFile=/etc/ctir/ctir.env
ExecStart=/usr/bin/node /opt/ctir/dist/index.js
Restart=always
RestartSec=5
User=ctir
Group=ctir
NoNewPrivileges=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Unit file per MCP interno (`/etc/systemd/system/ctir-ollama-mcp.service`):

```ini
[Unit]
Description=CTIR Ollama MCP Server
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/ctir
EnvironmentFile=/etc/ctir/ctir.env
ExecStart=/usr/bin/node /opt/ctir/mcp/ctir-ollama-mcp/dist/index.js
Restart=always
RestartSec=5
User=ctir
Group=ctir
NoNewPrivileges=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Passi:

```bash
sudo adduser --system --group ctir || true
sudo mkdir -p /opt/ctir /etc/ctir /var/lib/ctir
sudo chown -R ctir:ctir /opt/ctir /var/lib/ctir
sudo cp -r . /opt/ctir
sudo cp .env /etc/ctir/ctir.env  # o crea un env file dedicato

sudo systemctl daemon-reload
sudo systemctl enable ctir.service ctir-ollama-mcp.service
sudo systemctl start ctir.service ctir-ollama-mcp.service
sudo systemctl status ctir.service
```

Assicurati che Ollama sia installato e attivo con i modelli richiesti.

### 3.4 macOS (launchd)

Plist esempio per CTIR (`~/Library/LaunchAgents/com.ctir.app.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ctir.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/<username>/ctir/dist/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/<username>/ctir</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>DB_PATH</key><string>/Users/<username>/ctir/local-development/ctir.db</string>
    <key>OLLAMA_HOST</key><string>http://localhost:11434</string>
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/ctir.out.log</string>
  <key>StandardErrorPath</key><string>/tmp/ctir.err.log</string>
</dict>
</plist>
```

Caricamento:

```bash
launchctl load ~/Library/LaunchAgents/com.ctir.app.plist
launchctl start com.ctir.app
launchctl list | grep ctir
```

Ripeti con un plist analogo per `mcp/ctir-ollama-mcp/dist/index.js`.

---

## 4) Utilizzo

Attualmente (MVP):
- CTIR esegue bootstrap, carica configurazioni e prepara timing per l’auto‑resume.
- Routing/classificazione sono implementati come libreria interna (non ancora esposta via API).
- MCP interno fornisce tool utilizzabili da client MCP (Claude, Cursor, Windsurf, ecc.).

### 4.1 Avviare i processi

```bash
# CTIR
npm run start            # (o npm run dev in sviluppo)

# MCP
npm run mcp:start        # (o npm run mcp:dev)
# Health check
npm run mcp:health
```

### 4.2 Integrare MCP con un client

Esempio di configurazione MCP client (VS Code / Cursor):

```json
{
  "mcpServers": {
    "ctir-ollama-mcp": {
      "command": "node",
      "args": ["/path/assoluto/ctir/mcp/ctir-ollama-mcp/dist/index.js"],
      "env": {
        "OLLAMA_HOST": "http://localhost:11434",
        "DEFAULT_DEBUG_MODEL": "qwen2.5-coder:7b",
        "DEFAULT_GENERATION_MODEL": "qwen2.5-coder:7b",
        "DEFAULT_FORMATTING_MODEL": "qwen2.5-coder:7b"
      }
    }
  }
}
```

Una volta attivo, il client MCP elencherà gli strumenti:
- `analyze_error`
- `generate_unit_tests`
- `format_code`

### 4.3 CCR e cc-sessions (stato)

- I moduli `src/integrations/ccr.ts` e `src/integrations/cc-sessions.ts` sono attualmente stub.
- Per instradare task reali attraverso CCR o cc-sessions è necessario completare le integrazioni.

---

## 5) Manutenzione

### 5.1 Aggiornare dipendenze e submodules

```bash
# Dipendenze root
npm install

# Submodules e pacchetti
npm run submodules:update

# MCP interno
npm run mcp:install
npm run mcp:build
```

### 5.2 Backup database

- Il DB SQLite (predefinito: `./local-development/ctir.db`) contiene snapshot di stato lavoro.
- Effettua backup periodici del file `.db` (servizio in stop o in quiescenza).

### 5.3 Aggiornamento/gestione modelli

```bash
ollama list
ollama pull <modello>
ollama rm <modello>
```

- Tieni allineate le variabili `.env` per i modelli di default.

### 5.4 Log e osservabilità

- CTIR usa un logger semplice (`LOG_LEVEL=debug|info|warn|error`).
- In produzione, preferisci journald (systemd) o files dedicati con rotazione log.

### 5.5 Sicurezza

- Non committare `.env`. Gestisci i segreti con file protetti o secret manager.
- Isola gli utenti di servizio (`ctir`), limita permessi su directory e DB.

---

## 6) Troubleshooting

- `npm run mcp:health` fallisce
  - Verifica `OLLAMA_HOST`, che `ollama serve` sia attivo e che i modelli siano disponibili.
  - Problemi di rete o timeout: riprova, controlla firewall.

- Errori di build TypeScript
  - Verifica Node >=18, ripeti `npm install` e `npm run build`.

- PNPM warning (CCR)
  - Se necessario esegui `pnpm approve-builds` nella cartella del submodule.

- Memoria insufficiente
  - Riduci il numero di modelli attivi, utilizza modelli 7B, ottimizza `.env` per cache/unloading.

---

## 7) FAQ

- Posso usare CTIR senza Ollama?
  - Puoi avviare CTIR, ma gli strumenti MCP locali richiedono Ollama per funzionare.

- Il routing è già collegato a CCR/cc-sessions?
  - No, gli adapter sono stub. Il core di classificazione e routing è pronto, ma l’integrazione va completata.

- Posso usare CTIR su Linux?
  - Sì. Vedi sezione systemd per il deployment.

---

## 8) Riferimenti

- `src/index.ts` — avvio CTIR
- `src/core/*` — engine, classifier, router, auto‑resume
- `src/integrations/*` — integrazioni stub
- `src/scripts/setup-database.ts` — schema SQLite
- `config/default.json` — configurazione principale
- `.env.example` — variabili d’ambiente
- `mcp/ctir-ollama-mcp/*` — MCP interno
- `local-development/scripts/*` — setup ambiente, submodules, modelli
