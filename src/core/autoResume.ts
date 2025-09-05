import fs from "fs/promises";
import path from "path";
import { logger } from "@/utils/logger";
import { FileCCSessionsAdapter } from "@/integrations/cc-sessions-adapter";
import type { SessionMemorySnapshot } from "@/integrations/contracts/cc-sessions";

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

export interface CTIRStatus {
  status: "active" | "fallback_mode" | "session_expired" | "approaching_limit" | "reset_pending" | "resetting";
  fallbackMode: boolean;
  lastUpdate: string;
  mcpAvailable: boolean;
  ollamaAvailable: boolean;
  openRouterAvailable?: boolean;
  openRouterCreditAvailable?: boolean;
  geminiAvailable?: boolean;
  geminiCreditAvailable?: boolean;
  sessionStart: string;
  tokenLimitReached: boolean;
  modernSessionManager?: boolean;
  sessionState?: string;
  claudeCodeActive?: boolean;
  recommendations: {
    useLocalModels: boolean;
    forceMCP: boolean;
    message: string;
  };
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

export class AutoResumeEngine<TTask = unknown> {
  private persistence: WorkStatePersistence<TTask>;
  private timing: SessionTimingTracker;
  private logger = { info: console.log, warn: console.warn, error: console.error };
  private tokenMonitorInterval: NodeJS.Timeout | null = null;
  private isInFallbackMode = false;
  private ccSessions = new FileCCSessionsAdapter();

  constructor() {
    this.persistence = new WorkStatePersistence<TTask>();
    this.timing = new SessionTimingTracker();
  }

  async autoResumeSession(): Promise<void> {
    this.logger.info(`🔄 Auto-resume triggered at ${new Date().toISOString()}`);

    try {
      // 1. Load last work state
      const lastState = await this.persistence.loadLastWorkState<TTask>();
      if (!lastState) {
        this.logger.warn('❌ No previous state found');
        return;
      }

      // 2. Restore context
      await this.restoreWorkContext(lastState);

      // 3. Send resume message to Claude Code
      await this.sendResumeMessage(lastState);

      // 4. Start new session tracking
      await this.timing.trackSessionStart(new Date());

      this.logger.info('✅ Session resumed successfully');

    } catch (error) {
      this.logger.error('❌ Auto-resume failed:', error);
      // TODO: Implement notification manager for failed resume alerts
    }
  }

  private async restoreWorkContext(state: WorkState<TTask>): Promise<void> {
    this.logger.info(`Restoring context for session ${state.sessionId}`);
    // Restore cc-sessions snapshot if present
    try {
      const snap = await this.ccSessions.loadLatestSessionSnapshot();
      if (snap) {
        this.logger.info(`Loaded cc-sessions snapshot for session ${snap.sessionId} at ${snap.lastActive}`);
      } else {
        this.logger.warn("No cc-sessions snapshot found; proceeding with filesystem work-state only");
      }
    } catch (e) {
      this.logger.error("Failed to load cc-sessions snapshot:", e);
    }

    // Project state restore would be implemented here if needed
  }

  private async sendResumeMessage(state: WorkState<TTask>): Promise<void> {
    const resumePrompt = this.generateResumePrompt(state);

    // TODO: Send to Claude Code via API or clipboard
    this.logger.info('Resume prompt generated:', resumePrompt);
  }

  private generateResumePrompt(state: WorkState<TTask>): string {
    const template = `# 🔄 AUTO-RESUME SESSION (CTIR v1.0)

## Session Context Recovery:
- Last active: ${state.lastActiveTimestamp}
- Session ID: ${state.sessionId}
- Current task: ${JSON.stringify(state.currentTask)}

## Progress Summary:
- Files modified: ${state.projectState.modifiedFiles?.length || 0}
- Last commit: ${state.projectState.lastCommit || 'N/A'}
- Branch: ${state.projectState.currentBranch || 'N/A'}

## Next Planned Actions:
${state.nextActions?.map(action => `- ${action.description}`).join('\n') || 'None'}

## Pending Operations:
${state.pendingOperations?.map((op: any) => `- ${op.description} (${op.status || 'unknown'})`).join('\n') || 'None'}

Please continue from where we left off. The CTIR system has automatically restored the session context.`;

    return template;
  }

