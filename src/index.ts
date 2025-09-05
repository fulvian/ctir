import { loadEnvConfig } from "@/utils/config";
import { logger } from "@/utils/logger";
import { CTIRCore } from "@/core/engine";
import { setupMetricsServer } from "@/utils/metrics";

async function main() {
  loadEnvConfig();
  logger.info("Starting CTIR...");
  const core = new CTIRCore();
  await core.start();

  // Setup and start the metrics server
  setupMetricsServer({
    modernSessionManager: core.getModernSessionManager(),
    autoResume: core.getAutoResumeEngine(),
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("CTIR failed to start", err);
  process.exit(1);
});

