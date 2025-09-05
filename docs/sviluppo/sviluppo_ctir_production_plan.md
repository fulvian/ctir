# Piano di Sviluppo CTIR per la Produzione

Questo documento delinea un piano di sviluppo strutturato per portare CTIR a una versione di produzione stabile, sicura e osservabile, basandosi sull'analisi dello stato attuale e sulle criticità identificate.

### Analisi della Situazione

1.  **Punti di Forza Raggiunti**:
    *   **Architettura Modulare**: L'idea di usare contratti (`src/integrations/contracts/*`) e adapter è solida e ha permesso un'integrazione funzionale.
    *   **Logica di Fallback**: La catena di fallback (Claude → Gemini → CCR/MCP) è la spina dorsale del sistema e funziona come previsto.
    *   **Auto-Resume**: Il meccanismo di tracciamento e ripristino delle sessioni è una feature strategica.
    *   **Infrastruttura di Base**: Build, setup, script e gestione dei submodules sono ben strutturati.

2.  **Debolezze da Risolvere (in ordine di priorità)**:
    *   **Instabilità (Criticità #1)**: L'oscillazione del monitoraggio è il problema più grave, rendendo i log inservibili e mascherando problemi reali.
    *   **Mancanza di Resilienza (Criticità #2)**: L'assenza di un Circuit Breaker per Gemini espone il sistema a fallimenti a catena.
    *   **Scarsa Osservabilità**: Log verbosi e assenza di metriche strutturate impediscono un monitoraggio efficiente.

---

### Piano di Sviluppo Proposto

#### **Fase 1: Stabilizzazione e Resilienza (1-2 settimane)**

**Obiettivo**: Risolvere i problemi bloccanti che impediscono un deployment affidabile.

1.  **Stabilizzazione del Monitoraggio Sessioni Claude (`claude-monitor.ts`)**
    *   **Stato: Completato e Verificato.**
    *   **Problema**: Sensibilità eccessiva e metodo di rilevamento inaffidabile.
    *   **Azione**: Riprogettato il sistema per leggere l'orario di reset esatto dal messaggio di limite della CLI, usando un timer preciso (`setTimeout`) invece di un polling generico. Questo risolve l'instabilità alla radice.

2.  **Implementazione del Circuit Breaker per Gemini (`gemini.ts`)**
    *   **Stato: Completato.**
    *   **Problema**: Chiamate ripetute a un'API esterna instabile.
    *   **Azione**: Integrato un pattern Circuit Breaker per sospendere le chiamate a Gemini dopo fallimenti ripetuti, migliorando la resilienza del sistema.

---

#### **Fase 2: Production Hardening (1 mese)**

**Obiettivo**: Rendere il sistema osservabile, manutenibile e configurabile per l'ambiente di produzione.

1.  **Ottimizzazione del Logging (`logger.ts`)**
    *   **Stato: Completato.**
    *   **Azione**: Creato un logger strutturato JSON e sostituite le chiamate a `console.log` nei moduli principali per un'osservabilità superiore.

2.  **Creazione di un Endpoint di Metriche**
    *   **Stato: Completato.**
    *   **Azione**: Esposto un endpoint HTTP `/metrics` in formato Prometheus per monitorare metriche chiave come chiamate API, decisioni di routing e stato del circuit breaker.

3.  **Separazione delle Configurazioni di Ambiente**
    *   **Stato: Annullato.**
    *   **Azione**: Decisione presa di non implementare per mantenere la semplicità, gestendo le variazioni di comportamento tramite variabili d'ambiente.

---

#### **Fase 3: Miglioramenti Funzionali (Lungo Termine)**

**Obiettivo**: Implementare le feature opzionali e migliorare l'intelligenza del sistema.

1.  **Supporto Completo ai Modelli Gemini 2.5**
    *   **Azione**: Monitorare la libreria `@google/generative-ai` e valutare soluzioni alternative temporanee se necessario.

2.  **Routing Avanzato Basato su Costi**
    *   **Azione**: Raccogliere dati sui costi effettivi per implementare una logica di routing che ottimizzi il budget in modo più granulare.
