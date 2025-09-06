import { TaskClassifier } from "@/core/classifier";
import { RoutingEngine } from "@/core/router";
import { WorkStatePersistence, SessionTimingTracker, AutoResumeEngine } from "@/core/autoResume";
import { ClaudeCodeMonitor } from "@/core/claude-monitor";
import { ModernSessionManager } from "@/core/modern-session-manager";
import { ModelIndicator } from "@/core/model-indicator";
import { ClaudeSessionMonitor, OpenRouterConfig } from "@/core/claude-session-monitor";
import { MCPModelServiceManager } from "@/core/mcp-model-service";
import { loadConfig } from "@/utils/config";
import { logger } from "@/utils/logger";
import { MCPIntegration } from "@/integrations/mcp";
import { FileCCRAdapter } from "@/integrations/ccr-adapter";
import { CCRIntegration } from "@/integrations/ccr";
import { CCSessionsIntegration } from "@/integrations/cc-sessions";
import { GeminiIntegration } from "@/integrations/gemini";
import { OpenRouterIntegration } from "@/integrations/openrouter";
import { CTIRProxy } from "@/integrations/ctir-proxy";
import { checkNodeVersion, checkDatabase, checkOllama } from "@/utils/health";

export class CTIRCore {
  private classifier = new TaskClassifier();
  private router = new RoutingEngine();
  private persistence = new WorkStatePersistence();
  private timing = new SessionTimingTracker();
  private autoResume = new AutoResumeEngine();
  private claudeMonitor = new ClaudeCodeMonitor(this.autoResume);
  private modernSessionManager = new ModernSessionManager(this.autoResume);
  private modelIndicator = new ModelIndicator(this.modernSessionManager);
  private mcp = new MCPIntegration();
  private gemini = new GeminiIntegration();
  private openRouter = new OpenRouterIntegration();
  private ccr = new CCRIntegration();
  private ccs = new CCSessionsIntegration();
  private ccrState = new FileCCRAdapter();
  private proxy = new CTIRProxy();
  
  // Nuovo sistema di routing dinamico
  private sessionMonitor: ClaudeSessionMonitor;
  private mcpServiceManager: MCPModelServiceManager;
  
  private mcpAvailable = false;
  private ccrAvailable = false;
  private dbOk = false;
  private ollamaOk = false;
  private geminiOk = false;
  private openRouterOk = false;

  async start(): Promise<void> {
    const cfg = loadConfig();
    logger.info(`CTIR v${cfg.ctir.version} [${cfg.ctir.mode}] starting...`);
    await this.timing.trackSessionStart(new Date());

    // Inizializza il sistema di routing dinamico
    await this.initializeDynamicRouting();

    // Start CTIR Proxy for intelligent routing
    this.proxy.start();
    this.proxy.setCTIRCore(this);

    // Ensure cc-sessions project bootstrap (config + structure)
    try {
      await this.ccs.bootstrapProjectIfNeeded();
      // Fire session-start hook with basic context
      await this.ccs.onSessionStart({
        workspace: { current_dir: process.cwd() },
        model: { display_name: 'Claude Sonnet 4' },
        session_id: 'ctir-session'
      });
    } catch (e) {
      logger.warn('cc-sessions bootstrap failed', { error: e instanceof Error ? e.message : String(e) });
    }

    // Start modern session management (replaces old monitoring)
    await this.modernSessionManager.start();

    // Start model indicator for footer display
    await this.modelIndicator.start();

    // DEPRECATED: Keep old monitoring for compatibility (will be removed)
    // await this.autoResume.startTokenMonitoring();
    // await this.claudeMonitor.startMonitoring();

    // Basic environment checks
    const nodeOk = await checkNodeVersion(18);
    if (!nodeOk) logger.warn(`Node.js ${process.versions.node} detected; 18+ recommended`);
    const dbPath = process.env.DB_PATH || "./local-development/ctir.db";
    this.dbOk = await checkDatabase(dbPath);
    if (!this.dbOk) logger.warn("Database check failed; ensure DB path is writable and setup was run");
    this.ollamaOk = await checkOllama();
    if (this.ollamaOk) logger.info("Ollama reachable");
    else logger.warn("Ollama not reachable; MCP tools will likely fail");
    // TODO: initialize integrations (cc-sessions, CCR, MCP) lazily

    // Health-check MCP (ctir-ollama-mcp) and set router availability
    try {
      this.mcpAvailable = await this.mcp.healthCheckCtirOllama();
      this.router.setMcpAvailability(this.mcpAvailable);
      if (this.mcpAvailable) logger.info("MCP (ctir-ollama-mcp) available");
      else logger.warn("MCP (ctir-ollama-mcp) not available; routing will avoid MCP delegation");
    } catch (err) {
      logger.warn("MCP health-check failed; assuming unavailable", { error: err instanceof Error ? err.message : String(err) });
      this.mcpAvailable = false;
      this.router.setMcpAvailability(false);
    }

    // OpenRouter health and credit (replaces Gemini)
    try {
      this.openRouterOk = await this.openRouter.healthCheck();
      this.router.setOpenRouterAvailability(this.openRouterOk);
      const credit = this.openRouter.isCreditAvailable();
      this.router.setOpenRouterCreditAvailable(credit);
      if (this.openRouterOk) logger.info(`OpenRouter available (credit: ${credit ? "yes" : "near/at limit"})`);
      else logger.warn("OpenRouter not available; routing will skip OpenRouter strategies");
    } catch (err) {
      logger.warn("OpenRouter health-check failed; assuming unavailable", { error: err instanceof Error ? err.message : String(err) });
      this.router.setOpenRouterAvailability(false);
      this.router.setOpenRouterCreditAvailable(false);
    }

    // Gemini health and credit (DEPRECATED - mantenuto per compatibilità)
    try {
      this.geminiOk = await this.gemini.healthCheck();
      // Non impostiamo più Gemini nel router, è sostituito da OpenRouter
      if (this.geminiOk) logger.info("Gemini available (DEPRECATED - use OpenRouter instead)");
      else logger.warn("Gemini not available (DEPRECATED - use OpenRouter instead)");
    } catch (err) {
      logger.warn("Gemini health-check failed (DEPRECATED - use OpenRouter instead)", { error: err instanceof Error ? err.message : String(err) });
      this.geminiOk = false;
    }

    // CCR health (presence/installed)
    try {
      this.ccrAvailable = await this.ccr.healthCheck();
      this.router.setCcrAvailability(this.ccrAvailable);
      if (this.ccrAvailable) logger.info("CCR present and looks healthy");
      else logger.warn("CCR not found or invalid; routing will avoid CCR path");
    } catch {
      this.ccrAvailable = false;
      this.router.setCcrAvailability(false);
      logger.warn("CCR health-check failed; disabling CCR path");
    }

    // cc-sessions health (presence)
    try {
      const ok = await this.ccs.healthCheck();
      if (ok) logger.info("cc-sessions present");
      else logger.warn("cc-sessions not found; enhanced sessions disabled");
    } catch {
      logger.warn("cc-sessions health-check failed");
    }

    // Periodic re-check to update availability (every 60s)
    setInterval(async () => {
      try {
        const ok = await this.mcp.healthCheckCtirOllama();
        if (ok !== this.mcpAvailable) {
          this.mcpAvailable = ok;
          this.router.setMcpAvailability(ok);
          if (ok) logger.info("MCP became available; enabling MCP delegation");
          else logger.warn("MCP became unavailable; disabling MCP delegation");
        }
      } catch {
        if (this.mcpAvailable) {
          this.mcpAvailable = false;
          this.router.setMcpAvailability(false);
          logger.warn("MCP health-check error; disabling MCP delegation");
        }
      }
    }, 60_000);

    

    // Update routing/local-only + status file periodically
    setInterval(async () => {
      const inFallback = this.modernSessionManager.isInFallbackMode();
      try {
        // Keep router in sync with fallback/local-only mode
        if (inFallback) {
          this.router.enableLocalOnlyMode();
          await this.ccrState.enableLocalOnlyMode();
        } else {
          this.router.disableLocalOnlyMode();
          await this.ccrState.disableLocalOnlyMode();
        }

        await this.autoResume.updateStatusFile({
          status: inFallback ? "fallback_mode" : "active",
          fallbackMode: inFallback,
          mcpAvailable: this.mcpAvailable,
          ollamaAvailable: this.ollamaOk,
          openRouterAvailable: this.openRouterOk,
          modernSessionManager: true,
          sessionState: this.modernSessionManager.getCurrentState(),
          claudeCodeActive: this.modernSessionManager.isClaudeCodeActive()
        });
      } catch (error) {
        logger.error("Failed to sync routing/status:", { error: error instanceof Error ? error.message : String(error) });
      }
    }, 30_000); // Update every 30 seconds
  }

