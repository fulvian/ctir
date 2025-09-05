require('dotenv').config();
const { RoutingEngine } = require('./dist/core/router.js');
const { GeminiIntegration } = require('./dist/integrations/gemini.js');

async function testRoutingEndToEnd() {
  console.log('🧪 Testing CTIR Routing End-to-End...\n');
  
  // Initialize components
  const gemini = new GeminiIntegration();
  const router = new RoutingEngine();
  
  // Set Gemini status in router
  const geminiAvailable = await gemini.healthCheck(3000);
  const geminiCreditAvailable = gemini.isCreditAvailable();
  
  router.geminiAvailable = geminiAvailable;
  router.geminiCreditAvailable = geminiCreditAvailable;
  router.localOnlyMode = false; // Test in normal mode first
  
  console.log(`📊 System Status:`);
  console.log(`   Gemini Available: ${geminiAvailable ? '✅' : '❌'}`);
  console.log(`   Gemini Credit: ${geminiCreditAvailable ? '✅' : '❌'}`);
  console.log(`   Local Only Mode: ${router.localOnlyMode ? '✅' : '❌'}`);
  
  // Test different task complexities
  const testTasks = [
    { name: 'Simple Task', complexity: { totalScore: 0.3 }, estimatedTokens: 100, category: 'DOCUMENTATION' },
    { name: 'Medium Task', complexity: { totalScore: 0.5 }, estimatedTokens: 300, category: 'DOCUMENTATION' },
    { name: 'Complex Task', complexity: { totalScore: 0.8 }, estimatedTokens: 800, category: 'DOCUMENTATION' },
    { name: 'Heavy Task', complexity: { totalScore: 0.9 }, estimatedTokens: 1200, category: 'DOCUMENTATION' }
  ];
  
  // Mock session for testing
  const mockSession = {
    tokenBudget: { used: 1000, limit: 5000 }
  };
  
  console.log('\n🎯 Testing Routing Decisions:');
  for (const task of testTasks) {
    const decision = router.decide(task, mockSession);
    console.log(`\n   ${task.name} (complexity: ${task.complexity.totalScore}):`);
    console.log(`     Strategy: ${decision.strategy}`);
    console.log(`     Confidence: ${decision.confidence}`);
    console.log(`     Reasoning: ${decision.reasoning}`);
  }
  
  // Test in local-only mode
  console.log('\n🔄 Testing Local-Only Mode:');
  router.localOnlyMode = true;
  
  for (const task of testTasks.slice(0, 2)) {
    const decision = router.decide(task, mockSession);
    console.log(`\n   ${task.name} (local-only):`);
    console.log(`     Strategy: ${decision.strategy}`);
    console.log(`     Confidence: ${decision.confidence}`);
    console.log(`     Reasoning: ${decision.reasoning}`);
  }
  
  console.log('\n🎉 Routing Test Complete!');
}

testRoutingEndToEnd().catch(console.error);
