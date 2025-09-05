#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('child_process');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${res.status}`);
  }
}

function json(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf-8' });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
  return JSON.parse(res.stdout || '{}');
}

function main() {
  console.log('🧪 E2E: build');
  run('npm', ['run', 'build']);

  console.log('🧪 E2E: start session');
  run('npm', ['run', 'start:session']);

  console.log('🧪 E2E: status active');
  const active = json('node', ['scripts/check-ctir-status.js']);
  if (!active || active.status !== 'active' || active.fallbackMode !== false) {
    throw new Error('Expected active status with fallbackMode=false');
  }

  console.log('🧪 E2E: simulate limit -> fallback');
  run('npm', ['run', 'set-limit']);
  const expired = json('node', ['scripts/check-ctir-status.js']);
  if (!expired || expired.fallbackMode !== true) {
    throw new Error('Expected fallbackMode=true after set-limit');
  }

  console.log('🧪 E2E: simulate reset -> active');
  run('npm', ['run', 'simulate-reset']);
  const reset = json('node', ['scripts/check-ctir-status.js']);
  if (!reset || reset.fallbackMode !== false) {
    throw new Error('Expected fallbackMode=false after simulate-reset');
  }

  console.log('✅ E2E completed successfully');
}

main();


