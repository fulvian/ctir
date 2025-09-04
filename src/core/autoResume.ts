import fs from "fs/promises";
import path from "path";
import { logger } from "@/utils/logger";

export interface ClaudeSessionWindow {
  windowId: string;
  startTime: Date;
  endTime: Date;
  tokenUsed: number;
  tokenLimit: number;
  status: "active" | "exhausted" | "waiting" | "resuming";
  nextWindowStart: Date;
}

export interface WorkState<TTask = unknown> {
  sessionId: string;
  lastActiveTimestamp: Date;
  currentTask: TTask;
  conversationContext: unknown;
  pendingOperations: unknown[];
  projectState: {
    modifiedFiles: string[];
    lastCommit?: string;
    currentBranch?: string;
  };
  nextActions: { description: string }[];
}

export class SessionTimingTracker {
  private currentWindow: ClaudeSessionWindow | null = null;
  private resumeTimer: NodeJS.Timeout | null = null;

  async trackSessionStart(firstMessage: Date): Promise<void> {
    this.currentWindow = {
      windowId: `${firstMessage.getTime()}`,
      startTime: firstMessage,
      endTime: new Date(firstMessage.getTime() + 5 * 60 * 60 * 1000),
      tokenUsed: 0,
      tokenLimit: Number(process.env.TOKEN_BUDGET_LIMIT || 100000),
      status: "active",
      nextWindowStart: new Date(firstMessage.getTime() + 5 * 60 * 60 * 1000),
    };
    this.scheduleAutoResume();
  }

  private scheduleAutoResume(): void {
    if (!this.currentWindow) return;
    const msUntilResume = this.currentWindow.nextWindowStart.getTime() - Date.now();
    this.resumeTimer && clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(async () => {
      logger.info(`Auto-resume triggered at ${new Date().toISOString()}`);
      // Hook invoked by AutoResumeEngine
    }, Math.max(0, msUntilResume));
    logger.info(`🕐 Auto-resume scheduled for: ${this.currentWindow.nextWindowStart}`);
  }
}

export class WorkStatePersistence<TTask = unknown> {
  private backupsDir = path.join(process.cwd(), "local-development", "backups");

  async saveWorkState(state: WorkState<TTask>): Promise<void> {
    await fs.mkdir(this.backupsDir, { recursive: true });
    const file = path.join(this.backupsDir, `work-state-${state.sessionId}.json`);
    const payload = JSON.stringify(
      { ...state, lastActiveTimestamp: new Date().toISOString() },
      null,
      2
    );
    await fs.writeFile(file, payload, "utf-8");
  }

  async loadLastWorkState<T = TTask>(): Promise<WorkState<T> | null> {
    try {
      const files = await fs.readdir(this.backupsDir);
      const latest = files
        .filter((f) => f.startsWith("work-state-"))
        .sort()
        .pop();
      if (!latest) return null;
      const raw = await fs.readFile(path.join(this.backupsDir, latest), "utf-8");
      const parsed = JSON.parse(raw);
      return parsed as WorkState<T>;
    } catch {
      return null;
    }
  }
}

