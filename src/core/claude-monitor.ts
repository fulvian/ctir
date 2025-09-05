import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { AutoResumeEngine } from './autoResume';
import { logger } from '@/utils/logger';

export class ClaudeCodeMonitor {
  private logWatcher: fs.FileHandle | null = null;
  private isMonitoring = false;
  private autoResume: AutoResumeEngine;
  private claudeLogPath: string;
  private lastLogPosition = 0;
  private readonly limitIndicators: RegExp[] = [
    /5\s*-?\s*hour\s+limit\s+reached/i,
    /you'?ve\s+reached[\s\S]{0,40}limit/i,
    /rate\s*limit[\s\S]{0,20}reached/i,
    /session\s+limit[\s\S]{0,20}reached/i,
    /cool\s*down|cooldown/i,
    /come\s+back\s+in\s+\d+/i,
    /try\s+again\s+in\s+\d+/i
  ];
  // --- START: Stabilizzazione Monitoraggio ---
  private detectionThreshold = 3; // Numero di rilevamenti per conferma
  private detectionWindowSeconds = 15; // Finestra temporale
  private recentDetections: number[] = []; // Timestamp dei rilevamenti
  private isLimitDetectedAndWaitingForReset = false; // Nuovo flag per prevenire ri-rilevamenti
  // --- END: Stabilizzazione Monitoraggio ---

  constructor(autoResume: AutoResumeEngine) {
    this.autoResume = autoResume;
    // Il path verrà inizializzato alla prima chiamata
    this.claudeLogPath = '';
  }

  private async findLatestClaudeLog(): Promise<string> {
    // Prima cerca nei percorsi di Cursor (dove Claude Code scrive quando eseguito da Cursor)
    const cursorPaths = [
      path.join(process.env.HOME || '', 'Library', 'Application Support', 'Cursor', 'logs')
    ];

    // Poi nei percorsi tradizionali di Claude
    const claudePaths = [
      path.join(process.env.HOME || '', 'Library', 'Application Support', 'Claude', 'logs', 'claude.log'),
      path.join(process.env.HOME || '', 'Library', 'Logs', 'Claude'),
      path.join(process.env.HOME || '', '.claude', 'logs')
    ];

    // Cerca il file di log più recente
    for (const basePath of cursorPaths) {
      try {
        const result = await this.findMostRecentLogInDirectory(basePath);
        if (result) return result;
      } catch (error) {
        // Continua con il prossimo percorso
      }
    }

    // Fallback ai percorsi tradizionali
    for (const logPath of claudePaths) {
      try {
        // Verifica se il file esiste
        const fs = await import('fs');
        fs.accessSync(logPath);
        return logPath;
      } catch (error) {
        // Continua con il prossimo percorso
      }
    }

    // Se non trova nulla, usa il percorso tradizionale come fallback
    return path.join(process.env.HOME || '', 'Library', 'Application Support', 'Claude', 'logs', 'claude.log');
  }