  // --- START: Getters for Dependency Injection ---
  public getAutoResumeEngine(): AutoResumeEngine {
    return this.autoResume;
  }

  public getModernSessionManager(): ModernSessionManager {
    return this.modernSessionManager;
  }

  public getModelIndicator(): ModelIndicator {
    return this.modelIndicator;
  }

  public getFormattedModelIndicator(): string {
    return this.modelIndicator.getFormattedIndicator();
  }

  // cc-sessions integration accessor
  public getCCSessionsIntegration(): CCSessionsIntegration {
    return this.ccs;
  }

  /**
   * Inizializza il sistema di routing dinamico
   */
  private async initializeDynamicRouting(): Promise<void> {
    try {
      // Configurazione OpenRouter
      const openRouterConfig: OpenRouterConfig = {
        apiKey: process.env.OPEN_ROUTER_API_KEY || "",
        baseURL: "https://openrouter.ai/api/v1",
        models: {
          default: "anthropic/claude-3.5-sonnet",
          longContext: "anthropic/claude-3.5-sonnet",
          background: "meta-llama/llama-3.1-8b-instruct"
        }
      };

      // Inizializza il monitor della sessione Claude
      this.sessionMonitor = new ClaudeSessionMonitor(
        openRouterConfig,
        process.env.CLAUDE_API_KEY
      );

      // Inizializza il manager dei servizi MCP
      this.mcpServiceManager = new MCPModelServiceManager(
        openRouterConfig,
        process.env.CLAUDE_API_KEY
      );

      // Verifica lo stato iniziale della sessione Claude
      const sessionStatus = await this.sessionMonitor.checkClaudeSessionStatus();
      logger.info("Claude session status initialized", { sessionStatus });

      // Aggiorna la configurazione del router se necessario
      await this.sessionMonitor.updateRouterConfigIfNeeded();

      logger.info("Dynamic routing system initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize dynamic routing system", { error });
      throw error;
    }
  }

  /**
   * Ottiene lo stato della sessione Claude
   */
  async getClaudeSessionStatus() {
    return await this.sessionMonitor.checkClaudeSessionStatus();
  }

  /**
   * Ottiene le statistiche dei servizi MCP
   */
  getMCPServiceStats() {
    return this.mcpServiceManager.getServiceStats();
  }

  /**
   * Esegue una richiesta usando il sistema MCP
   */
  async executeMCPRequest(request: any, context?: any) {
    return await this.mcpServiceManager.executeRequest(request, context);
  }
  // --- END: Getters for Dependency Injection ---
}
