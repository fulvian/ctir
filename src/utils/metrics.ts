import express from 'express';
import { ModernSessionManager } from '../core/modern-session-manager';
import { AutoResumeEngine } from '../core/autoResume';
import { logger } from './logger';

// Interfacce per i servizi da cui dipendiamo
interface MetricsDependencies {
  modernSessionManager: ModernSessionManager;
  autoResume: AutoResumeEngine;
}

// Funzione per formattare le metriche in formato Prometheus
function getMetrics(dependencies: MetricsDependencies): string {
  const { modernSessionManager, autoResume } = dependencies;

  // Recupera gli stati dai servizi
  const sessionState = modernSessionManager.getCurrentState();
  const claudeCodeActive = modernSessionManager.isClaudeCodeActive();
  const tokenUsage = modernSessionManager.getTokenUsage();
  const sessionStatus = autoResume.getSessionStatus();

  const metrics = [
    '# HELP ctir_claude_session_status Lo stato della sessione di Claude Code.',
    '# TYPE ctir_claude_session_status gauge',
    `ctir_claude_session_status ${sessionStatus.isLimited ? 1 : 0}`,
    '',
    '# HELP ctir_modern_session_state Lo stato del Modern Session Manager.',
    '# TYPE ctir_modern_session_state gauge',
    `ctir_modern_session_state{state="${sessionState}"} 1`,
    '',
    '# HELP ctir_claude_code_active Se Claude Code è attivo.',
    '# TYPE ctir_claude_code_active gauge',
    `ctir_claude_code_active ${claudeCodeActive ? 1 : 0}`,
    '',
    '# HELP ctir_token_usage_percentage Percentuale di token utilizzati.',
    '# TYPE ctir_token_usage_percentage gauge',
    `ctir_token_usage_percentage ${tokenUsage ? tokenUsage.percentageUsed * 100 : 0}`,
  ];

  return metrics.join('\n');
}

export function setupMetricsServer(dependencies: MetricsDependencies) {
  const app = express();
  const port = process.env.METRICS_PORT || 9090;

  app.get('/metrics', (req, res) => {
    try {
      const metrics = getMetrics(dependencies);
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.end(metrics);
    } catch (error) {
      logger.error('Failed to generate metrics', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).send('Error generating metrics');
    } 
  });

  app.listen(port, () => {
    logger.info(`Metrics server listening on http://localhost:${port}/metrics`);
  });
}
