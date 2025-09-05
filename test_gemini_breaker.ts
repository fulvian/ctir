import { GeminiIntegration } from './src/integrations/gemini';
import { logger } from './src/utils/logger';
import * as dotenv from 'dotenv';

dotenv.config(); // Carica le variabili d'ambiente da .env

async function testCircuitBreaker() {
  logger.info('--- Starting Circuit Breaker Test ---');
  const gemini = new GeminiIntegration();

  for (let i = 1; i <= 4; i++) {
    logger.info(`Attempt ${i}...`);
    try {
      await gemini.generate({ 
        model: 'gemini-1.5-flash', 
        messages: [{ role: 'user', content: 'test' }] 
      });
    } catch (error: any) {
      logger.error(`Attempt ${i} failed as expected.`, { errorMessage: error.message });
    }
    // Piccola pausa tra i tentativi
    await new Promise(res => setTimeout(res, 200));
  }

  logger.info('--- Test Finished ---');
  logger.info('Check the logs above to see the circuit breaker status changes.');
  logger.info('Now, check the main CTIR server metrics endpoint: curl http://localhost:9090/metrics');

}

testCircuitBreaker();
