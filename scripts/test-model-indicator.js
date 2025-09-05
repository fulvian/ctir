#!/usr/bin/env node

/**
 * Script per testare l'indicatore del modello CTIR
 * Mostra l'indicatore corrente e aggiorna ogni 5 secondi
 */

import fetch from 'node-fetch';

const CTIR_BASE_URL = 'http://localhost:3001';

async function getModelIndicator() {
  try {
    const response = await fetch(`${CTIR_BASE_URL}/model-indicator`);
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ Error: ${data.error || 'Unknown error'}`);
      return;
    }

    console.log(`\n🎭 ${data.indicator}`);
    
    if (data.data) {
      console.log(`   Model: ${data.data.currentModel}`);
      console.log(`   Provider: ${data.data.modelProvider}`);
      console.log(`   Strategy: ${data.data.routingStrategy}`);
      console.log(`   Confidence: ${Math.round(data.data.confidence * 100)}%`);
      console.log(`   Session State: ${data.data.sessionState}`);
      
      if (data.data.tokenUsage) {
        console.log(`   Token Usage: ${data.data.tokenUsage.percentage}%`);
        if (data.data.tokenUsage.warning) {
          console.log(`   Warning: ${data.data.tokenUsage.warning}`);
        }
      }
    }
    
    console.log(`   Last Update: ${new Date(data.timestamp).toLocaleTimeString()}`);
    
  } catch (error) {
    console.log(`❌ Failed to connect to CTIR: ${error instanceof Error ? error.message : String(error)}`);
    console.log('   Make sure CTIR is running on port 3001');
  }
}

async function main() {
  console.log('🎭 CTIR Model Indicator Monitor');
  console.log('===============================');
  console.log('Press Ctrl+C to stop\n');

  // Prima lettura immediata
  await getModelIndicator();

  // Aggiorna ogni 5 secondi
  const interval = setInterval(async () => {
    console.log('\n' + '─'.repeat(50));
    await getModelIndicator();
  }, 5000);

  // Gestisci interruzione
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping monitor...');
    clearInterval(interval);
    process.exit(0);
  });
}

main().catch(console.error);
