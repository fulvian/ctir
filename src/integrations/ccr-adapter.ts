import fs from "fs";
import path from "path";
import type { CCRAdapter, RoutingDecision } from "@/integrations/contracts/ccr";

interface CCRStateFile {
  localOnly: boolean;
  lastDecision?: RoutingDecision;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "local-development", "session-data");
const CCR_STATE_FILE = path.join(DATA_DIR, "ccr-state.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function readState(): CCRStateFile {
  ensureDir();
  if (!fs.existsSync(CCR_STATE_FILE)) {
    const initial: CCRStateFile = { localOnly: false, updatedAt: nowIso() };
    fs.writeFileSync(CCR_STATE_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(CCR_STATE_FILE, "utf-8");
  return JSON.parse(raw) as CCRStateFile;
}

function writeState(state: CCRStateFile): void {
  ensureDir();
  fs.writeFileSync(CCR_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export class FileCCRAdapter implements CCRAdapter {
  async switchStrategy(decision: RoutingDecision): Promise<void> {
    const state = readState();
    const updated: CCRStateFile = { ...state, lastDecision: decision, updatedAt: nowIso() };
    writeState(updated);
  }

  async enableLocalOnlyMode(): Promise<void> {
    const state = readState();
    state.localOnly = true;
    state.updatedAt = nowIso();
    writeState(state);
  }

  async disableLocalOnlyMode(): Promise<void> {
    const state = readState();
    state.localOnly = false;
    state.updatedAt = nowIso();
    writeState(state);
  }

  async isLocalOnlyModeEnabled(): Promise<boolean> {
    const state = readState();
    return state.localOnly;
  }
}


