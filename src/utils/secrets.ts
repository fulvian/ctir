import { execFileSync } from 'child_process';
import os from 'os';

function isMacOS(): boolean {
  return os.platform() === 'darwin';
}

function readFromMacKeychain(service: string, account: string): string | null {
  try {
    const out = execFileSync('security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const val = out.trim();
    return val.length > 0 ? val : null;
  } catch {
    return null;
  }
}

/**
 * Populate process.env secrets from OS keychain if missing.
 * - macOS: Keychain Access via `security` CLI
 * - Others: no-op (fallback remains .env)
 */
export function hydrateSecretsFromOS(): void {
  if (!isMacOS()) return;
  const account = process.env.USER || 'ctir';

  if (!process.env.CLAUDE_API_KEY) {
    const val = readFromMacKeychain('CTIR_CLAUDE_API_KEY', account);
    if (val) process.env.CLAUDE_API_KEY = val;
  }

  if (!process.env.OPEN_ROUTER_API_KEY) {
    const val = readFromMacKeychain('CTIR_OPEN_ROUTER_API_KEY', account);
    if (val) process.env.OPEN_ROUTER_API_KEY = val;
  }
}

