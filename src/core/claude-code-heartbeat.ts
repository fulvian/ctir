import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "@/utils/logger";

const execAsync = promisify(exec);

export interface ClaudeCodeStatus {
  isRunning: boolean;
  pid?: number;
  startTime?: Date;
  memoryUsage?: number;
  port?: number;
  lastHeartbeat?: Date;
  confidence: number;
}

export interface HeartbeatData {
  timestamp: string;
  sessionId: string;
  tokenEstimate: number;
  status: 'active' | 'idle' | 'error';
  processInfo: {
    pid: number;
    memoryUsage: number;
    port: number;
  };
}

export class ClaudeCodeHeartbeatMonitor {
  private readonly heartbeatFile = path.join(os.homedir(), '.claude', 'ctir-heartbeat.json');
  private readonly settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
  private readonly claudeConfigFile = path.join(os.homedir(), '.claude.json');
  private readonly defaultPort = 54545;
  
  private lastStatus: ClaudeCodeStatus = {
    isRunning: false,
    confidence: 0
  };

  constructor() {
    this.ensureHeartbeatDirectory();
  }

  private ensureHeartbeatDirectory(): void {
    const claudeDir = path.dirname(this.heartbeatFile);
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      logger.info("Created Claude Code heartbeat directory", { path: claudeDir });
    }
  }

  /**
   * Monitoraggio processo Claude Code CLI
   */
  private async checkClaudeCodeProcess(): Promise<{
    isRunning: boolean;
    pid?: number;
    startTime?: Date;
    memoryUsage?: number;
  }> {
    try {
      // Cerca processi Claude Code
      const { stdout } = await execAsync('ps aux | grep -E "(claude|@anthropic-ai/claude-code)" | grep -v grep');
      
      if (!stdout.trim()) {
        return { isRunning: false };
      }

      const processes = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => this.parseProcessLine(line))
        .filter(proc => proc.isValid);

      if (processes.length === 0) {
        return { isRunning: false };
      }

      // Prendi il processo principale (quello con PID più alto, solitamente il parent)
      const mainProcess = processes.sort((a, b) => b.pid - a.pid)[0];

      return {
        isRunning: true,
        pid: mainProcess.pid,
        startTime: mainProcess.startTime,
        memoryUsage: mainProcess.memoryUsage
      };

    } catch (error) {
      logger.debug("Error checking Claude Code process", { error: error instanceof Error ? error.message : String(error) });
      return { isRunning: false };
    }
  }

  private parseProcessLine(line: string): {
    pid: number;
    startTime: Date;
    memoryUsage: number;
    isValid: boolean;
  } {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) {
      return { pid: 0, startTime: new Date(), memoryUsage: 0, isValid: false };
    }

    try {
      const pid = parseInt(parts[1]);
      const memoryUsage = parseFloat(parts[5]); // RSS in KB
      
      // Parse start time
      // Su macOS, il formato può essere:
      // - "3:58PM" (processi recenti)
      // - "Sep 05" (processi più vecchi)
      // - "Sep 05 15:58" (processi molto vecchi)
      const timeStr = parts[8];
      
      let startTime: Date;
      if (timeStr.includes(':')) {
        // Formato: "3:58PM" o "Sep 05 15:58"
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
          // Formato: "3:58PM" - oggi
          const today = new Date();
          const [time, period] = timeStr.replace(/(AM|PM)/, ' $1').split(' ');
          const [hours, minutes] = time.split(':');
          let hour24 = parseInt(hours);
          if (period === 'PM' && hour24 !== 12) hour24 += 12;
          if (period === 'AM' && hour24 === 12) hour24 = 0;
          
          startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, parseInt(minutes));
        } else {
          // Formato: "Sep 05 15:58" - anno corrente
          const currentYear = new Date().getFullYear();
          startTime = new Date(`${timeStr} ${currentYear}`);
        }
      } else {
        // Formato: "Sep 05" - anno corrente
        const currentYear = new Date().getFullYear();
        startTime = new Date(`${timeStr} ${currentYear}`);
      }

      return {
        pid,
        startTime,
        memoryUsage,
        isValid: !isNaN(pid) && !isNaN(memoryUsage) && !isNaN(startTime.getTime())
      };
    } catch (error) {
      logger.debug("Error parsing process line", { line, error: error instanceof Error ? error.message : String(error) });
      return { pid: 0, startTime: new Date(), memoryUsage: 0, isValid: false };
    }
  }

  /**
   * Monitoraggio porta di rete
   */
  private async checkClaudeCodePort(): Promise<{
    isListening: boolean;
    port?: number;
    lastActivity?: Date;
  }> {
    try {
      // Controlla se la porta predefinita è in uso
      const { stdout } = await execAsync(`lsof -i :${this.defaultPort}`);
      
      if (stdout.includes('claude') || stdout.includes('node')) {
        return {
          isListening: true,
          port: this.defaultPort,
          lastActivity: new Date()
        };
      }

      // Controlla anche altre porte comuni
      const alternativePorts = [44545, 54546, 54547];
      for (const port of alternativePorts) {
        try {
          const { stdout: portCheck } = await execAsync(`lsof -i :${port}`);
          if (portCheck.includes('claude') || portCheck.includes('node')) {
            return {
              isListening: true,
              port,
              lastActivity: new Date()
            };
          }
        } catch {
          // Porta non in uso, continua
        }
      }

      return { isListening: false };

    } catch (error) {
      logger.debug("Error checking Claude Code port", { error: error instanceof Error ? error.message : String(error) });
      return { isListening: false };
    }
  }

  /**
   * Monitoraggio file di configurazione
   */
  private async checkConfigurationFiles(): Promise<{
    settingsExist: boolean;
    configExist: boolean;
    lastModified?: Date;
  }> {
    try {
      const settingsExists = fs.existsSync(this.settingsFile);
      const configExists = fs.existsSync(this.claudeConfigFile);
      
      let lastModified: Date | undefined;
      if (settingsExists) {
        const stats = fs.statSync(this.settingsFile);
        lastModified = stats.mtime;
      } else if (configExists) {
        const stats = fs.statSync(this.claudeConfigFile);
        lastModified = stats.mtime;
      }

      return {
        settingsExist: settingsExists,
        configExist: configExists,
        lastModified
      };

    } catch (error) {
      logger.debug("Error checking configuration files", { error: error instanceof Error ? error.message : String(error) });
      return { settingsExist: false, configExist: false };
    }
  }

  /**
   * Crea heartbeat file per comunicazione bidirezionale
   */
  private async createHeartbeat(processInfo: {
    pid: number;
    memoryUsage: number;
    port: number;
  }): Promise<void> {
    try {
      const heartbeat: HeartbeatData = {
        timestamp: new Date().toISOString(),
        sessionId: this.generateSessionId(),
        tokenEstimate: this.estimateCurrentTokens(),
        status: 'active',
        processInfo
      };

      await fs.promises.writeFile(this.heartbeatFile, JSON.stringify(heartbeat, null, 2));
      logger.debug("Created Claude Code heartbeat", { sessionId: heartbeat.sessionId });

    } catch (error) {
      logger.error("Failed to create heartbeat", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Legge heartbeat esistente
   */
  private async readExistingHeartbeat(): Promise<{
    lastSeen: Date;
    isActive: boolean;
    estimatedTokens: number;
    sessionId?: string;
  }> {
    try {
      if (!fs.existsSync(this.heartbeatFile)) {
        return { lastSeen: new Date(0), isActive: false, estimatedTokens: 0 };
      }

      const data = await fs.promises.readFile(this.heartbeatFile, 'utf-8');
      const heartbeat: HeartbeatData = JSON.parse(data);

      const lastSeen = new Date(heartbeat.timestamp);
      const isActive = (Date.now() - lastSeen.getTime()) < 120000; // 2 minuti di timeout

      return {
        lastSeen,
        isActive,
        estimatedTokens: heartbeat.tokenEstimate,
        sessionId: heartbeat.sessionId
      };

    } catch (error) {
      logger.debug("Error reading existing heartbeat", { error: error instanceof Error ? error.message : String(error) });
      return { lastSeen: new Date(0), isActive: false, estimatedTokens: 0 };
    }
  }

  /**
   * Calcola consenso tra multiple fonti di verità
   */
  private calculateConsensus(
    process: any,
    port: any,
    config: any,
    heartbeat: any
  ): ClaudeCodeStatus {
    const indicators = [
      process.status === 'fulfilled' && process.value?.isRunning,
      port.status === 'fulfilled' && port.value?.isListening,
      config.status === 'fulfilled' && (config.value?.settingsExist || config.value?.configExist),
      heartbeat.status === 'fulfilled' && heartbeat.value?.isActive
    ];

    const activeIndicators = indicators.filter(Boolean).length;
    const confidence = activeIndicators / indicators.length;

    // Se almeno 2/4 indicatori sono attivi, consideriamo Claude Code attivo
    const isRunning = activeIndicators >= 2;

    return {
      isRunning,
      confidence,
      pid: process.status === 'fulfilled' ? process.value?.pid : undefined,
      startTime: process.status === 'fulfilled' ? process.value?.startTime : undefined,
      memoryUsage: process.status === 'fulfilled' ? process.value?.memoryUsage : undefined,
      port: port.status === 'fulfilled' ? port.value?.port : undefined,
      lastHeartbeat: heartbeat.status === 'fulfilled' ? heartbeat.value?.lastSeen : undefined
    };
  }

  /**
   * Metodo principale per monitoraggio completo
   */
  async checkClaudeCodeStatus(): Promise<ClaudeCodeStatus> {
    try {
      // Esegui tutti i controlli in parallelo
      const [process, port, config, heartbeat] = await Promise.allSettled([
        this.checkClaudeCodeProcess(),
        this.checkClaudeCodePort(),
        this.checkConfigurationFiles(),
        this.readExistingHeartbeat()
      ]);

      const status = this.calculateConsensus(process, port, config, heartbeat);
      
      // Se Claude Code è attivo, crea/aggiorna heartbeat
      if (status.isRunning && status.pid && status.port) {
        await this.createHeartbeat({
          pid: status.pid,
          memoryUsage: status.memoryUsage || 0,
          port: status.port
        });
      }

      this.lastStatus = status;
      
      logger.debug("Claude Code status check completed", {
        isRunning: status.isRunning,
        confidence: status.confidence,
        indicators: {
          process: process.status === 'fulfilled' && process.value?.isRunning,
          port: port.status === 'fulfilled' && port.value?.isListening,
          config: config.status === 'fulfilled' && (config.value?.settingsExist || config.value?.configExist),
          heartbeat: heartbeat.status === 'fulfilled' && heartbeat.value?.isActive
        }
      });

      return status;

    } catch (error) {
      logger.error("Error in Claude Code status check", { error: error instanceof Error ? error.message : String(error) });
      return {
        isRunning: false,
        confidence: 0
      };
    }
  }

  /**
   * Avvia monitoraggio continuo
   */
  startMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    logger.info("Starting Claude Code heartbeat monitoring", { interval: intervalMs });
    
    return setInterval(async () => {
      const status = await this.checkClaudeCodeStatus();
      
      // Log solo se lo stato è cambiato
      if (status.isRunning !== this.lastStatus.isRunning) {
        logger.info("Claude Code status changed", {
          isRunning: status.isRunning,
          confidence: status.confidence,
          pid: status.pid,
          port: status.port
        });
      }
      
    }, intervalMs);
  }

  /**
   * Stima token basata su tempo di sessione e attività
   */
  private estimateCurrentTokens(): number {
    // Stima conservativa: ~1000 token per ora di sessione attiva
    const sessionDurationHours = 1; // Placeholder - da calcolare dinamicamente
    return Math.floor(sessionDurationHours * 1000);
  }

  /**
   * Genera ID sessione unico
   */
  private generateSessionId(): string {
    return `ctir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ottieni ultimo stato noto
   */
  getLastStatus(): ClaudeCodeStatus {
    return this.lastStatus;
  }

  /**
   * Verifica se Claude Code è attivo con alta confidenza
   */
  isClaudeCodeActive(): boolean {
    return this.lastStatus.isRunning && this.lastStatus.confidence > 0.6;
  }

  /**
   * Pulisci heartbeat file
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.heartbeatFile)) {
        await fs.promises.unlink(this.heartbeatFile);
        logger.info("Cleaned up Claude Code heartbeat file");
      }
    } catch (error) {
      logger.error("Failed to cleanup heartbeat file", { error: error instanceof Error ? error.message : String(error) });
    }
  }
}
