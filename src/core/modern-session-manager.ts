import { logger } from "@/utils/logger";
import { ClaudeCodeHeartbeatMonitor, type ClaudeCodeStatus } from "./claude-code-heartbeat";
import { ClaudeCodeTokenMonitor, type ClaudeCodeTokenUsage, type TokenWarning } from "./claude-code-token-monitor";
import { AutoResumeEngine } from "./autoResume";

export enum SessionState {
  ACTIVE = 'active',
  TOKEN_LIMIT_APPROACHING = 'token_limit_approaching',
  TOKEN_LIMIT_REACHED = 'token_limit_reached',
  FALLBACK_MODE = 'fallback_mode',
  RESET_PENDING = 'reset_pending',
  UNKNOWN = 'unknown'
}

export interface SessionTransition {
  from: SessionState;
  to: SessionState;
  timestamp: Date;
  reason: string;
  confidence: number;
}

export interface TokenUsage {
  totalContextTokens: number;
  tokenLimit: number;
  percentageUsed: number;
  warning: TokenWarning;
  lastUpdate: Date;
}

export interface ClaudeCodeTokenStatus {
  isActive: boolean;
  tokenUsage: TokenUsage;
  confidence: number;
  lastActivity: Date;
}

export class ModernSessionManager {
  private heartbeatMonitor = new ClaudeCodeHeartbeatMonitor();
  private tokenMonitor = new ClaudeCodeTokenMonitor();
  private autoResume: AutoResumeEngine;
  private currentState: SessionState = SessionState.UNKNOWN;
  private stateHistory: SessionTransition[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private lastClaudeCodeStatus?: ClaudeCodeStatus;
  private lastTokenStatus?: ClaudeCodeTokenStatus;
  
  // Configurazione Claude Code Pro (basata su cc-sessions)
  private readonly tokenLimit = 160000; // 160k practical limit (80% of 200k theoretical)
  private readonly tokenWarningThreshold = 0.75; // 75% warning
  private readonly tokenCriticalThreshold = 0.90; // 90% critical
  private readonly heartbeatIntervalMs = 30000; // 30 secondi
  private readonly maxStateHistory = 50;

  constructor(autoResume: AutoResumeEngine) {
    this.autoResume = autoResume;
  }

  /**
   * Avvia il sistema di monitoraggio moderno
   */
  async start(): Promise<void> {
    logger.info("Starting Modern Session Manager");
    
    // Reset warning flags for new session
    await this.tokenMonitor.resetWarningFlags();
    
    // Prima verifica immediata
    await this.performStatusCheck();
    
    // Avvia monitoraggio continuo
    this.monitoringInterval = this.heartbeatMonitor.startMonitoring(this.heartbeatIntervalMs);
    
    // Monitoraggio aggiuntivo per transizioni di stato
    setInterval(() => {
      this.performStatusCheck();
    }, this.heartbeatIntervalMs);
    
    logger.info("Modern Session Manager started", {
      heartbeatInterval: this.heartbeatIntervalMs,
      tokenLimit: this.tokenLimit,
      tokenWarningThreshold: this.tokenWarningThreshold
    });
  }

  /**
   * Ferma il sistema di monitoraggio
   */
  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    await this.heartbeatMonitor.cleanup();
    logger.info("Modern Session Manager stopped");
  }

  /**
   * Esegue controllo completo dello stato
   */
  private async performStatusCheck(): Promise<void> {
    try {
      const claudeCodeStatus = await this.heartbeatMonitor.checkClaudeCodeStatus();
      const tokenStatus = await this.checkTokenUsage(claudeCodeStatus);
      const newState = this.determineSessionState(claudeCodeStatus, tokenStatus);
      
      if (newState !== this.currentState) {
        await this.transitionToState(newState, claudeCodeStatus, tokenStatus);
      }
      
      this.lastClaudeCodeStatus = claudeCodeStatus;
      this.lastTokenStatus = tokenStatus;
      
    } catch (error) {
      logger.error("Error in status check", { error: error instanceof Error ? error.message : String(error) });
      await this.transitionToState(SessionState.UNKNOWN, undefined, undefined);
    }
  }

