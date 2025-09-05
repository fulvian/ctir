import { logger } from "@/utils/logger";
import { RoutingDecision } from "@/models/routing";
import { SessionState, ModernSessionManager } from "./modern-session-manager";

export interface ModelIndicatorData {
  currentModel: string;
  modelProvider: string;
  routingStrategy: string;
  confidence: number;
  sessionState: SessionState;
  tokenUsage?: {
    percentage: number;
    warning: string;
  };
  lastUpdate: Date;
}

export interface ModelIndicatorConfig {
  enabled: boolean;
  updateInterval: number; // ms
  showTokenUsage: boolean;
  showConfidence: boolean;
  showRoutingReason: boolean;
  customFormat?: string;
}

export class ModelIndicator {
  private config: ModelIndicatorConfig;
  private currentData?: ModelIndicatorData;
  private updateInterval?: NodeJS.Timeout;
  private sessionManager: ModernSessionManager;
  private lastRoutingDecision?: RoutingDecision;

  constructor(sessionManager: ModernSessionManager, config?: Partial<ModelIndicatorConfig>) {
    this.sessionManager = sessionManager;
    this.config = {
      enabled: true,
      updateInterval: 5000, // 5 secondi
      showTokenUsage: true,
      showConfidence: true,
      showRoutingReason: false,
      ...config
    };
  }

