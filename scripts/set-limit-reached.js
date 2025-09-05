#!/usr/bin/env node

/**
 * CTIR Limit Reached Setter
 * Script per segnalare manualmente quando Claude Code ha raggiunto il limite
 */

const fs = require('fs/promises');
const path = require('path');

async function setLimitReached() {
  try {
    const claudeDir = path.join(process.cwd(), '.claude');

    // Ensure .claude directory exists
    await fs.mkdir(claudeDir, { recursive: true });

    const limitIndicatorFile = path.join(claudeDir, 'limit_reached.flag');

    // Create the flag file with timestamp
    const timestamp = new Date().toISOString();
    await fs.writeFile(limitIndicatorFile, `Limit reached at: ${timestamp}\n`);

    console.log('✅ CTIR limit flag set - fallback mode will activate');
    console.log(`📁 Flag file created: ${limitIndicatorFile}`);

    // Also update the status file
    const statusFile = path.join(claudeDir, 'ctir-status.json');
    try {
      const raw = await fs.readFile(statusFile, 'utf-8');
      const status = JSON.parse(raw);
      status.tokenLimitReached = true;
      status.status = 'session_expired';
      status.fallbackMode = true;
      status.recommendations = {
        useLocalModels: true,
        forceMCP: true,
        message: 'Session expired - use only local models'
      };
      await fs.writeFile(statusFile, JSON.stringify(status, null, 2));
      console.log('✅ CTIR status updated to session_expired');
    } catch (error) {
      console.log('⚠️ Could not update status file:', error.message);
    }

  } catch (error) {
    console.error('❌ Error setting limit flag:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  setLimitReached();
}

module.exports = { setLimitReached };
