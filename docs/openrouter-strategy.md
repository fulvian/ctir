# OpenRouter Multi-Model Strategy

## Panoramica

CTIR implementa una strategia multi-modello basata su **Sonnet 4 + OpenRouter** che combina il modello principale di Claude Code con modelli specializzati gratuiti disponibili su OpenRouter.

## Architettura

### Modello Principale: Sonnet 4
- **Ruolo**: Modello principale per task complessi e general-purpose
- **Trigger**: `complexity > 0.6` + finestra 5h disponibile
- **Vantaggi**: Integrazione nativa, performance superiori, contesto completo
- **Limitazioni**: Finestre 5h, rate limits

### Modelli OpenRouter Specializzati

#### 1. Qwen3-Coder-480B-A35B - Technical Lead & Architecture
- **Modello**: `qwen/qwen3-coder-480b-a35b-instruct`
- **Ruolo**: Progettazione sistemi complessi, code review architetturale
- **Trigger**: `category = ARCHITECTURE_DESIGN` + `complexity > 0.7`
- **Configurazione**: 8192 tokens, temperature 0.1

#### 2. OpenAI GPT-OSS-120B - Rapid Prototyping Specialist
- **Modello**: `openai/gpt-oss-120b`
- **Ruolo**: Sviluppo iterativo rapido, debugging real-time
- **Trigger**: `category = SIMPLE_DEBUG/INTEGRATION_WORK` + `complexity 0.3-0.6`
- **Configurazione**: 4096 tokens, temperature 0.2

#### 3. Google Gemini 2.5 Pro Experimental - Problem Solver & Research
- **Modello**: `google/gemini-2.5-pro-experimental`
- **Ruolo**: Risoluzione problemi complessi, ragionamento multi-step
- **Trigger**: `domainKnowledge > 3` + `complexity > 0.5`
- **Configurazione**: 8192 tokens, temperature 0.1

#### 4. Qwen2.5-Coder-32B-Instruct - Multi-Language Developer
- **Modello**: `qwen/qwen2.5-coder-32b-instruct`
- **Ruolo**: Sviluppo cross-platform, manutenzione legacy code
- **Trigger**: `category = REFACTORING_MINOR/CODE_FORMATTING` + `complexity < 0.4`
- **Configurazione**: 4096 tokens, temperature 0.15

#### 5. Agentica DeepCoder-14B-Preview - Efficiency Champion
- **Modello**: `agentica-org/deepcoder-14b-preview`
- **Ruolo**: Ottimizzazione algoritmi, competitive programming
- **Trigger**: `category = PERFORMANCE_OPT` + `complexity < 0.3`
- **Configurazione**: 2048 tokens, temperature 0.05

## Logica di Routing

### Priorità 1: Sonnet 4 (Modello Principale)
```typescript
if (!localOnlyMode && complexity > 0.6) {
  return { strategy: "claude_direct" };
}
```

### Priorità 2: OpenRouter per Task Specializzati
```typescript
// Performance optimization
if (category === PERFORMANCE_OPT && complexity < 0.3) {
  return { strategy: "openrouter_efficiency" };
}

// Multi-language/Legacy maintenance
if ([REFACTORING_MINOR, CODE_FORMATTING].includes(category) && complexity < 0.4) {
  return { strategy: "openrouter_multilang" };
}

// Rapid prototyping/Debugging
if ([SIMPLE_DEBUG, INTEGRATION_WORK].includes(category) && complexity 0.3-0.6) {
  return { strategy: "openrouter_prototyping" };
}

// Research/Complex problems
if (domainKnowledge > 3 && complexity > 0.5) {
  return { strategy: "openrouter_research" };
}

// Architecture design
if (category === ARCHITECTURE_DESIGN && complexity > 0.7) {
  return { strategy: "openrouter_technical" };
}
```

### Priorità 3: Fallback quando Sonnet 4 non disponibile
```typescript
if (localOnlyMode) {
  if (openRouterAvailable && openRouterCreditAvailable) {
    // Usa il modello OpenRouter più adatto alla complessità
    if (complexity > 0.7) return { strategy: "openrouter_technical" };
    if (complexity > 0.5) return { strategy: "openrouter_research" };
    return { strategy: "openrouter_prototyping" };
  }
  
  // Fallback a CCR locale o MCP
  // ...
}
```

## Configurazione

### Variabili d'Ambiente
```bash
# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_DAILY_REQ_LIMIT=1000
CTIR_RATE_LIMIT_BUFFER=0.8
```

### Configurazione JSON
```json
{
  "integrations": {
    "openrouter": {
      "enabled": true,
      "primary": true,
      "models": {
        "technical": "qwen/qwen3-coder-480b-a35b-instruct",
        "prototyping": "openai/gpt-oss-120b",
        "research": "google/gemini-2.5-pro-experimental",
        "multilang": "qwen/qwen2.5-coder-32b-instruct",
        "efficiency": "agentica-org/deepcoder-14b-preview"
      },
      "fallback": {
        "enabled": true,
        "priority": ["technical", "research", "prototyping"]
      }
    }
  }
}
```

## Vantaggi della Strategia

### 1. **Specializzazione**
- Ogni modello è ottimizzato per specifici tipi di task
- Performance superiori per task specializzati
- Riduzione del costo computazionale

### 2. **Flessibilità**
- Accesso unificato a modelli gratuiti
- Fallback intelligente quando Sonnet 4 non disponibile
- Configurazione granulare per ogni modello

### 3. **Robustezza**
- Circuit breaker pattern per resilienza API
- Tracking usage e credit management
- Fallback multipli (OpenRouter → CCR → MCP)

### 4. **Costo-Efficienza**
- Utilizzo di modelli gratuiti per task specializzati
- Ottimizzazione basata sulla complessità del task
- Riduzione dipendenza da modelli locali

## Monitoraggio e Debugging

### Health Check
```typescript
const openRouter = new OpenRouterIntegration();
const isHealthy = await openRouter.healthCheck();
const hasCredit = openRouter.isCreditAvailable();
```

### Usage Tracking
- Tracking giornaliero per modello
- File JSON in `local-development/backups/openrouter-usage-YYYYMMDD.json`
- Reset automatico giornaliero

### Circuit Breaker
- Stato: CLOSED → OPEN → HALF_OPEN
- Threshold: 3 fallimenti consecutivi
- Timeout: 30 secondi per reset

## Migrazione da Gemini

La migrazione da Gemini a OpenRouter è **trasparente**:
- Gemini integration mantenuta per compatibilità
- Routing logic aggiornata per usare OpenRouter
- Configurazione esistente preservata
- Fallback automatico se OpenRouter non disponibile

## Best Practices

1. **Configurare API Key**: Impostare `OPENROUTER_API_KEY` in `.env`
2. **Monitorare Credits**: Verificare `OPENROUTER_DAILY_REQ_LIMIT`
3. **Testare Health**: Usare `openRouter.healthCheck()` per verificare disponibilità
4. **Fallback Strategy**: Mantenere CCR/MCP come ultimo fallback
5. **Usage Tracking**: Monitorare file di usage per ottimizzare costi
