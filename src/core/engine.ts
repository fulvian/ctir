import { TaskClassifier } from "@/core/classifier";
import { RoutingEngine } from "@/core/router";
import { WorkStatePersistence, SessionTimingTracker } from "@/core/autoResume";
import { loadConfig } from "@/utils/config";
import { logger } from "@/utils/logger";
import { MCPIntegration } from "@/integrations/mcp";
import { CCRIntegration } from "@/integrations/ccr";
import { CCSessionsIntegration } from "@/integrations/cc-sessions";
import { checkNodeVersion, checkDatabase, checkOllama } from "@/utils/health";

export class CTIRCore {
  private classifier = new TaskClassifier();
  private router = new RoutingEngine();
  private persistence = new WorkStatePersistence();
  private timing = new SessionTimingTracker();
  private mcp = new MCPIntegration();
  private ccr = new CCRIntegration();
  private ccs = new CCSessionsIntegration();
  private mcpAvailable = false;
  private ccrAvailable = false;
  private dbOk = false;
  private ollamaOk = false;

  async start(): Promise<void> {
    const cfg = loadConfig();
    logger.info(`CTIR v${cfg.ctir.version} [${cfg.ctir.mode}] starting...`);
    await this.timing.trackSessionStart(new Date());

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
      logger.warn("MCP health-check failed; assuming unavailable", err);
      this.mcpAvailable = false;
      this.router.setMcpAvailability(false);
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
  }
}
