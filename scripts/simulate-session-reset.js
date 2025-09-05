#!/usr/bin/env node

/**
 * CTIR Session Reset Simulator
 * Script per simulare il reset della sessione Claude Code
 */

const fs = require('fs/promises');
const path = require('path');

async function simulateSessionReset() {
  try {
    console.log('🔄 Simulating Claude Code session reset...');

    const statusPath = path.join(process.cwd(), '.claude', 'ctir-status.json');

    // Leggi lo status attuale
    let status;
    try {
      const raw = await fs.readFile(statusPath, 'utf-8');
      status = JSON.parse(raw);
    } catch (error) {
      console.error('❌ Could not read status file:', error.message);
      return;
    }

    // Simula un reset della sessione (aggiorna sessionStart a ora)
    status.sessionStart = new Date().toISOString();
    status.status = "active";
    status.fallbackMode = false;
    status.tokenLimitReached = false;
    status.recommendations = {
      useLocalModels: false,
      forceMCP: false,
      message: "Claude Code session active - use normally"
    };
    status.lastUpdate = new Date().toISOString();

    // Scrivi il nuovo status
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2));

    // Rimuovi il flag di limite raggiunto
    const flagPath = path.join(process.cwd(), '.claude', 'limit_reached.flag');
    try {
      await fs.unlink(flagPath);
      console.log('🗑️ Removed limit reached flag');
    } catch (error) {
      // Il flag potrebbe non esistere, non è un errore
    }

    console.log('✅ Session reset simulated successfully');
    console.log('🔄 CTIR should now detect the reset and prepare auto-resume');

  } catch (error) {
    console.error('❌ Error simulating session reset:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  simulateSessionReset();
}

module.exports = { simulateSessionReset };
