# Piano Completo per "Claude Task Intelligence Router" (CTIR)

## 1. Analisi dei Requisiti e Obiettivi

### Obiettivi Primari

- **Conservazione token Claude Code**: Preservare i limiti stringenti del piano Pro (finestre di 5 ore)
- **Delegazione intelligente**: Automatizzare il routing di task semplici verso modelli locali 7B
- **Seamless integration**: Mantenere l'esperienza utente fluida senza comandi manuali
- **Performance optimization**: Ottimizzare per MacBook Pro 16GB con modelli fino a 7B parametri


### Requisiti Funzionali

- Classificazione automatica dei task per complessità e tipo
- Routing intelligente tra Claude Code, CCR e MCP server locali
- Integrazione con cc-sessions per gestione stato e memoria
- Monitoraggio utilizzo token in tempo reale
- Fallback automatico tra modalità operative
- Supporto multi-modello per specializzazioni diverse


### Requisiti Non Funzionali

- **Latenza**: < 2s per decisioni di routing
- **Memory footprint**: < 1GB RAM aggiuntiva
- **Compatibilità**: macOS con Apple Silicon
- **Reliability**: 99% uptime per servizi locali


## 2. Architettura del Sistema

### Schema Architetturale

```
┌─────────────────────────────────────────────────────────────┐
│                    CTIR (Main Controller)                   │
├─────────────────────────────────────────────────────────────┤
│  Task Intelligence Engine  │  Routing Decision Engine       │
│  - NLP Classifier          │  - Token Budget Monitor        │
│  - Complexity Analyzer     │  - Performance Tracker         │
│  - Context Analyzer        │  - Fallback Controller         │
└─────────┬───────────────────┬───────────────────┬───────────┘
          │                   │                   │
┌─────────▼─────────┐ ┌───────▼───────┐ ┌─────────▼─────────┐
│   cc-sessions     │ │      CCR      │ │   MCP Local       │
│   Integration     │ │  Integration  │ │    Server         │
└───────────────────┘ └───────────────┘ └───────────────────┘
          │                   │                   │
┌─────────▼─────────┐ ┌───────▼───────┐ ┌─────────▼─────────┐
│  Task Management  │ │ Local Models  │ │  Specialized      │
│  Context Control  │ │ (Ollama)      │ │  Tools & APIs     │
└───────────────────┘ └───────────────┘ └───────────────────┘
```


### Componenti Principali

#### A. CTIR Core Engine

**Responsabilità**: Orchestrazione centrale e decision making
**Tecnologie**: Node.js/TypeScript, SQLite per stato persistente
**Interfacce**: WebSocket per comunicazione real-time, REST API per configurazione

#### B. Task Intelligence Engine

**Responsabilità**: Analisi e classificazione prompt in ingresso
**Algoritmi**:

- Keyword-based classification per velocità
- Heuristic complexity scoring
- Context window analysis


#### C. Routing Decision Engine

**Responsabilità**: Selezione strategia ottimale per ogni task
**Metriche**: Token budget, task complexity, session history, model availability

## 3. Specifiche Tecniche Dettagliate

### 3.1 Task Classification System

#### Task Categories

```typescript
enum TaskCategory {
  SIMPLE_DEBUG = "simple_debug",           // Bug fixes, syntax errors
  CODE_FORMATTING = "code_formatting",     // Prettier, linting
  UNIT_TESTING = "unit_testing",          // Test generation
  DOCUMENTATION = "documentation",         // Comments, README
  REFACTORING_MINOR = "refactoring_minor", // Small improvements
  ARCHITECTURE_DESIGN = "architecture",    // Complex planning
  COMPLEX_DEBUGGING = "complex_debug",     // Multi-file issues
  INTEGRATION_WORK = "integration",        // API integrations
  PERFORMANCE_OPT = "performance"          // Optimization work
}
```


#### Complexity Scoring Algorithm

```typescript
interface TaskComplexityScore {
  readonly fileCount: number;          // Files involved (weight: 0.3)
  readonly lineCount: number;          // Lines of code (weight: 0.2)  
  readonly contextDeps: number;        // Context dependencies (weight: 0.25)
  readonly domainKnowledge: number;    // Specialized knowledge required (weight: 0.25)
  readonly totalScore: number;         // 0-1 scale
}

function calculateComplexity(prompt: string, context: SessionContext): TaskComplexityScore {
  // Implementation details for scoring algorithm
}
```


