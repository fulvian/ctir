import { TaskClassifier } from "@/core/classifier";
import { RoutingEngine } from "@/core/router";
import { WorkStatePersistence, SessionTimingTracker, AutoResumeEngine } from "@/core/autoResume";
import { ClaudeCodeMonitor } from "@/core/claude-monitor";
import { loadConfig } from "@/utils/config";
import { logger } from "@/utils/logger";
import { MCPIntegration } from "@/integrations/mcp";
import { FileCCRAdapter } from "@/integrations/ccr-adapter";
import { CCRIntegration } from "@/integrations/ccr";
import { CCSessionsIntegration } from "@/integrations/cc-sessions";
import { GeminiIntegration } from "@/integrations/gemini";
import { CTIRProxy } from "@/integrations/ctir-proxy";
import { checkNodeVersion, checkDatabase, checkOllama } from "@/utils/health";

export class CTIRCore {
  private classifier = new TaskClassifier();
  private router = new RoutingEngine();
  private persistence = new WorkStatePersistence();
  private timing = new SessionTimingTracker();
  private autoResume = new AutoResumeEngine();
  private claudeMonitor = new ClaudeCodeMonitor(this.autoResume);
  private mcp = new MCPIntegration();
  private gemini = new GeminiIntegration();
  private ccr = new CCRIntegration();
  private ccs = new CCSessionsIntegration();
  private ccrState = new FileCCRAdapter();
  private proxy = new CTIRProxy();
  private mcpAvailable = false;
  private ccrAvailable = false;
  private dbOk = false;
  private ollamaOk = false;
  private geminiOk = false;

  async start(): Promise<void> {
    const cfg = loadConfig();
    logger.info(`CTIR v${cfg.ctir.version} [${cfg.ctir.mode}] starting...`);
    await this.timing.trackSessionStart(new Date());

    // Start CTIR Proxy for intelligent routing
    this.proxy.start();

    // Start active token monitoring
    await this.autoResume.startTokenMonitoring();

    // Start Claude Code monitoring
    await this.claudeMonitor.startMonitoring();

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

    // Gemini health and credit
    try {
      this.geminiOk = await this.gemini.healthCheck();
      this.router.setGeminiAvailability(this.geminiOk);
      const credit = this.gemini.isCreditAvailable();
      this.router.setGeminiCreditAvailable(credit);
      if (this.geminiOk) logger.info(`Gemini available (credit: ${credit ? "yes" : "near/at limit"})`);
      else logger.warn("Gemini not available; routing will skip Gemini strategies");
    } catch (err) {
      logger.warn("Gemini health-check failed; assuming unavailable", { error: err instanceof Error ? err.message : String(err) });
      this.router.setGeminiAvailability(false);
      this.router.setGeminiCreditAvailable(false);
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
      const inFallback = this.autoResume.isInFallback();
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
          ollamaAvailable: this.ollamaOk
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

  public getGeminiIntegration(): GeminiIntegration {
    return this.gemini;
  }
  // --- END: Getters for Dependency Injection ---
}