  /**
   * Controlla l'uso dei token Claude Code usando il transcript reale
   * Basato sul sistema cc-sessions
   */
  private async checkTokenUsage(claudeCodeStatus: ClaudeCodeStatus): Promise<ClaudeCodeTokenStatus> {
    // Se Claude Code non è attivo, non possiamo leggere il transcript
    if (!claudeCodeStatus.isRunning || claudeCodeStatus.confidence < 0.4) {
      return {
        isActive: false,
        tokenUsage: {
          totalContextTokens: 0,
          tokenLimit: this.tokenLimit,
          percentageUsed: 0,
          warning: { level: 'none', percentage: 0, message: 'Claude Code not active', shouldWarn: false },
          lastUpdate: new Date()
        },
        confidence: 0,
        lastActivity: new Date(0)
      };
    }

    // Trova e leggi il transcript di Claude Code
    const transcriptPath = await this.tokenMonitor.findClaudeCodeTranscript();
    if (!transcriptPath) {
      logger.debug("Claude Code transcript not found");
      return {
        isActive: true,
        tokenUsage: {
          totalContextTokens: 0,
          tokenLimit: this.tokenLimit,
          percentageUsed: 0,
          warning: { level: 'none', percentage: 0, message: 'Transcript not found', shouldWarn: false },
          lastUpdate: new Date()
        },
        confidence: claudeCodeStatus.confidence,
        lastActivity: new Date()
      };
    }

    // Leggi i token usage reali dal transcript
    const tokenUsage = await this.tokenMonitor.getTokenUsageFromTranscript(transcriptPath);
    if (!tokenUsage) {
      return {
        isActive: true,
        tokenUsage: {
          totalContextTokens: 0,
          tokenLimit: this.tokenLimit,
          percentageUsed: 0,
          warning: { level: 'none', percentage: 0, message: 'No usage data found', shouldWarn: false },
          lastUpdate: new Date()
        },
        confidence: claudeCodeStatus.confidence,
        lastActivity: new Date()
      };
    }

    // Calcola warning basato sui token reali
    const warning = await this.tokenMonitor.calculateTokenWarning(tokenUsage);
    const percentageUsed = tokenUsage.totalContextTokens / this.tokenLimit;

    return {
      isActive: true,
      tokenUsage: {
        totalContextTokens: tokenUsage.totalContextTokens,
        tokenLimit: this.tokenLimit,
        percentageUsed,
        warning,
        lastUpdate: new Date()
      },
      confidence: claudeCodeStatus.confidence,
      lastActivity: tokenUsage.timestamp
    };
  }

  /**
   * Determina lo stato della sessione basato su Claude Code e token usage reali
   */
  private determineSessionState(claudeCodeStatus: ClaudeCodeStatus, tokenStatus: ClaudeCodeTokenStatus): SessionState {
    // Se Claude Code non è attivo, siamo in fallback
    if (!claudeCodeStatus.isRunning || claudeCodeStatus.confidence < 0.4) {
      return SessionState.FALLBACK_MODE;
    }

    // Se Claude Code è attivo, controlla l'uso dei token reali
    const percentageUsed = tokenStatus.tokenUsage.percentageUsed;
    
    if (percentageUsed >= this.tokenCriticalThreshold) {
      return SessionState.TOKEN_LIMIT_REACHED;
    }
    
    if (percentageUsed >= this.tokenWarningThreshold) {
      return SessionState.TOKEN_LIMIT_APPROACHING;
    }
    
    return SessionState.ACTIVE;
  }

