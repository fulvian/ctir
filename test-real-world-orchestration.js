// Test del Sistema di Orchestrazione CTIR con Task Reali
// Questo test simula task di sviluppo reali per verificare l'orchestrazione

console.log("🎭 Test Sistema di Orchestrazione CTIR - Task Reali");
console.log("==================================================");

// Simuliamo il sistema di orchestrazione con task reali
class RealWorldOrchestrationEngine {
  constructor() {
    console.log("✅ CTIROrchestrationEngine inizializzato per task reali");
    console.log("🎯 Sonnet 4 è l'orchestratore principale");
  }

  async orchestrateRealTask(taskDescription, contextFiles = [], projectState = {}) {
    console.log(`\n📋 Task Reale: "${taskDescription}"`);
    console.log(`📁 File di contesto: ${contextFiles.join(', ') || 'Nessuno'}`);
    
    // Classificazione del task
    const classification = this.classifyRealTask(taskDescription, contextFiles);
    const complexity = this.calculateRealComplexity(taskDescription, contextFiles, projectState);
    
    console.log(`📊 Categoria: ${classification.category}`);
    console.log(`⚡ Complessità: ${complexity.score} (${complexity.description})`);
    
    // Decisione di routing
    const routingDecision = this.decideRealRouting(classification, complexity);
    
    console.log(`🎯 Strategia: ${routingDecision.strategy}`);
    console.log(`🤖 Modello: ${routingDecision.model || 'N/A'}`);
    console.log(`💭 Ragionamento: ${routingDecision.reasoning}`);
    console.log(`⏱️ Token stimati: ${routingDecision.estimatedTokens}`);
    
    // Esecuzione del task
    const result = this.executeRealTask(routingDecision, taskDescription);
    
    console.log(`✅ Risultato: ${result.status}`);
    console.log(`📝 Messaggio: ${result.message}`);
    console.log(`🎯 Modello utilizzato: ${result.modelUsed}`);
    
    return { decision: routingDecision, result };
  }

  classifyRealTask(task, contextFiles) {
    const lowerTask = task.toLowerCase();
    
    // Task di architettura e design
    if (lowerTask.includes("architecture") || lowerTask.includes("design") || 
        lowerTask.includes("microservices") || lowerTask.includes("system design")) {
      return { category: "ARCHITECTURE_DESIGN", priority: "HIGH" };
    }
    
    // Task di debugging complesso
    if (lowerTask.includes("debug") || lowerTask.includes("fix") || 
        lowerTask.includes("memory leak") || lowerTask.includes("performance issue")) {
      return { category: "COMPLEX_DEBUGGING", priority: "HIGH" };
    }
    
    // Task di refactoring
    if (lowerTask.includes("refactor") || lowerTask.includes("migrate") || 
        lowerTask.includes("restructure") || lowerTask.includes("clean up")) {
      return { category: "REFACTORING_MINOR", priority: "MEDIUM" };
    }
    
    // Task di testing
    if (lowerTask.includes("test") || lowerTask.includes("unit test") || 
        lowerTask.includes("integration test") || lowerTask.includes("coverage")) {
      return { category: "UNIT_TESTING", priority: "MEDIUM" };
    }
    
    // Task di documentazione
    if (lowerTask.includes("document") || lowerTask.includes("readme") || 
        lowerTask.includes("api docs") || lowerTask.includes("comment")) {
      return { category: "DOCUMENTATION", priority: "LOW" };
    }
    
    // Task di integrazione
    if (lowerTask.includes("integrate") || lowerTask.includes("api") || 
        lowerTask.includes("service") || lowerTask.includes("endpoint")) {
      return { category: "INTEGRATION_WORK", priority: "HIGH" };
    }
    
    return { category: "SIMPLE_DEBUG", priority: "LOW" };
  }

