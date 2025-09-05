import { logger } from "@/utils/logger";
import fs from "fs/promises";
import path from "path";

export interface ClaudeCodeTokenUsage {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalContextTokens: number;
  timestamp: Date;
}

export interface TokenWarning {
  level: 'none' | '75' | '90' | 'critical';
  percentage: number;
  message: string;
  shouldWarn: boolean;
}

export class ClaudeCodeTokenMonitor {
  private readonly contextLimit = 160000; // 160k practical limit (80% of 200k theoretical)
  private readonly warning75Threshold = 0.75; // 75%
  private readonly warning90Threshold = 0.90; // 90%
  private warningFlagsPath: string;

  constructor() {
    this.warningFlagsPath = path.join(process.cwd(), '.claude', 'state');
    this.ensureWarningFlagsDir();
  }

  private async ensureWarningFlagsDir(): Promise<void> {
    try {
      await fs.mkdir(this.warningFlagsPath, { recursive: true });
    } catch (error) {
      logger.debug("Could not create warning flags directory", { error });
    }
  }

  /**
   * Legge il transcript di Claude Code e estrae i token usage reali
   * Basato sul sistema cc-sessions
   */
  async getTokenUsageFromTranscript(transcriptPath: string): Promise<ClaudeCodeTokenUsage | null> {
    try {
      if (!await this.fileExists(transcriptPath)) {
        return null;
      }

      const content = await fs.readFile(transcriptPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      let mostRecentUsage: any = null;
      let mostRecentTimestamp: string | null = null;

      // Parse each JSONL entry
      for (const line of lines) {
        try {
          const data = JSON.parse(line.trim());
          
          // Skip sidechain entries (subagent calls)
          if (data.isSidechain === true) {
            continue;
          }

          // Check if this entry has usage data
          if (data.message?.usage) {
            const entryTime = data.timestamp;
            
            // Track the most recent main-chain entry with usage
            if (entryTime && (!mostRecentTimestamp || entryTime > mostRecentTimestamp)) {
              mostRecentTimestamp = entryTime;
              mostRecentUsage = data.message.usage;
            }
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }

      if (!mostRecentUsage) {
        return null;
      }

      // Calculate context length from most recent usage (same as cc-sessions)
      const inputTokens = mostRecentUsage.input_tokens || 0;
      const cacheReadInputTokens = mostRecentUsage.cache_read_input_tokens || 0;
      const cacheCreationInputTokens = mostRecentUsage.cache_creation_input_tokens || 0;
      const totalContextTokens = inputTokens + cacheReadInputTokens + cacheCreationInputTokens;

      return {
        inputTokens,
        cacheReadInputTokens,
        cacheCreationInputTokens,
        totalContextTokens,
        timestamp: new Date(mostRecentTimestamp!)
      };

    } catch (error) {
      logger.debug("Error reading Claude Code transcript", { 
        transcriptPath, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Calcola warning level basato sui token usage
   * Basato sul sistema cc-sessions
   */
  async calculateTokenWarning(tokenUsage: ClaudeCodeTokenUsage): Promise<TokenWarning> {
    const percentage = tokenUsage.totalContextTokens / this.contextLimit;
    const percentageInt = Math.floor(percentage * 100);

    // Check warning flags to avoid repeating warnings
    const warning75Flag = path.join(this.warningFlagsPath, 'context-warning-75.flag');
    const warning90Flag = path.join(this.warningFlagsPath, 'context-warning-90.flag');

    const warning75Exists = await this.fileExists(warning75Flag);
    const warning90Exists = await this.fileExists(warning90Flag);

    if (percentage >= this.warning90Threshold && !warning90Exists) {
      // Create warning flag
      try {
        await fs.writeFile(warning90Flag, '');
      } catch (error) {
        logger.debug("Could not create warning 90 flag", { error });
      }

      return {
        level: 'critical',
        percentage,
        message: `[90% WARNING] ${tokenUsage.totalContextTokens.toLocaleString()}/160,000 tokens used (${(percentage * 100).toFixed(1)}%). CRITICAL: Context limit approaching!`,
        shouldWarn: true
      };
    }

    if (percentage >= this.warning75Threshold && !warning75Exists) {
      // Create warning flag
      try {
        await fs.writeFile(warning75Flag, '');
      } catch (error) {
        logger.debug("Could not create warning 75 flag", { error });
      }

      return {
        level: '75',
        percentage,
        message: `[75% WARNING] ${tokenUsage.totalContextTokens.toLocaleString()}/160,000 tokens used (${(percentage * 100).toFixed(1)}%). Context is getting low.`,
        shouldWarn: true
      };
    }

    return {
      level: 'none',
      percentage,
      message: `${tokenUsage.totalContextTokens.toLocaleString()}/160,000 tokens used (${(percentage * 100).toFixed(1)}%)`,
      shouldWarn: false
    };
  }

  /**
   * Resetta i flag di warning (da chiamare all'inizio di una nuova sessione)
   */
  async resetWarningFlags(): Promise<void> {
    try {
      const warning75Flag = path.join(this.warningFlagsPath, 'context-warning-75.flag');
      const warning90Flag = path.join(this.warningFlagsPath, 'context-warning-90.flag');

      await Promise.all([
        fs.unlink(warning75Flag).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(warning90Flag).catch(() => {})  // Ignore if file doesn't exist
      ]);

      logger.debug("Warning flags reset");
    } catch (error) {
      logger.debug("Could not reset warning flags", { error });
    }
  }

  /**
   * Trova il transcript di Claude Code nel sistema
   */
  async findClaudeCodeTranscript(): Promise<string | null> {
    // Possibili percorsi del transcript (da investigare)
    const possiblePaths = [
      path.join(process.cwd(), '.claude', 'transcript.jsonl'),
      path.join(process.cwd(), '.claude', 'transcript'),
      path.join(process.env.HOME || '', '.claude', 'transcript.jsonl'),
      path.join(process.env.HOME || '', '.claude', 'transcript'),
    ];

    for (const transcriptPath of possiblePaths) {
      if (await this.fileExists(transcriptPath)) {
        return transcriptPath;
      }
    }

    return null;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