  /**
   * Gestisce transizione tra stati
   */
  private async transitionToState(newState: SessionState, claudeCodeStatus?: ClaudeCodeStatus, tokenStatus?: ClaudeCodeTokenStatus): Promise<void> {
    const oldState = this.currentState;
    const transition: SessionTransition = {
      from: oldState,
      to: newState,
      timestamp: new Date(),
      reason: this.getTransitionReason(oldState, newState, claudeCodeStatus, tokenStatus),
      confidence: claudeCodeStatus?.confidence || 0
    };

    // Aggiungi alla cronologia
    this.stateHistory.push(transition);
    if (this.stateHistory.length > this.maxStateHistory) {
      this.stateHistory.shift();
    }

    // Aggiorna stato
    this.currentState = newState;

    // Esegui azioni specifiche per stato
    await this.executeStateActions(newState, transition);

    logger.info("Session state transition", {
      from: oldState,
      to: newState,
      reason: transition.reason,
      confidence: transition.confidence,
      claudeCodeActive: claudeCodeStatus?.isRunning,
      tokenUsage: tokenStatus?.tokenUsage.percentageUsed ? `${(tokenStatus.tokenUsage.percentageUsed * 100).toFixed(1)}%` : 'N/A'
    });
  }

  /**
   * Genera ragione per transizione
   */
  private getTransitionReason(from: SessionState, to: SessionState, claudeCodeStatus?: ClaudeCodeStatus, tokenStatus?: ClaudeCodeTokenStatus): string {
    switch (to) {
      case SessionState.ACTIVE:
        return "Claude Code detected and token usage within limits";
      
      case SessionState.TOKEN_LIMIT_APPROACHING:
        const percentage = tokenStatus?.tokenUsage.percentageUsed ? (tokenStatus.tokenUsage.percentageUsed * 100).toFixed(1) : 'unknown';
        return `Token usage approaching limit (${percentage}% used)`;
      
      case SessionState.TOKEN_LIMIT_REACHED:
        return "Token limit reached - switching to fallback mode";
      
      case SessionState.FALLBACK_MODE:
        return claudeCodeStatus?.isRunning === false 
          ? "Claude Code process not detected"
          : "Claude Code confidence too low or token limit reached";
      
      case SessionState.RESET_PENDING:
        return "Waiting for Anthropic's automatic token reset (every 5 hours)";
      
      default:
        return "Unknown state transition";
    }
  }

  /**
   * Esegue azioni specifiche per ogni stato
   */
  private async executeStateActions(state: SessionState, transition: SessionTransition): Promise<void> {
    switch (state) {
      case SessionState.ACTIVE:
        await this.handleActiveState();
        break;
      
      case SessionState.TOKEN_LIMIT_APPROACHING:
        await this.handleTokenLimitApproachingState();
        break;
      
      case SessionState.TOKEN_LIMIT_REACHED:
        await this.handleTokenLimitReachedState();
        break;
      
      case SessionState.FALLBACK_MODE:
        await this.handleFallbackState();
        break;
      
      case SessionState.RESET_PENDING:
        await this.handleResetPendingState();
        break;
      
      default:
        logger.warn("Unknown session state", { state });
    }
  }

  /**
   * Gestisce stato attivo
   */
  private async handleActiveState(): Promise<void> {
    // Disabilita fallback mode se attivo
    if (this.autoResume.isInFallback()) {
      await this.autoResume.resetFallbackMode();
    }
    
    // Aggiorna status file
    await this.updateStatusFile({
      status: "active",
      fallbackMode: false,
      sessionState: SessionState.ACTIVE
    });
  }

  /**
   * Gestisce stato token limit approaching
   */
  private async handleTokenLimitApproachingState(): Promise<void> {
    // Prepara per possibile fallback
    await this.updateStatusFile({
      status: "token_limit_approaching",
      fallbackMode: false,
      sessionState: SessionState.TOKEN_LIMIT_APPROACHING,
      warning: "Token usage approaching 80% of limit"
    });
  }