### 3.2 Routing Decision Matrix

#### Decision Rules

```typescript
interface RoutingDecision {
  strategy: 'claude_direct' | 'ccr_local' | 'mcp_delegate';
  model?: string;
  confidence: number;
  reasoning: string;
}

const ROUTING_RULES = {
  // High complexity or low token budget -> Claude direct
  claude_direct: (score: TaskComplexityScore, budget: TokenBudget) => 
    score.totalScore > 0.7 || budget.remaining < 0.1,
    
  // Simple repetitive tasks -> CCR local
  ccr_local: (score: TaskComplexityScore, category: TaskCategory) =>
    score.totalScore < 0.3 && 
    [TaskCategory.SIMPLE_DEBUG, TaskCategory.CODE_FORMATTING].includes(category),
    
  // Specialized but medium complexity -> MCP delegate  
  mcp_delegate: (score: TaskComplexityScore, category: TaskCategory) =>
    score.totalScore < 0.6 && 
    [TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION].includes(category)
};
```


### 3.3 Model Specialization Map

#### Local Model Configuration

```typescript
const LOCAL_MODELS = {
  'code-debug': {
    model: 'qwen2.5-coder:7b',
    specialties: ['debugging', 'error_analysis', 'syntax_fixes'],
    maxTokens: 4096,
    temperature: 0.1
  },
  'code-generation': {
    model: 'qwen2.5-coder:7b', 
    specialties: ['unit_tests', 'boilerplate', 'documentation'],
    maxTokens: 8192,
    temperature: 0.3
  },
  'code-formatting': {
    model: 'qwen2.5-coder:7b',
    specialties: ['formatting', 'linting', 'style_fixes'],
    maxTokens: 2048,
    temperature: 0.0
  }
};
```


## 4. Integrazione con Componenti Esistenti

### 4.1 cc-sessions Integration

#### Extended Session Management

```typescript
interface CTIRSession extends CCSession {
  routingHistory: RoutingDecision[];
  tokenBudget: TokenBudget;
  modelPerformanceMetrics: ModelMetrics[];
  contextWindow: ContextWindow;
  
  // New methods
  updateRoutingDecision(decision: RoutingDecision): void;
  getOptimalStrategy(): RoutingStrategy;
  consolidateContext(): Promise<void>;
}
```


#### Task File Enhancement

Estendere i task file di cc-sessions con routing metadata:

```yaml
# task-001.yml (enhanced)
task_id: "task-001"
description: "Fix authentication bug in user service"
success_criteria:
  - "Unit tests pass"
  - "No authentication errors"
services_involved: ["auth-service", "user-api"]

# CTIR additions
routing_metadata:
  complexity_score: 0.65
  estimated_tokens: 1500
  recommended_strategy: "mcp_delegate"
  fallback_strategy: "claude_direct"
  specialized_model: "code-debug"
```


### 4.2 CCR Integration

#### Enhanced Model Switching

```typescript
class CTIRCCRController {
  async intelligentSwitch(decision: RoutingDecision): Promise<void> {
    if (decision.strategy === 'ccr_local') {
      await this.ccr.switchModel(decision.model);
      await this.setupLocalModelContext(decision);
    }
  }
  
  private async setupLocalModelContext(decision: RoutingDecision): Promise<void> {
    // Prepare context for local model
    // Inject relevant documentation from context7
    // Set appropriate system prompts
  }
}
```


### 4.3 MCP Server Architecture

#### Specialized MCP Servers

```typescript
// mcp-code-debug-server
class CodeDebugMCPServer implements MCPServer {
  tools = [
    'analyze_error',
    'suggest_fix', 
    'generate_test_case',
    'validate_solution'
  ];
  
  async analyzeError(code: string, error: string): Promise<Analysis> {
    return this.localModel.analyze({
      prompt: `Analyze this error: ${error}\nIn code: ${code}`,
      model: 'qwen2.5-coder:7b'
    });
  }
}

// mcp-test-generation-server  
class TestGenerationMCPServer implements MCPServer {
  tools = [
    'generate_unit_tests',
    'generate_integration_tests',
    'suggest_test_cases',
    'validate_test_coverage'
  ];
}
```


## 5. Implementazione per Fasi

### Fase 1: Core Infrastructure (Settimane 1-2)

#### Deliverables

