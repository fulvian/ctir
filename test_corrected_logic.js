const { ModernSessionManager } = require('./dist/core/modern-session-manager.js');
const { AutoResumeEngine } = require('./dist/core/autoResume.js');

async function testCorrectedLogic() {
  const autoResume = new AutoResumeEngine();
  const sessionManager = new ModernSessionManager(autoResume);
  
  console.log('🔧 Test Logica Corretta - Claude Code Reale');
  console.log('='.repeat(60));
  
  await sessionManager.start();
  
  // Aspetta per il primo check
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n📊 STATO CORRETTO:');
  console.log('├─ Stato sessione:', sessionManager.getCurrentState());
  console.log('├─ Claude Code attivo:', sessionManager.isClaudeCodeActive() ? '✅ SÌ' : '❌ NO');
  console.log('├─ In fallback mode:', sessionManager.isInFallbackMode() ? '⚠️ SÌ' : '✅ NO');
  
  const lastStatus = sessionManager.getLastClaudeCodeStatus();
  if (lastStatus) {
    console.log('├─ Processo Claude Code:');
    console.log('   ├─ PID:', lastStatus.pid || 'N/A');
    console.log('   ├─ Confidenza:', (lastStatus.confidence * 100).toFixed(1) + '%');
    console.log('   ├─ Avviato:', lastStatus.startTime ? lastStatus.startTime.toLocaleString() : 'N/A');
    console.log('   └─ Memoria:', lastStatus.memoryUsage ? Math.round(lastStatus.memoryUsage / 1024) + ' MB' : 'N/A');
  }
  
  const tokenUsage = sessionManager.getTokenUsage();
  if (tokenUsage) {
    console.log('└─ Token Usage (CORRETTO):');
    console.log('   ├─ Token utilizzati:', tokenUsage.estimatedTokens);
    console.log('   ├─ Limite token:', tokenUsage.tokenLimit);
    console.log('   ├─ Percentuale:', (tokenUsage.percentageUsed * 100).toFixed(1) + '%');
    console.log('   └─ Prossimo reset:', tokenUsage.resetTime ? tokenUsage.resetTime.toLocaleString() : 'N/A');
  }
  
  // Verifica coerenza logica
  const isActive = sessionManager.isClaudeCodeActive();
  const isFallback = sessionManager.isInFallbackMode();
  
  console.log('\n🔍 VERIFICA COERENZA LOGICA:');
  if (isActive && !isFallback) {
    console.log('✅ COERENTE: Claude Code attivo, non in fallback');
  } else if (!isActive && isFallback) {
    console.log('✅ COERENTE: Claude Code non attivo, in fallback');
  } else if (!isActive && !isFallback) {
    console.log('❌ INCOERENTE: Claude Code non attivo ma non in fallback');
  } else {
    console.log('❌ INCOERENTE: Claude Code attivo ma in fallback');
  }
  
  await sessionManager.stop();
  console.log('\n✅ Test completato!');
}

testCorrectedLogic().catch(console.error);
