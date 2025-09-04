import { TaskClassifier } from "@/core/classifier";
import { RoutingEngine } from "@/core/router";
import { WorkStatePersistence, SessionTimingTracker } from "@/core/autoResume";
import { loadConfig } from "@/utils/config";
import { logger } from "@/utils/logger";

export class CTIRCore {
  private classifier = new TaskClassifier();
  private router = new RoutingEngine();
  private persistence = new WorkStatePersistence();
  private timing = new SessionTimingTracker();

  async start(): Promise<void> {
    const cfg = loadConfig();
    logger.info(`CTIR v${cfg.ctir.version} [${cfg.ctir.mode}] starting...`);
    await this.timing.trackSessionStart(new Date());
    // TODO: initialize integrations (cc-sessions, CCR, MCP) lazily
  }
}