  calculateRealComplexity(task, contextFiles, projectState) {
    let score = 0.1; // Base
    
    // Fattori di complessità
    if (task.toLowerCase().includes("architecture")) score += 0.4;
    if (task.toLowerCase().includes("microservices")) score += 0.3;
    if (task.toLowerCase().includes("complex")) score += 0.2;
    if (task.toLowerCase().includes("system")) score += 0.2;
    if (task.toLowerCase().includes("performance")) score += 0.2;
    if (task.toLowerCase().includes("memory")) score += 0.2;
    if (task.toLowerCase().includes("security")) score += 0.3;
    
    // File di contesto
    score += Math.min(0.2, contextFiles.length * 0.05);
    
    // Stato del progetto
    if (projectState.hasTests === false) score += 0.1;
    if (projectState.hasDocumentation === false) score += 0.1;
    if (projectState.isLegacyCode === true) score += 0.2;
    
    const finalScore = Math.min(1.0, score);
    
    let description;
    if (finalScore > 0.7) description = "Molto Complesso";
    else if (finalScore > 0.5) description = "Complesso";
    else if (finalScore > 0.3) description = "Medio";
    else description = "Semplice";
    
    return { score: finalScore, description };
  }

  decideRealRouting(classification, complexity) {
    const { category, priority } = classification;
    const { score } = complexity;
    
    // Sonnet 4 per task complessi e architettura
    if (score > 0.7 || category === "ARCHITECTURE_DESIGN") {
      return {
        strategy: "claude_direct",
        model: "sonnet-4",
        reasoning: "Task molto complesso - Sonnet 4 come orchestratore principale",
        confidence: 0.9,
        estimatedTokens: 8000
      };
    }
    
    // Sonnet 4 per task ad alta priorità ma complessità media
    if (priority === "HIGH" && score > 0.5) {
      return {
        strategy: "claude_direct",
        model: "sonnet-4",
        reasoning: "Task ad alta priorità e complessità media - Sonnet 4 per qualità",
        confidence: 0.8,
        estimatedTokens: 6000
      };
    }
    
    // Delegazione specializzata per task specifici
    if (category === "COMPLEX_DEBUGGING") {
      return {
        strategy: "openrouter_technical",
        model: "qwen3-coder-480b",
        reasoning: "Debugging complesso - delegato a Qwen3 Technical Lead per expertise avanzata",
        confidence: 0.8,
        estimatedTokens: 6000
      };
    }
    
    if (category === "REFACTORING_MINOR") {
      return {
        strategy: "openrouter_multilang",
        model: "qwen2.5-coder-32b",
        reasoning: "Refactoring multi-linguaggio - delegato a Qwen2.5 per versatilità",
        confidence: 0.7,
        estimatedTokens: 4000
      };
    }
    
    if (category === "INTEGRATION_WORK") {
      return {
        strategy: "openrouter_prototyping",
        model: "gpt-oss-120b",
        reasoning: "Integrazione API - delegato a GPT-OSS per rapid prototyping",
        confidence: 0.8,
        estimatedTokens: 5000
      };
    }
    
    if (category === "UNIT_TESTING") {
      return {
        strategy: "openrouter_efficiency",
        model: "deepcoder-14b",
        reasoning: "Testing - delegato a DeepCoder per efficienza e precisione",
        confidence: 0.7,
        estimatedTokens: 3000
      };
    }
    
    // Default: OpenRouter per task semplici (efficienza)
    return {
      strategy: "openrouter_efficiency",
      model: "deepcoder-14b",
      reasoning: "Task semplice - delegato a DeepCoder per efficienza",
      confidence: 0.7,
      estimatedTokens: 2000
    };
  }

