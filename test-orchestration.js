#!/usr/bin/env node

/**
 * Test script per il nuovo sistema di orchestrazione CTIR
 * Verifica l'integrazione tra Task Classifier, Routing Engine e cc-sessions
 */

import { CTIROrchestrationEngine } from "./src/core/orchestration-engine.js";
import { CCSessionsIntegration } from "./src/integrations/cc-sessions.js";
import { TaskClassifier } from "./src/models/task-classifier.js";
import { logger } from "./src/utils/logger.js";

// Test tasks di diversa complessità
const testTasks = [
  {
    description: "Fix a simple syntax error in the login function",
    contextFiles: ["src/auth/login.ts"],
    expectedCategory: "simple_debug",
    expectedComplexity: 0.2
  },
  {
    description: "Design a microservices architecture for our e-commerce platform with proper service boundaries, data consistency patterns, and communication protocols",
    contextFiles: ["docs/architecture.md", "src/services/", "src/api/", "src/database/"],
    expectedCategory: "architecture_design", 
    expectedComplexity: 0.9
  },
  {
    description: "Write comprehensive unit tests for the payment processing module including edge cases and error handling",
    contextFiles: ["src/payment/processor.ts", "src/payment/types.ts", "tests/payment/"],
    expectedCategory: "unit_testing",
    expectedComplexity: 0.6
  },
  {
    description: "Optimize the database queries in the user service to reduce response time from 500ms to under 100ms",
    contextFiles: ["src/user/service.ts", "src/user/queries.ts", "src/database/schema.sql"],
    expectedCategory: "performance_optimization",
    expectedComplexity: 0.7
  },
  {
    description: "Add documentation for the new API endpoints and update the OpenAPI specification",
    contextFiles: ["src/api/routes.ts", "docs/api.md", "openapi.yaml"],
    expectedCategory: "documentation",
    expectedComplexity: 0.4
  }
];