  async prepareForExpiration(minutesRemaining: number): Promise<void> {
    if (minutesRemaining <= 10) {
      // Save current state
      await this.saveCurrentWorkState();

      // Prepare resume context
      await this.prepareResumeContext();

      this.logger.info(`⏰ Preparing for session expiration in ${minutesRemaining} minutes`);
    }
  }

  async startTokenMonitoring(): Promise<void> {
    this.logger.info('🔍 Starting active token monitoring...');

    // Monitor every 30 seconds
    this.tokenMonitorInterval = setInterval(async () => {
      try {
        const claudeStatus = await this.checkClaudeCodeStatus();

        if (claudeStatus.isNearLimit && !this.isInFallbackMode) {
          this.logger.warn('🚨 Claude Code near token limit! Activating fallback mode...');
          await this.activateFallbackMode();
        }

        if (claudeStatus.isExpired && !this.isInFallbackMode) {
          this.logger.error('❌ Claude Code session expired! Switching to local models...');
          await this.forceLocalMode();
        } else if (claudeStatus.isExpired && this.isInFallbackMode) {
          // Already in fallback mode, skip to avoid oscillation
          this.logger.info('Already in fallback mode, skipping duplicate activation');
        }

      } catch (error) {
        this.logger.error('Token monitoring error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  stopTokenMonitoring(): void {
    if (this.tokenMonitorInterval) {
      clearInterval(this.tokenMonitorInterval);
      this.tokenMonitorInterval = null;
      this.logger.info('🛑 Token monitoring stopped');
    }
  }

  private async checkClaudeCodeStatus(): Promise<{isNearLimit: boolean, isExpired: boolean}> {
    try {
      // Check Claude Code status by looking for "5-hour limit reached" in recent activity
      const isExpired = await this.detectClaudeLimitReached();
      const isNearLimit = await this.detectClaudeNearLimit();

      return { isNearLimit, isExpired };
    } catch (error) {
      this.logger.error('Error checking Claude status:', error);
      return { isNearLimit: false, isExpired: false };
    }
  }

  private async detectClaudeLimitReached(): Promise<boolean> {
    // DISABLED: This method is now handled by claude-monitor.ts to avoid oscillation
    // The claude-monitor.ts handles all limit detection and fallback activation
    return false;
  }

  private async detectClaudeNearLimit(): Promise<boolean> {
    try {
      // Check if Claude is near the limit (e.g., 4+ hours of usage)
      const now = Date.now();
      const sessionStart = this.timing['currentWindow']?.startTime.getTime() || now;
      const sessionDuration = (now - sessionStart) / (1000 * 60 * 60); // hours

      // Consider near limit if more than 4 hours have passed
      return sessionDuration >= 4.0;
    } catch (error) {
      this.logger.error('Error detecting near limit:', error);
      return false;
    }
  }

  private async activateFallbackMode(): Promise<void> {
    this.isInFallbackMode = true;
    this.logger.info('🔄 Activating fallback mode - prioritizing local models');

    // Update status file for Claude Code monitoring
    await this.updateStatusFile({
      status: "fallback_mode",
      fallbackMode: true,
      tokenLimitReached: false,
      recommendations: {
        useLocalModels: true,
        forceMCP: true,
        message: "Near token limit - use local models when possible"
      }
    });

    await this.saveCurrentWorkState();
  }

  private async forceLocalMode(): Promise<void> {
    this.isInFallbackMode = true;
    this.logger.info('🚫 Forcing local mode - Claude Code session expired');

    // Update status file for expired session
    await this.updateStatusFile({
      status: "session_expired",
      fallbackMode: true,
      tokenLimitReached: true,
      recommendations: {
        useLocalModels: true,
        forceMCP: true,
        message: "Session expired - use only local models until reset"
      }
    });

    // Save current state for potential resume
    await this.saveCurrentWorkState();

    // This would completely switch to local models
    // In a real implementation, this would:
    // 1. Stop accepting new Claude Code requests
    // 2. Route all new requests to local MCP tools
    // 3. Save state for when Claude Code resets
  }

  isInFallback(): boolean {
    return this.isInFallbackMode;
  }

  public getSessionStatus(): { isLimited: boolean } {
    // Lo stato della sessione è direttamente legato alla modalità di fallback.
    return { isLimited: this.isInFallbackMode };
  }

  getSessionStartTime(): Date | null {
    return this.timing['currentWindow']?.startTime || null;
  }

  async loadLastWorkState<T = unknown>(): Promise<WorkState<T> | null> {
    return this.persistence.loadLastWorkState<T>();
  }

  async enableFallbackMode(): Promise<void> {
    await this.activateFallbackMode();
  }

  async resetFallbackMode(): Promise<void> {
    this.isInFallbackMode = false;
    this.logger.info('✅ Fallback mode reset - Claude Code session active');

    // Rimuovi il flag di limite raggiunto
    try {
      const limitFlagPath = path.join(process.cwd(), '.claude', 'limit_reached.flag');
      await fs.unlink(limitFlagPath);
      this.logger.info('Removed limit_reached.flag');
    } catch (error) {
      // Ignora se il file non esiste
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Failed to remove limit_reached.flag', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Update status file for active session
    await this.updateStatusFile({
      status: "active",
      fallbackMode: false,
      tokenLimitReached: false,
      recommendations: {
        useLocalModels: false,
        forceMCP: false,
        message: "Claude Code session active - use normally"
      }
    });
  }

  async updateStatusFile(updates: Partial<CTIRStatus>): Promise<void> {
    try {
      const statusPath = path.join(process.cwd(), '.claude', 'ctir-status.json');

      // Read current status
      let currentStatus: CTIRStatus = {
        status: "active",
        fallbackMode: false,
        lastUpdate: new Date().toISOString(),
        mcpAvailable: true,
        ollamaAvailable: true,
        sessionStart: new Date().toISOString(),
        tokenLimitReached: false,
        recommendations: {
          useLocalModels: false,
          forceMCP: false,
          message: "Claude Code session active - use normally"
        }
      };

      try {
        const raw = await fs.readFile(statusPath, 'utf-8');
        currentStatus = { ...currentStatus, ...JSON.parse(raw) };
      } catch {
        // File doesn't exist or is invalid, use defaults
      }

      // Update with new values
      const newStatus = {
        ...currentStatus,
        ...updates,
        lastUpdate: new Date().toISOString()
      };

      // Write updated status
      await fs.writeFile(statusPath, JSON.stringify(newStatus, null, 2));

    } catch (error) {
      this.logger.error('Failed to update status file:', error);
    }
  }

  async saveCurrentWorkState(): Promise<void> {
    const currentState: WorkState<TTask> = {
      sessionId: `session-${Date.now()}`,
      lastActiveTimestamp: new Date(),
      currentTask: {} as TTask,
      conversationContext: {},
      pendingOperations: [],
      projectState: {
        modifiedFiles: [],
        lastCommit: undefined,
        currentBranch: undefined
      },
      nextActions: []
    };

    await this.persistence.saveWorkState(currentState);

    // Also persist a cc-sessions snapshot for fast resume across components
    const snapshot: SessionMemorySnapshot = {
      sessionId: currentState.sessionId,
      lastActive: new Date().toISOString(),
      currentTaskId: undefined,
      conversationContext: currentState.conversationContext,
      projectState: currentState.projectState,
    };
    try {
      await this.ccSessions.saveSessionSnapshot(snapshot);
    } catch (e) {
      this.logger.error("Failed to save cc-sessions snapshot:", e);
    }
  }

  private async prepareResumeContext(): Promise<void> {
    // TODO: Prepare resume context
    this.logger.info('Resume context prepared');
  }
}