- [ ] CTIR core engine setup
- [ ] Basic task classification (keyword-based)
- [ ] SQLite database schema per stato persistente
- [ ] WebSocket communication layer
- [ ] Basic routing decision engine


#### Technical Tasks

```bash
# Project structure
ctir/
├── src/
│   ├── core/
│   │   ├── engine.ts
│   │   ├── classifier.ts
│   │   └── router.ts
│   ├── integrations/
│   │   ├── cc-sessions.ts
│   │   ├── ccr.ts
│   │   └── mcp.ts
│   ├── models/
│   │   ├── task.ts
│   │   ├── session.ts
│   │   └── routing.ts
│   └── utils/
│       ├── logger.ts
│       └── config.ts
├── config/
│   ├── models.json
│   ├── routing-rules.json
│   └── default.json
└── tests/
    ├── unit/
    └── integration/
```


### Fase 2: cc-sessions Integration (Settimane 3-4)

#### Deliverables

- [ ] Estensione cc-sessions con CTIR metadata
- [ ] Enhanced task file format
- [ ] Session state synchronization
- [ ] Context window management
- [ ] Token budget monitoring


#### Implementation Details

```typescript
// Enhanced cc-sessions integration
class CTIRSessionManager extends CCSessionManager {
  async createEnhancedTask(
    description: string, 
    context: ProjectContext
  ): Promise<CTIRTask> {
    const baseTask = await super.createTask(description);
    const complexityScore = this.classifier.analyze(description, context);
    const routingDecision = this.router.decide(complexityScore);
    
    return {
      ...baseTask,
      routing_metadata: {
        complexity_score: complexityScore.totalScore,
        recommended_strategy: routingDecision.strategy,
        specialized_model: routingDecision.model,
        estimated_tokens: this.estimateTokenUsage(description, context)
      }
    };
  }
}
```


### Fase 3: Local Model Integration (Settimane 5-6)

#### Deliverables

- [ ] Ollama integration layer
- [ ] Model download e setup automatico
- [ ] MCP server framework
- [ ] Specialized MCP servers (debug, testing, formatting)
- [ ] Model performance monitoring


#### Setup Script

```bash
#!/bin/bash
# setup-local-models.sh

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
  curl -fsSL https://ollama.ai/install.sh | sh
fi

# Pull required models
ollama pull qwen2.5-coder:7b

# Start CTIR MCP servers
node dist/mcp-servers/code-debug-server.js &
node dist/mcp-servers/test-generation-server.js &
node dist/mcp-servers/formatting-server.js &

echo "Local models setup complete"
```


### Fase 4: CCR Integration e Advanced Routing (Settimane 7-8)

#### Deliverables

- [ ] CCR controller integration
- [ ] Advanced routing algorithms
- [ ] Performance-based model selection
- [ ] Fallback mechanisms
- [ ] Real-time decision adjustment


#### Advanced Routing Logic

```typescript
class AdvancedRoutingEngine {
  async decideWithContext(
    task: CTIRTask,
    session: CTIRSession,
    realTimeMetrics: RealTimeMetrics
  ): Promise<RoutingDecision> {
    
    // Multi-factor decision making
    const factors = {
      complexity: this.assessComplexity(task),
      tokenBudget: session.tokenBudget.remaining,
      modelAvailability: await this.checkModelHealth(),
      historicalPerformance: this.getHistoricalPerformance(task.category),
      contextSize: session.contextWindow.size,
      userPreferences: session.userPreferences
    };
    
    // Weight-based scoring
    const scores = {
      claude_direct: this.calculateClaudeScore(factors),
      ccr_local: this.calculateCCRScore(factors),  
      mcp_delegate: this.calculateMCPScore(factors)
    };
    
    const bestStrategy = Object.keys(scores)
      .reduce((a, b) => scores[a] > scores[b] ? a : b);
      
    return {
      strategy: bestStrategy as RoutingStrategy,
      confidence: scores[bestStrategy],
      reasoning: this.explainDecision(factors, scores),
      model: this.selectOptimalModel(bestStrategy, task.category)
    };
  }
}
```


### Fase 5: Testing e Optimization (Settimane 9-10)

#### Deliverables

- [ ] Comprehensive test suite
- [ ] Performance benchmarks
- [ ] Memory usage optimization
- [ ] Error handling e recovery
- [ ] Documentation completa


#### Test Coverage