  /**
   * Avvia il monitoraggio e aggiornamento dell'indicatore
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Model indicator disabled");
      return;
    }

    logger.info("Starting Model Indicator", { config: this.config });

    // Prima lettura immediata
    await this.updateIndicator();

    // Avvia aggiornamento periodico
    this.updateInterval = setInterval(async () => {
      await this.updateIndicator();
    }, this.config.updateInterval);
  }

  /**
   * Ferma il monitoraggio
   */
  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    logger.info("Model Indicator stopped");
  }

  /**
   * Aggiorna l'indicatore con i dati correnti
   */
  private async updateIndicator(): Promise<void> {
    try {
      const sessionState = this.sessionManager.getCurrentState();
      const tokenStatus = this.sessionManager.getTokenStatus();
      const tokenUsage = this.sessionManager.getTokenUsage();

      // Determina il modello corrente basato sullo stato della sessione
      const modelData = this.determineCurrentModel(sessionState, tokenStatus);

      this.currentData = {
        currentModel: modelData.model,
        modelProvider: modelData.provider,
        routingStrategy: modelData.strategy,
        confidence: modelData.confidence,
        sessionState,
        tokenUsage: tokenUsage ? {
          percentage: Math.round(tokenUsage.percentageUsed * 100),
          warning: tokenUsage.warning.message
        } : undefined,
        lastUpdate: new Date()
      };

      // Log per debug
      logger.debug("Model indicator updated", {
        model: this.currentData.currentModel,
        provider: this.currentData.modelProvider,
        strategy: this.currentData.routingStrategy,
        sessionState: this.currentData.sessionState,
        tokenUsage: this.currentData.tokenUsage?.percentage
      });

    } catch (error) {
      logger.error("Error updating model indicator", { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Determina il modello corrente basato sullo stato della sessione
   */
  private determineCurrentModel(sessionState: SessionState, tokenStatus?: any): {
    model: string;
    provider: string;
    strategy: string;
    confidence: number;
  } {
    // Se abbiamo una decisione di routing recente, usala
    if (this.lastRoutingDecision) {
      return {
        model: this.lastRoutingDecision.model || "claude-3-5-sonnet-20241022",
        provider: this.getProviderFromStrategy(this.lastRoutingDecision.strategy),
        strategy: this.lastRoutingDecision.strategy,
        confidence: this.lastRoutingDecision.confidence
      };
    }

    // Altrimenti, determina basato sullo stato della sessione
    switch (sessionState) {
      case SessionState.ACTIVE:
        return {
          model: "claude-3-5-sonnet-20241022",
          provider: "Anthropic",
          strategy: "claude_direct",
          confidence: 0.9
        };

      case SessionState.TOKEN_LIMIT_APPROACHING:
        return {
          model: "claude-3-5-sonnet-20241022",
          provider: "Anthropic",
          strategy: "claude_direct",
          confidence: 0.7
        };

      case SessionState.TOKEN_LIMIT_REACHED:
      case SessionState.FALLBACK_MODE:
        return {
          model: "openai/gpt-oss-120b",
          provider: "OpenRouter",
          strategy: "openrouter_prototyping",
          confidence: 0.6
        };

      case SessionState.RESET_PENDING:
        return {
          model: "qwen/qwen2.5-coder-32b-instruct",
          provider: "OpenRouter",
          strategy: "openrouter_multilang",
          confidence: 0.5
        };

      default:
        return {
          model: "unknown",
          provider: "Unknown",
          strategy: "unknown",
          confidence: 0.0
        };
    }
  }

  /**
   * Ottiene il provider dal nome della strategia
   */
  private getProviderFromStrategy(strategy: string): string {
    if (strategy.startsWith("claude_")) return "Anthropic";
    if (strategy.startsWith("openrouter_")) return "OpenRouter";
    if (strategy.startsWith("ccr_")) return "CCR Local";
    if (strategy.startsWith("mcp_")) return "MCP Local";
    return "Unknown";
  }

  /**
   * Aggiorna la decisione di routing corrente
   */
  updateRoutingDecision(decision: RoutingDecision): void {
    this.lastRoutingDecision = decision;
    logger.debug("Routing decision updated", {
      strategy: decision.strategy,
      model: decision.model,
      confidence: decision.confidence
    });
  }

  /**
   * Genera l'indicatore formattato per il footer
   */
  getFormattedIndicator(): string {
    if (!this.currentData) {
      return "🎭 CTIR: Initializing...";
    }

    const { currentModel, modelProvider, routingStrategy, confidence, sessionState, tokenUsage } = this.currentData;

    // Icone per provider
    const providerIcons: Record<string, string> = {
      "Anthropic": "🎭",
      "OpenRouter": "🔄",
      "CCR Local": "🏠",
      "MCP Local": "⚙️",
      "Unknown": "❓"
    };

    const icon = providerIcons[modelProvider] || "❓";

    // Nome modello semplificato
    const modelName = this.simplifyModelName(currentModel);

    // Colore basato sullo stato
    const stateColors: Record<SessionState, string> = {
      [SessionState.ACTIVE]: "🟢",
      [SessionState.TOKEN_LIMIT_APPROACHING]: "🟡",
      [SessionState.TOKEN_LIMIT_REACHED]: "🔴",
      [SessionState.FALLBACK_MODE]: "🟠",
      [SessionState.RESET_PENDING]: "⏳",
      [SessionState.UNKNOWN]: "❓"
    };

    const stateIcon = stateColors[sessionState] || "❓";

    // Costruisci l'indicatore
    let indicator = `${icon} CTIR: ${modelName} (${modelProvider})`;

    if (this.config.showConfidence) {
      indicator += ` | Conf: ${Math.round(confidence * 100)}%`;
    }

    if (this.config.showTokenUsage && tokenUsage) {
      const tokenColor = tokenUsage.percentage >= 90 ? "🔴" : 
                        tokenUsage.percentage >= 75 ? "🟡" : "🟢";
      indicator += ` | ${tokenColor} ${tokenUsage.percentage}%`;
    }

    indicator += ` | ${stateIcon} ${sessionState}`;

    if (this.config.showRoutingReason && this.lastRoutingDecision?.reasoning) {
      indicator += ` | ${this.lastRoutingDecision.reasoning}`;
    }

    return indicator;
  }

  /**
   * Semplifica il nome del modello per la visualizzazione
   */
  private simplifyModelName(modelName: string): string {
    const modelMap: Record<string, string> = {
      "claude-3-5-sonnet-20241022": "Sonnet 4",
      "openai/gpt-oss-120b": "GPT-OSS-120B",
      "qwen/qwen2.5-coder-32b-instruct": "Qwen2.5-32B",
      "qwen/qwen3-coder-480b-a35b-instruct": "Qwen3-480B",
      "google/gemini-2.5-pro-experimental": "Gemini 2.5 Pro",
      "agentica-org/deepcoder-14b-preview": "DeepCoder-14B",
      "qwen2.5-coder:7b": "Qwen2.5-7B"
    };

    return modelMap[modelName] || modelName.split('/').pop() || modelName;
  }

  /**
   * Ottiene i dati correnti dell'indicatore
   */
  getCurrentData(): ModelIndicatorData | undefined {
    return this.currentData;
  }

  /**
   * Aggiorna la configurazione
   */
  updateConfig(newConfig: Partial<ModelIndicatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("Model indicator config updated", { config: this.config });
  }

  /**
   * Genera un report dettagliato per debug
   */
  getDebugReport(): any {
    return {
      config: this.config,
      currentData: this.currentData,
      lastRoutingDecision: this.lastRoutingDecision,
      sessionState: this.sessionManager.getCurrentState(),
      tokenStatus: this.sessionManager.getTokenStatus(),
      isActive: this.updateInterval !== undefined
    };
  }
}
