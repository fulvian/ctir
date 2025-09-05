import express from 'express';
import { GeminiIntegration } from '../integrations/gemini';
import { AutoResumeEngine } from '../core/autoResume';
import { logger } from './logger';

// Interfacce per i servizi da cui dipendiamo
interface MetricsDependencies {
  gemini: GeminiIntegration;
  autoResume: AutoResumeEngine;
}

// Funzione per formattare le metriche in formato Prometheus
function getMetrics(dependencies: MetricsDependencies): string {
  const { gemini, autoResume } = dependencies;

  // Recupera gli stati dai servizi
  const circuitState = gemini.getCircuitBreakerState(); // Metodo da aggiungere
  const sessionStatus = autoResume.getSessionStatus(); // Metodo da aggiungere

  const metrics = [
    '# HELP ctir_claude_session_status Lo stato della sessione di Claude Code.',
    '# TYPE ctir_claude_session_status gauge',
    `ctir_claude_session_status ${sessionStatus.isLimited ? 1 : 0}`,
    '',
    '# HELP ctir_gemini_circuit_breaker_status Lo stato del Circuit Breaker per le API di Gemini.',
    '# TYPE ctir_gemini_circuit_breaker_status gauge',
    `ctir_gemini_circuit_breaker_status{state="${circuitState.state}"} ${circuitState.value}`,
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
