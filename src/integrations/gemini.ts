import fs from "fs";
import path from "path";
import { setTimeout as sleep } from "timers/promises";
import { logger } from "@/utils/logger";

// Lazy import inside methods to avoid hard failure if dependency missing at runtime

export type GeminiModel = "gemini-1.5-flash" | "gemini-1.5-pro";

interface GenerateParams {
  model: GeminiModel;
  messages: { role: "user" | "system" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

export class GeminiIntegration {
  private apiKey: string;
  private usageDir: string;
  private rateLimitBuffer: number;

  // --- START: Circuit Breaker State ---
  private circuitState: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3; // Failures to open the circuit
  private readonly resetTimeout = 30000; // 30s to move to HALF_OPEN
  // --- END: Circuit Breaker State ---

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    if (!this.apiKey) {
      // We don't throw here to allow the app to start; healthCheck will fail gracefully
      // eslint-disable-next-line no-console
      console.warn("GEMINI_API_KEY is not set; Gemini integration will be unavailable");
    }
    this.usageDir = path.join(process.cwd(), "local-development", "backups");
    this.rateLimitBuffer = Number(process.env.CTIR_RATE_LIMIT_BUFFER || 0.8);
  }

  private getUsageFilePath(): string {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return path.join(this.usageDir, `gemini-usage-${day}.json`);
  }

  private ensureUsageFile(): void {
    try {
      if (!fs.existsSync(this.usageDir)) {
        fs.mkdirSync(this.usageDir, { recursive: true });
      }
      
      const usageFile = this.getUsageFilePath();
      if (!fs.existsSync(usageFile)) {
        const today = new Date().toISOString().slice(0, 10);
        const initialData = { total: 0, pro: 0, flash: 0, lastReset: today };
        fs.writeFileSync(usageFile, JSON.stringify(initialData, null, 2));
        // eslint-disable-next-line no-console
        console.info("Gemini usage tracking initialized");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to ensure Gemini usage file:", error instanceof Error ? error.message : String(error));
    }
  }

  private incrementUsage(model: GeminiModel): void {
    try {
      this.ensureUsageFile();
      const usageFile = this.getUsageFilePath();
      
      let data: { total: number; pro: number; flash: number; lastReset: string };
      
      if (fs.existsSync(usageFile)) {
        const rawData = fs.readFileSync(usageFile, "utf-8");
        data = JSON.parse(rawData);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        data = { total: 0, pro: 0, flash: 0, lastReset: today };
      }
      
      // Increment counters
      data.total += 1;
      if (model === "gemini-1.5-pro") {
        data.pro += 1;
      } else {
        data.flash += 1;
      }
      
      // Write back to file
      fs.writeFileSync(usageFile, JSON.stringify(data, null, 2));
      
      // eslint-disable-next-line no-console
      console.info(`Gemini usage updated: ${data.total} total requests (${data.pro} Pro, ${data.flash} Flash)`);
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to update Gemini usage tracking:", error instanceof Error ? error.message : String(error));
    }
  }

  async healthCheck(timeoutMs = 3000): Promise<boolean> {
    logger.debug('Starting Gemini health check...', { circuitState: this.circuitState });
    if (!this.apiKey) {
      logger.warn("Gemini health check failed: GEMINI_API_KEY not configured");
      return false;
    }

    // --- START: Circuit Breaker Logic ---
    if (this.circuitState === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.circuitState = "HALF_OPEN";
        logger.info("Circuit Breaker is now HALF_OPEN. Permitting a test call.");
      } else {
        logger.debug(`Gemini health check skipped: Circuit is OPEN. Will try again after ${this.resetTimeout / 1000}s.`);
        return false;
      }
    }
    // --- END: Circuit Breaker Logic ---

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const client = new GoogleGenerativeAI(this.apiKey);
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
      );

      const healthPromise = model.generateContent({
        contents: [{ role: "user", parts: [{ text: "health" }]}],
        generationConfig: { maxOutputTokens: 1, temperature: 0.0 }
      });

      const result = await Promise.race([healthPromise, timeoutPromise]);
      
      const response = await result.response;
      if (!response || !response.text) {
        throw new Error("Invalid response structure");
      }

      // Success: reset circuit if it was HALF_OPEN
      if (this.circuitState === "HALF_OPEN") {
        logger.info("Gemini health check successful. Circuit is now CLOSED.");
        this.circuitState = "CLOSED";
        this.failureCount = 0;
      }
      logger.info("Gemini health check passed: API responsive");
      return true;

    } catch (error: any) {
      // Failure: handle circuit breaker logic
      this.handleFailure(error);
      logger.debug('Gemini health check failed.', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private handleFailure(error: any): void {
    this.failureCount++;
    logger.debug('Gemini failure count incremented', { count: this.failureCount, circuitState: this.circuitState });
    this.lastFailureTime = Date.now();

    if (this.circuitState === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      if (this.circuitState !== "OPEN") {
        this.circuitState = "OPEN";
        logger.error(`Circuit Breaker OPENED due to ${this.failureCount} consecutive failures.`, {
          failures: this.failureCount,
          timeout: this.resetTimeout / 1000
        });
      }
    }

    const errorMessage = error.message || 'Unknown error';
    logger.warn('Gemini API call failed', { 
      status: error.status, 
      message: errorMessage, 
      failureCount: this.failureCount 
    });
  }

  public getCircuitBreakerState(): { state: string; value: number } {
    switch (this.circuitState) {
      case 'OPEN':
        return { state: 'OPEN', value: 1 };
      case 'HALF_OPEN':
        return { state: 'HALF_OPEN', value: 2 };
      case 'CLOSED':
      default:
        return { state: 'CLOSED', value: 0 };
    }
  }

  isCreditAvailable(): boolean {
    const dailyLimit = Number(process.env.GEMINI_DAILY_REQ_LIMIT || 1500);
    const bufferThreshold = Math.floor(dailyLimit * this.rateLimitBuffer);
    
    try {
      this.ensureUsageFile();
      const usageFile = this.getUsageFilePath();
      
      if (!fs.existsSync(usageFile)) {
        logger.info("Gemini credit tracking: No usage file found, assuming fresh start");
        return true;
      }

      const rawData = fs.readFileSync(usageFile, "utf-8");
      const data = JSON.parse(rawData) as { total: number; pro: number; flash: number; lastReset: string };
      
      const today = new Date().toISOString().slice(0, 10);
      const lastReset = data.lastReset || today;
      
      if (lastReset !== today) {
        const resetData = { total: 0, pro: 0, flash: 0, lastReset: today };
        fs.writeFileSync(usageFile, JSON.stringify(resetData, null, 2));
        logger.info("Gemini credit tracking: Daily reset applied");
        return true;
      }

      const currentUsage = data.total || 0;
      const available = currentUsage < bufferThreshold;
      
      if (!available) {
        logger.warn(`Gemini credit limit reached`, { usage: currentUsage, threshold: bufferThreshold });
      } else {
        logger.info(`Gemini credit status`, { usage: currentUsage, threshold: bufferThreshold });
      }
      
      return available;

    } catch (error) {
      logger.error("Gemini credit tracking failed", { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

    async generate(params: GenerateParams): Promise<string> {
    logger.debug('Starting Gemini generate call...', { model: params.model, circuitState: this.circuitState });
    if (!this.apiKey) throw new Error("GEMINI_API_KEY missing");

    if (this.circuitState === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.circuitState = "HALF_OPEN";
        logger.info("Circuit Breaker is now HALF_OPEN. Permitting a test call.");
      } else {
        logger.debug(`Circuit is OPEN. Gemini API is unavailable. Bypassed for ${this.resetTimeout / 1000}s.`);
        throw new Error(`Circuit is OPEN. Gemini API is unavailable. Bypassed for ${this.resetTimeout / 1000}s.`);
      }
    }

    const { model, messages, temperature = 0.2, maxTokens = 2048 } = params;
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(this.apiKey);
    const gen = client.getGenerativeModel({ model });

    const contents = messages.map(m => ({ role: m.role, parts: [{ text: m.content }]}));

    try {
      const res: any = await gen.generateContent({
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      } as any);
      const text = res?.response?.text?.() ?? res?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      
      if (this.circuitState === "HALF_OPEN") {
        logger.info("Gemini call successful. Circuit is now CLOSED.");
        this.circuitState = "CLOSED";
      }
      this.failureCount = 0;

      this.incrementUsage(model);
      logger.debug('Gemini generate call successful.', { model: params.model });
      return text;

    } catch (err: any) {
      this.handleFailure(err);
      logger.debug('Gemini generate call failed.', { model: params.model, errorMessage: err.message });
      throw new Error(`Gemini API call failed: ${err.message || 'Unknown error'}`);
    }
  }
}

  