```typescript
describe('CTIR Integration Tests', () => {
  describe('Task Classification', () => {
    it('should classify simple debug tasks correctly');
    it('should handle edge cases in complexity scoring');
    it('should adapt to user feedback');
  });
  
  describe('Routing Decisions', () => {
    it('should route simple tasks to local models');
    it('should keep complex tasks on Claude Code');
    it('should handle model unavailability gracefully');
  });
  
  describe('Token Budget Management', () => {
    it('should preserve Claude tokens for critical tasks');
    it('should switch to aggressive local routing when budget low');
  });
});
```


## 6. Configurazione e Setup

### 6.1 Configuration Files

#### Main Configuration

```json
{
  "ctir": {
    "version": "1.0.0",
    "mode": "production",
    "tokenBudget": {
      "conservativeThreshold": 0.75,
      "aggressiveThreshold": 0.90,
      "criticalThreshold": 0.95
    },
    "models": {
      "localModelsPath": "/Users/[username]/.ollama/models",
      "defaultDebugModel": "qwen2.5-coder:7b",
      "defaultGenerationModel": "qwen2.5-coder:7b",
      "defaultFormattingModel": "qwen2.5-coder:7b"
    },
    "performance": {
      "maxLatency": 2000,
      "maxMemoryUsage": "1GB",
      "enableCaching": true,
      "cacheSize": "256MB"
    },
    "integrations": {
      "ccSessions": {
        "enabled": true,
        "enhancedTaskFiles": true
      },
      "ccr": {
        "enabled": true,
        "autoSwitch": true
      },
      "mcp": {
        "enabled": true,
        "servers": [
          "code-debug-server",
          "test-generation-server", 
          "formatting-server"
        ]
      }
    }
  }
}
```


### 6.2 Installation Script

```bash
#!/bin/bash
# install-ctir.sh

set -e

echo "Installing Claude Task Intelligence Router (CTIR)..."

# Check system requirements
echo "Checking system requirements..."
if [[ $(uname -m) != "arm64" ]]; then
  echo "Warning: CTIR is optimized for Apple Silicon Macs"
fi

# Install dependencies
echo "Installing Node.js dependencies..."
npm install -g typescript ts-node
npm install

# Setup Ollama and models
echo "Setting up local models..."
if ! command -v ollama &> /dev/null; then
  curl -fsSL https://ollama.ai/install.sh | sh
fi

# Download required models (in background to save time)
ollama pull qwen2.5-coder:7b &

# Build CTIR
echo "Building CTIR..."
npm run build

# Setup database
echo "Setting up database..."
node dist/scripts/setup-database.js

# Create systemd/launchd service for auto-start
echo "Setting up system service..."
node dist/scripts/setup-service.js

wait # Wait for model downloads
echo "CTIR installation complete!"
echo "Run 'ctir start' to begin using the system."
```


## 7. Monitoring e Analytics

### 7.1 Performance Metrics

```typescript
interface CTIRMetrics {
  tokenSavings: {
    claudeTokensSaved: number;
    localTokensUsed: number;
    savingsPercentage: number;
  };
  routingAccuracy: {
    correctDecisions: number;
    totalDecisions: number;
    accuracyRate: number;
  };
  modelPerformance: {
    [modelName: string]: {
      averageLatency: number;
      successRate: number;
      qualityScore: number;
    };
  };
  systemHealth: {
    memoryUsage: number;
    cpuUsage: number;
    diskSpace: number;
  };
}
```


### 7.2 Dashboard e Reporting

- Real-time token usage visualization
- Model performance comparisons
- Task classification accuracy
- System resource utilization
- Cost savings calculations


## 8. Roadmap Futuro

### Versione 1.1 (3 mesi post-release)

- [ ] Machine learning per task classification
- [ ] User preference learning
- [ ] Multi-project context awareness
- [ ] Advanced caching strategies


### Versione 1.2 (6 mesi post-release)

- [ ] Support per modelli > 7B su hardware più potente
- [ ] Integration con più MCP servers
- [ ] API pubblica per estensioni
- [ ] Cloud sync per configurazioni


### Versione 2.0 (12 mesi post-release)

- [ ] Multi-user support
- [ ] Team collaboration features
- [ ] Advanced analytics e insights
- [ ] Plugin ecosystem

Questo piano fornisce a Claude Code una roadmap completa e dettagliata per implementare il sistema CTIR, integrando efficacemente cc-sessions, CCR e MCP server locali per ottimizzare l'utilizzo dei token di Claude Code Pro.