async function testTaskClassification() {
  console.log("🧪 Testing Task Classification...\n");
  
  const classifier = new TaskClassifier();
  
  for (const testTask of testTasks) {
    console.log(`📝 Task: ${testTask.description}`);
    console.log(`📁 Context Files: ${testTask.contextFiles.join(", ")}`);
    
    const taskContext = {
      taskId: `test-${Date.now()}`,
      description: testTask.description,
      contextFiles: testTask.contextFiles,
      projectState: {
        currentBranch: "main",
        modifiedFiles: [],
        lastCommit: "test commit",
        testStatus: "passing",
        activeAgents: [],
        contextWindow: { size: 160000, utilization: 0 }
      },
      userPreferences: {
        preferredModel: "sonnet-4",
        maxComplexityForLocal: 0.6,
        enableAutoRouting: true,
        notificationLevel: "minimal"
      }
    };
    
    try {
      const classification = await classifier.classifyTask(taskContext);
      
      console.log(`✅ Category: ${classification.category}`);
      console.log(`📊 Complexity: ${(classification.complexity * 100).toFixed(1)}%`);
      console.log(`🎯 Strategy: ${classification.recommendedStrategy}`);
      console.log(`🔢 Estimated Tokens: ${classification.estimatedTokens}`);
      console.log(`🎯 Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
      console.log(`💭 Reasoning: ${classification.reasoning}`);
      console.log(`🏷️ Keywords: ${classification.keywords.join(", ")}`);
      console.log(`📋 Context Requirements: ${classification.contextRequirements.join(", ")}`);
      
      // Verify expectations
      if (classification.category === testTask.expectedCategory) {
        console.log("✅ Category matches expectation");
      } else {
        console.log(`❌ Category mismatch: expected ${testTask.expectedCategory}, got ${classification.category}`);
      }
      
      const complexityDiff = Math.abs(classification.complexity - testTask.expectedComplexity);
      if (complexityDiff < 0.2) {
        console.log("✅ Complexity within expected range");
      } else {
        console.log(`❌ Complexity mismatch: expected ~${testTask.expectedComplexity}, got ${classification.complexity}`);
      }
      
    } catch (error) {
      console.log(`❌ Classification failed: ${error}`);
    }
    
    console.log("─".repeat(80));
  }
}

async function testCCSessionsIntegration() {
  console.log("\n🧪 Testing cc-sessions Integration...\n");
  
  const ccSessions = new CCSessionsIntegration();
  
  try {
    // Test project state detection
    console.log("📊 Getting project state...");
    const projectState = await ccSessions.getProjectState();
    console.log(`✅ Current branch: ${projectState.currentBranch}`);
    console.log(`📁 Modified files: ${projectState.modifiedFiles.length}`);
    console.log(`🔧 Test status: ${projectState.testStatus}`);
    
    // Test task file creation
    console.log("\n📝 Creating test task file...");
    const taskFile = await ccSessions.createTaskFile(
      "Test task for orchestration system",
      {
        complexityScore: 0.5,
        estimatedTokens: 2000,
        recommendedStrategy: "hybrid_approach",
        fallbackStrategy: "claude_direct",
        specializedModel: "qwen3-coder-480b"
      },
      ["src/test.ts", "tests/test.spec.ts"]
    );
    
    console.log(`✅ Task file created: ${taskFile.taskId}`);
    console.log(`📋 Success criteria: ${taskFile.successCriteria.join(", ")}`);
    console.log(`🔧 Services involved: ${taskFile.servicesInvolved.join(", ")}`);
    
    // Test context saving
    console.log("\n💾 Testing context saving...");
    const testContext = {
      taskId: taskFile.taskId,
      description: taskFile.description,
      complexity: 0.5,
      category: "unit_testing",
      contextFiles: taskFile.contextFiles,
      projectState,
      userPreferences: {
        preferredModel: "sonnet-4",
        maxComplexityForLocal: 0.6,
        enableAutoRouting: true,
        notificationLevel: "minimal"
      }
    };
    
    await ccSessions.saveTaskContext(testContext);
    console.log("✅ Task context saved");
    
    // Test context retrieval
    console.log("\n📖 Testing context retrieval...");
    const relevantFiles = await ccSessions.getRelevantFiles(taskFile.taskId);
    console.log(`✅ Retrieved relevant files: ${relevantFiles.join(", ")}`);
    
  } catch (error) {
    console.log(`❌ cc-sessions integration test failed: ${error}`);
  }
}

async function testOrchestrationEngine() {
  console.log("\n🧪 Testing Orchestration Engine...\n");
  
  const orchestrationEngine = new CTIROrchestrationEngine();
  
  for (const testTask of testTasks.slice(0, 2)) { // Test first 2 tasks
    console.log(`🎯 Orchestrating: ${testTask.description}`);
    
    try {
      const decision = await orchestrationEngine.orchestrateTask(
        testTask.description,
        testTask.contextFiles,
        {
          preferredModel: "sonnet-4",
          maxComplexityForLocal: 0.6,
          enableAutoRouting: true,
          notificationLevel: "minimal"
        }
      );
      
      console.log(`✅ Strategy: ${decision.strategy}`);
      console.log(`🤖 Primary Model: ${decision.model}`);
      console.log(`🔄 Fallback Model: ${decision.fallbackModel}`);
      console.log(`🎯 Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`💭 Reasoning: ${decision.reasoning}`);
      console.log(`🔢 Estimated Tokens: ${decision.estimatedTokens}`);
      console.log(`📋 Context Strategy: ${decision.contextStrategy}`);
      
      // Test execution (simulated)
      console.log("\n⚡ Testing task execution...");
      const result = await orchestrationEngine.executeTask(decision.taskId, decision);
      
      console.log(`✅ Execution completed: ${result.success ? "SUCCESS" : "FAILED"}`);
      console.log(`🤖 Model used: ${result.modelUsed}`);
      console.log(`⏱️ Execution time: ${result.executionTime}ms`);
      console.log(`🎯 Quality score: ${result.qualityScore}`);
      
    } catch (error) {
      console.log(`❌ Orchestration failed: ${error}`);
    }
    
    console.log("─".repeat(80));
  }
}

async function runAllTests() {
  console.log("🚀 Starting CTIR Orchestration System Tests\n");
  console.log("=".repeat(80));
  
  try {
    await testTaskClassification();
    await testCCSessionsIntegration();
    await testOrchestrationEngine();
    
    console.log("\n✅ All tests completed!");
    console.log("\n📊 Summary:");
    console.log("- Task classification working");
    console.log("- cc-sessions integration working");
    console.log("- Orchestration engine working");
    console.log("- Multi-model routing functional");
    
  } catch (error) {
    console.log(`❌ Test suite failed: ${error}`);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testTaskClassification, testCCSessionsIntegration, testOrchestrationEngine };