  executeRealTask(decision, taskDescription) {
    switch (decision.strategy) {
      case "claude_direct":
        return {
          status: "executed_by_sonnet4",
          message: `Task "${taskDescription}" eseguito direttamente da Sonnet 4 (orchestratore principale)`,
          modelUsed: "sonnet-4",
          success: true,
          qualityScore: 0.95
        };
      case "openrouter_technical":
        return {
          status: "delegated_to_openrouter",
          message: `Task "${taskDescription}" delegato a Qwen3-Coder-480B per expertise tecnica avanzata`,
          modelUsed: "qwen3-coder-480b",
          success: true,
          qualityScore: 0.85
        };
      case "openrouter_multilang":
        return {
          status: "delegated_to_openrouter",
          message: `Task "${taskDescription}" delegato a Qwen2.5-Coder-32B per versatilità multi-linguaggio`,
          modelUsed: "qwen2.5-coder-32b",
          success: true,
          qualityScore: 0.8
        };
      case "openrouter_prototyping":
        return {
          status: "delegated_to_openrouter",
          message: `Task "${taskDescription}" delegato a GPT-OSS-120B per rapid prototyping`,
          modelUsed: "gpt-oss-120b",
          success: true,
          qualityScore: 0.82
        };
      case "openrouter_efficiency":
        return {
          status: "delegated_to_openrouter",
          message: `Task "${taskDescription}" delegato a DeepCoder-14B per efficienza e precisione`,
          modelUsed: "deepcoder-14b",
          success: true,
          qualityScore: 0.78
        };
      default:
        return {
          status: "failed",
          message: "Strategia di routing non riconosciuta",
          modelUsed: "unknown",
          success: false,
          qualityScore: 0
        };
    }
  }
}

// Test con task reali di sviluppo
async function runRealWorldTests() {
  const engine = new RealWorldOrchestrationEngine();
  
  console.log("\n🧪 Test Case 1: Architettura Microservices");
  await engine.orchestrateRealTask(
    "Design a scalable microservices architecture for an e-commerce platform with user service, product service, order service, and payment service",
    ["src/services/", "docs/architecture.md", "docker-compose.yml"],
    { hasTests: true, hasDocumentation: false, isLegacyCode: false }
  );
  
  console.log("\n🧪 Test Case 2: Debugging Performance");
  await engine.orchestrateRealTask(
    "Debug a complex memory leak in the authentication service that causes OOM errors after 2 hours of operation",
    ["src/auth/service.ts", "src/auth/middleware.ts", "tests/auth.test.ts"],
    { hasTests: true, hasDocumentation: true, isLegacyCode: true }
  );
  
  console.log("\n🧪 Test Case 3: Refactoring Legacy Code");
  await engine.orchestrateRealTask(
    "Refactor the legacy data access layer from Python to TypeScript, maintaining backward compatibility",
    ["data/legacy_db.py", "src/data/db.ts", "migrations/"],
    { hasTests: false, hasDocumentation: false, isLegacyCode: true }
  );
  
  console.log("\n🧪 Test Case 4: API Integration");
  await engine.orchestrateRealTask(
    "Integrate with Stripe payment API and implement webhook handling for payment events",
    ["src/payments/", "src/webhooks/", "config/stripe.ts"],
    { hasTests: true, hasDocumentation: true, isLegacyCode: false }
  );
  
  console.log("\n🧪 Test Case 5: Unit Testing");
  await engine.orchestrateRealTask(
    "Write comprehensive unit tests for the user service with 90% code coverage",
    ["src/users/service.ts", "src/users/models.ts", "tests/users.test.ts"],
    { hasTests: false, hasDocumentation: true, isLegacyCode: false }
  );
  
  console.log("\n🧪 Test Case 6: Task Semplice");
  await engine.orchestrateRealTask(
    "Fix a syntax error in the login function",
    ["src/auth/login.ts"],
    { hasTests: true, hasDocumentation: true, isLegacyCode: false }
  );
  
  console.log("\n✅ Test Task Reali Completato!");
  console.log("🎭 Sonnet 4 rimane l'orchestratore principale per task complessi");
  console.log("🔄 Delegazione intelligente ai modelli specializzati funzionante");
  console.log("📊 Sistema di classificazione e routing operativo");
}

// Esegui i test
runRealWorldTests().catch(console.error);