  private async findMostRecentLogInDirectory(basePath: string): Promise<string | null> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      function findLogFiles(dir: string): string[] {
        const files: string[] = [];
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            files.push(...findLogFiles(fullPath));
          } else if (item.includes('Claude Code.log') || item.includes('claude.log')) {
            files.push(fullPath);
          }
        }

        return files;
      }

      const logFiles = findLogFiles(basePath);
      if (logFiles.length === 0) return null;

      // Trova il file più recente
      let mostRecent = logFiles[0];
      let mostRecentTime = fs.statSync(mostRecent).mtime;

      for (const file of logFiles) {
        const fileTime = fs.statSync(file).mtime;
        if (fileTime > mostRecentTime) {
          mostRecent = file;
          mostRecentTime = fileTime;
        }
      }

      return mostRecent;
    } catch (error) {
      return null;
    }
  }

  private async getLogPath(): Promise<string> {
    if (!this.claudeLogPath) {
      this.claudeLogPath = await this.findLatestClaudeLog();
    }
    return this.claudeLogPath;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🔍 Starting Claude Code log monitoring...');

    try {
      // Inizializza il path del log se necessario
      const logPath = await this.getLogPath();
      // Verifica se il file di log esiste
      await fs.access(logPath);
      console.log(`📁 Monitoring Claude log: ${logPath}`);

      // Leggi la posizione iniziale
      const stats = await fs.stat(logPath);
      this.lastLogPosition = stats.size;

      // Avvia il monitoraggio periodico
      this.monitorLoop();

    } catch (error) {
      console.warn('⚠️ Claude log file not accessible, falling back to alternative monitoring');
      console.warn(`Expected path: ${this.claudeLogPath}`);

      // Fallback: monitora il processo di Claude Code
      this.monitorProcessFallback();
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.logWatcher) {
      this.logWatcher.close();
      this.logWatcher = null;
    }
    console.log('🛑 Claude Code monitoring stopped');
  }

  private async monitorLoop(): Promise<void> {
    while (this.isMonitoring) {
      try {
        await this.checkForLimitReached();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer on error
      }
    }
  }

  private async checkForLimitReached(): Promise<void> {
    // Se abbiamo già rilevato un limite e stiamo aspettando il reset, non fare nulla
    if (this.isLimitDetectedAndWaitingForReset) {
      return;
    }

    try {
      const logPath = await this.getLogPath();
      const logContent = await fs.readFile(logPath, 'utf-8');
      const recentLogs = logContent.slice(this.lastLogPosition);

      let limitMatch: RegExpMatchArray | null = null;
      const matched = this.limitIndicators.some((rx) => {
        const match = recentLogs.match(rx);
        if (match) {
          limitMatch = match;
          return true;
        }
        return false;
      });

      if (matched) {
        logger.debug('Possible Claude limit indicator detected.');
        const now = Date.now();
        this.recentDetections.push(now);

        this.recentDetections = this.recentDetections.filter(
          (timestamp) => (now - timestamp) / 1000 <= this.detectionWindowSeconds
        );

        if (this.recentDetections.length >= this.detectionThreshold) {
          logger.warn(`CONFIRMED: ${this.recentDetections.length} detections in the last ${this.detectionWindowSeconds}s. Activating fallback.`, {
            detections: this.recentDetections.length,
            window: this.detectionWindowSeconds,
          });

          this.recentDetections = [];
          this.isLimitDetectedAndWaitingForReset = true; // Imposta il flag
          await this.saveCurrentState();
          await this.setLimitReachedFlag();
          
          // Passa il messaggio di log alla funzione di attesa
          await this.waitForSessionReset();

          const stats = await fs.stat(logPath);
          this.lastLogPosition = stats.size;
          return;
        }
      }
      
      const stats = await fs.stat(logPath);
      this.lastLogPosition = stats.size;

    } catch (error) {
      logger.error('Error checking Claude logs', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async monitorProcessFallback(): Promise<void> {
    console.log('🔄 Using process-based monitoring as fallback');

    setInterval(async () => {
      try {
        // Monitora i processi Claude
        const result = await this.runCommand('ps aux | grep -i claude | grep -v grep');

        // Se non ci sono processi Claude attivi, potrebbe essere un'indicazione
        if (!result.includes('Claude')) {
          console.log('ℹ️ No active Claude processes detected');
        }

        // Monitora anche il file di stato di CTIR per vedere se ci sono flag manuali
        await this.checkManualFlags();

      } catch (error) {
        console.error('Error in process monitoring:', error);
      }
    }, 10000); // Check every 10 seconds (più frequente)
  }

  private async checkManualFlags(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const flagPath = path.join(process.cwd(), '.claude', 'limit_reached.flag');
      const statusPath = path.join(process.cwd(), '.claude', 'ctir-status.json');

      // Verifica se esiste un flag manuale
      try {
        await fs.access(flagPath);
        console.log('🚨 Manual limit flag detected!');

        // Leggi il contenuto del flag
        const flagContent = await fs.readFile(flagPath, 'utf-8');
        console.log('📄 Flag content:', flagContent.trim());

        // Forza l'attivazione della modalità fallback
        await this.setLimitReachedFlag();

      } catch (error) {
        // Il flag non esiste, tutto ok
      }

    } catch (error) {
      console.error('Error checking manual flags:', error);
    }
  }

  private async saveCurrentState(): Promise<void> {
    console.log('💾 Saving current work state...');
    try {
      // Salva lo stato corrente (placeholder - sarà implementato meglio)
      await this.autoResume.saveCurrentWorkState();
      console.log('✅ Work state saved');
    } catch (error) {
      console.error('❌ Failed to save work state:', error);
    }
  }

  private async setLimitReachedFlag(): Promise<void> {
    logger.info('Setting limit reached flag...');
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const claudeDir = path.join(process.cwd(), '.claude');
      await fs.mkdir(claudeDir, { recursive: true });

      const limitIndicatorFile = path.join(claudeDir, 'limit_reached.flag');
      const timestamp = new Date().toISOString();
      await fs.writeFile(limitIndicatorFile, `Auto-detected limit reached at: ${timestamp}\n`);

      // Aggiorna anche il file di stato
      await this.autoResume.updateStatusFile({
        status: "session_expired",
        fallbackMode: true,
        tokenLimitReached: true,
        recommendations: {
          useLocalModels: true,
          forceMCP: true,
          message: "Session expired - use only local models until reset"
        }
      });

      logger.info('Limit reached flag set automatically');
    } catch (error) {
      logger.error('Failed to set limit flag', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async waitForSessionReset(): Promise<void> {
    console.log('⏳ Waiting for Claude Code session reset... Polling every 5 minutes.');

    const checkInterval = setInterval(async () => {
      try {
        console.log('INFO: Checking if Claude session has been reset...');
        const output = await this.runCommand('claude --help');

        // Se l'output NON contiene più un messaggio di limite, la sessione è ripristinata.
        const isStillLimited = this.limitIndicators.some((rx) => rx.test(output));

        if (!isStillLimited) {
          console.log('✅ Claude Code session has been reset!');
          clearInterval(checkInterval);

          // Reset della modalità fallback
          await this.autoResume.resetFallbackMode();

          // Avvia automaticamente Claude Code con il contesto ripristinato
          await this.autoRestartClaudeCode();

        } else {
          console.log('INFO: Session is still limited. Waiting for next check.');
        }
      } catch (error: any) {
        // Se il comando `claude --help` fallisce ma l'errore contiene un messaggio di limite, 
        // significa che la CLI esce con un errore ma ci informa comunque dello stato.
        const errorMessage = error.message || '';
        const isStillLimited = this.limitIndicators.some((rx) => rx.test(errorMessage));

        if (isStillLimited) {
          console.log('INFO: Session is still limited (confirmed via error output). Waiting for next check.');
        } else {
          console.error('Error checking session reset:', error);
        }
      }
    }, 300000); // Check every 5 minutes (300000 ms)
  }

  private async autoRestartClaudeCode(): Promise<void> {
    console.log('🚀 Auto-restarting Claude Code with restored context...');

    try {
      // Carica l'ultimo stato salvato
      const lastState = await this.autoResume.loadLastWorkState();

      if (lastState) {
        // Crea un prompt di resume per Claude Code
        const resumePrompt = await this.generateResumePrompt(lastState);

        // Salva il prompt in un file temporaneo
        const tempPromptFile = path.join(process.cwd(), '.claude', 'resume-prompt.md');
        await fs.writeFile(tempPromptFile, resumePrompt);

        console.log('📝 Resume prompt saved to:', tempPromptFile);
        console.log('💡 Claude Code will be restarted manually or automatically');
        console.log('🔄 Use the resume prompt to continue from where you left off');

        // Opzionale: tenta di aprire Claude Code automaticamente
        // await this.runCommand('open -a "Claude"');

      } else {
        console.warn('⚠️ No previous state found to restore');
      }

    } catch (error) {
      console.error('❌ Failed to auto-restart Claude Code:', error);
    }
  }

  private async generateResumePrompt(state: any): Promise<string> {
    return `# 🔄 CTIR AUTO-RESUME - Session Restored

## Previous Session Summary
- **Last Active**: ${state.lastActiveTimestamp}
- **Session ID**: ${state.sessionId}
- **Status**: Automatically restored after 5-hour limit

## Current Project State
- **Working Directory**: ${state.projectState?.currentBranch ? `Branch: ${state.projectState.currentBranch}` : 'N/A'}
- **Last Commit**: ${state.projectState?.lastCommit || 'N/A'}

## Next Actions to Continue
${state.nextActions?.map((action: any) => `- ${action.description}`).join('\n') || 'Continue with previous task'}

## Context
${state.conversationContext ? JSON.stringify(state.conversationContext, null, 2) : 'Previous conversation context'}

---
*This session was automatically restored by CTIR after reaching the 5-hour token limit.*
*Continue working seamlessly with full context preserved.*`;
  }
}