  /**
   * Gestisce stato token limit reached
   */
  private async handleTokenLimitReachedState(): Promise<void> {
    // Attiva fallback mode
    await this.autoResume.enableFallbackMode();
    
    await this.updateStatusFile({
      status: "token_limit_reached",
      fallbackMode: true,
      sessionState: SessionState.TOKEN_LIMIT_REACHED,
      reason: "Token limit reached - using fallback models"
    });
  }

  /**
   * Gestisce stato fallback
   */
  private async handleFallbackState(): Promise<void> {
    // Attiva fallback mode
    if (!this.autoResume.isInFallback()) {
      await this.autoResume.enableFallbackMode();
    }
    
    await this.updateStatusFile({
      status: "fallback_mode",
      fallbackMode: true,
      sessionState: SessionState.FALLBACK_MODE,
      reason: "Claude Code not detected or confidence too low"
    });
  }

  /**
   * Gestisce stato reset pending
   */
  private async handleResetPendingState(): Promise<void> {
    // Attiva fallback e prepara reset
    await this.autoResume.enableFallbackMode();
    
    await this.updateStatusFile({
      status: "reset_pending",
      fallbackMode: true,
      sessionState: SessionState.RESET_PENDING,
      reason: "Waiting for Anthropic's automatic token reset (every 5 hours)"
    });
    
    // NON pianificare reset automatico - è gestito da Anthropic
    // this.scheduleAutomaticReset(); // RIMOSSO
  }


  /**
   * Aggiorna status file
   */
  private async updateStatusFile(updates: any): Promise<void> {
    try {
      await this.autoResume.updateStatusFile({
        ...updates,
        lastUpdate: new Date().toISOString(),
        modernSessionManager: true,
        claudeCodeStatus: this.lastClaudeCodeStatus
      });
    } catch (error) {
      logger.error("Failed to update status file", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Getters per stato corrente
   */
  getCurrentState(): SessionState {
    return this.currentState;
  }

  getStateHistory(): SessionTransition[] {
    return [...this.stateHistory];
  }

  getLastClaudeCodeStatus(): ClaudeCodeStatus | undefined {
    return this.lastClaudeCodeStatus;
  }

  isInFallbackMode(): boolean {
    return this.currentState === SessionState.FALLBACK_MODE || 
           this.currentState === SessionState.TOKEN_LIMIT_REACHED ||
           this.currentState === SessionState.RESET_PENDING;
  }

  isClaudeCodeActive(): boolean {
    // Claude Code è attivo se:
    // 1. Il processo è rilevato E
    // 2. La confidenza è sufficiente E  
    // 3. Non siamo in fallback mode per token limits
    const hasProcess = this.lastClaudeCodeStatus?.isRunning === true;
    const hasConfidence = (this.lastClaudeCodeStatus?.confidence || 0) >= 0.4;
    const notInTokenFallback = this.currentState !== SessionState.TOKEN_LIMIT_REACHED && 
                              this.currentState !== SessionState.RESET_PENDING;
    
    return hasProcess && hasConfidence && notInTokenFallback;
  }

  getTokenUsage(): TokenUsage | undefined {
    return this.lastTokenStatus?.tokenUsage;
  }

  getTokenStatus(): ClaudeCodeTokenStatus | undefined {
    return this.lastTokenStatus;
  }

  getTokenWarning(): TokenWarning | undefined {
    return this.lastTokenStatus?.tokenUsage.warning;
  }

  /**
   * Forza transizione a stato specifico (per testing)
   */
  async forceTransitionTo(state: SessionState, reason: string = "Manual override"): Promise<void> {
    const transition: SessionTransition = {
      from: this.currentState,
      to: state,
      timestamp: new Date(),
      reason,
      confidence: 1.0
    };

    this.stateHistory.push(transition);
    this.currentState = state;
    
    await this.executeStateActions(state, transition);
    
    logger.info("Forced state transition", { to: state, reason });
  }
}
