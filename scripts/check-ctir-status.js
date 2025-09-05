#!/usr/bin/env node

/**
 * CTIR Status Checker
 * Script per verificare lo stato di CTIR da Claude Code
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function checkCTIRStatus() {
  try {
    const statusPath = path.join(process.cwd(), '.claude', 'ctir-status.json');

    if (!fs.existsSync(statusPath)) {
      return {
        status: 'error',
        message: 'CTIR status file not found. Is CTIR running?',
        fallbackMode: false,
        recommendations: {
          useLocalModels: false,
          message: 'CTIR not available - use Claude Code normally'
        }
      };
    }

    const raw = fs.readFileSync(statusPath, 'utf-8');
    const status = JSON.parse(raw);

    // Enhance status with integration health checks
    const enhanced = {
      ...status,
      integrations: {
        ccSessions: checkCCSessionsHealth(),
        ccr: checkCCRHealth(),
        mcp: checkMCPHealth(),
        gemini: checkGeminiStatus()
      },
      routing: {
        localOnlyMode: checkLocalOnlyMode(),
        lastDecision: getLastRoutingDecision()
      }
    };

    return enhanced;

  } catch (error) {
    return {
      status: 'error',
      message: `Error reading CTIR status: ${error.message}`,
      fallbackMode: false,
      recommendations: {
        useLocalModels: false,
        message: 'CTIR status unavailable - use Claude Code normally'
      }
    };
  }
}

// Main execution
if (require.main === module) {
  // Handle async MCP health check
  if (checkMCPHealth().then) {
    checkMCPHealth().then(() => {
      const status = checkCTIRStatus();
      console.log(JSON.stringify(status, null, 2));
    });
  } else {
    const status = checkCTIRStatus();
    console.log(JSON.stringify(status, null, 2));
  }
}

function checkCCSessionsHealth() {
  try {
    const dataDir = path.join(process.cwd(), 'local-development', 'session-data');
    const tasksFile = path.join(dataDir, 'tasks.json');
    const snapshotFile = path.join(dataDir, 'latest-session-snapshot.json');
    
    return {
      available: fs.existsSync(dataDir),
      tasksFile: fs.existsSync(tasksFile),
      snapshotFile: fs.existsSync(snapshotFile),
      lastUpdate: fs.existsSync(tasksFile) ? fs.statSync(tasksFile).mtime.toISOString() : null
    };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

function checkCCRHealth() {
  try {
    const dataDir = path.join(process.cwd(), 'local-development', 'session-data');
    const ccrStateFile = path.join(dataDir, 'ccr-state.json');
    
    if (!fs.existsSync(ccrStateFile)) {
      return { available: false, localOnly: false };
    }
    
    const raw = fs.readFileSync(ccrStateFile, 'utf-8');
    const state = JSON.parse(raw);
    
    return {
      available: true,
      localOnly: state.localOnly || false,
      lastUpdate: state.updatedAt || null
    };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

function checkMCPHealth() {
  return new Promise((resolve) => {
    const mcpPath = path.join(process.cwd(), 'mcp', 'ctir-ollama-mcp', 'dist', 'index.js');
    
    if (!fs.existsSync(mcpPath)) {
      resolve({ available: false, error: 'MCP server not found' });
      return;
    }
    
    const proc = spawn('node', [mcpPath, '--health-check'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (d) => { stdout += String(d); });
    proc.stderr.on('data', (d) => { stderr += String(d); });
    
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ available: false, error: 'MCP health check timeout' });
    }, 5000);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        available: code === 0,
        exitCode: code,
        error: code !== 0 ? (stderr || stdout || `Exit code ${code}`) : null
      });
    });
    
    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({ available: false, error: error.message });
    });
  });
}

function checkLocalOnlyMode() {
  try {
    const dataDir = path.join(process.cwd(), 'local-development', 'session-data');
    const ccrStateFile = path.join(dataDir, 'ccr-state.json');
    
    if (!fs.existsSync(ccrStateFile)) return false;
    
    const raw = fs.readFileSync(ccrStateFile, 'utf-8');
    const state = JSON.parse(raw);
    return state.localOnly || false;
  } catch {
    return false;
  }
}

function getLastRoutingDecision() {
  try {
    const dataDir = path.join(process.cwd(), 'local-development', 'session-data');
    const ccrStateFile = path.join(dataDir, 'ccr-state.json');
    
    if (!fs.existsSync(ccrStateFile)) return null;
    
    const raw = fs.readFileSync(ccrStateFile, 'utf-8');
    const state = JSON.parse(raw);
    return state.lastDecision || null;
  } catch {
    return null;
  }
}

function checkGeminiStatus() {
  try {
    const statusPath = path.join(process.cwd(), '.claude', 'ctir-status.json');
    if (!fs.existsSync(statusPath)) return { available: false };
    const raw = fs.readFileSync(statusPath, 'utf-8');
    const status = JSON.parse(raw);
    const available = !!status.geminiAvailable;
    const credit = !!status.geminiCreditAvailable;
    return { available, credit };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

module.exports = { checkCTIRStatus };
