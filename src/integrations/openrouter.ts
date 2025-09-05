import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";

// OpenRouter API Integration
// Sostituisce l'integrazione Gemini con accesso unificato a modelli specializzati

export type OpenRouterModel = 
  | "qwen/qwen3-coder-480b-a35b-instruct"  // Technical Lead & Architecture
  | "openai/gpt-oss-120b"                   // Rapid Prototyping Specialist
  | "google/gemini-2.5-pro-experimental"    // Problem Solver & Research
  | "qwen/qwen2.5-coder-32b-instruct"       // Multi-Language Developer
  | "agentica-org/deepcoder-14b-preview";   // Efficiency Champion

interface OpenRouterMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

interface OpenRouterRequest {
  model: OpenRouterModel;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterIntegration {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";
  private usageDir: string;
  private rateLimitBuffer: number;

  // Circuit Breaker State
  private circuitState: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeout = 30000; // 30s

  // Model-specific configurations
  private readonly modelConfigs: Record<OpenRouterModel, {
    maxTokens: number;
    temperature: number;
    role: string;
    description: string;
  }> = {
    "qwen/qwen3-coder-480b-a35b-instruct": {
      maxTokens: 8192,
      temperature: 0.1,
      role: "Technical Lead & Architecture",
      description: "Progettazione sistemi complessi, code review architetturale"
    },
    "openai/gpt-oss-120b": {
      maxTokens: 4096,
      temperature: 0.2,
      role: "Rapid Prototyping Specialist",
      description: "Sviluppo iterativo rapido, debugging real-time"
    },
    "google/gemini-2.5-pro-experimental": {
      maxTokens: 8192,
      temperature: 0.1,
      role: "Problem Solver & Research",
      description: "Risoluzione problemi complessi, ragionamento multi-step"
    },
    "qwen/qwen2.5-coder-32b-instruct": {
      maxTokens: 4096,
      temperature: 0.15,
      role: "Multi-Language Developer",
      description: "Sviluppo cross-platform, manutenzione legacy code"
    },
    "agentica-org/deepcoder-14b-preview": {
      maxTokens: 2048,
      temperature: 0.05,
      role: "Efficiency Champion",
      description: "Ottimizzazione algoritmi, competitive programming"
    }
  };

  constructor() {
    this.apiKey = process.env.OPEN_ROUTER_API_KEY || "";
    if (!this.apiKey) {
      console.warn("OPEN_ROUTER_API_KEY is not set; OpenRouter integration will be unavailable");
    }
    this.usageDir = path.join(process.cwd(), "local-development", "backups");
    this.rateLimitBuffer = Number(process.env.CTIR_RATE_LIMIT_BUFFER || 0.8);
  }

  private getUsageFilePath(): string {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return path.join(this.usageDir, `openrouter-usage-${day}.json`);
  }

  private ensureUsageFile(): void {
    try {
      if (!fs.existsSync(this.usageDir)) {
        fs.mkdirSync(this.usageDir, { recursive: true });
      }
      
      const usageFile = this.getUsageFilePath();
      if (!fs.existsSync(usageFile)) {
        const today = new Date().toISOString().slice(0, 10);
        const initialData = { 
          total: 0, 
          models: {} as Record<string, number>,
          lastReset: today 
        };
        fs.writeFileSync(usageFile, JSON.stringify(initialData, null, 2));
        console.info("OpenRouter usage tracking initialized");
      }
    } catch (error) {
      console.error("Failed to ensure OpenRouter usage file:", error instanceof Error ? error.message : String(error));
    }
  }

  private incrementUsage(model: OpenRouterModel): void {
    try {
      this.ensureUsageFile();
      const usageFile = this.getUsageFilePath();
      
      let data: { total: number; models: Record<string, number>; lastReset: string };
      
      if (fs.existsSync(usageFile)) {
        const rawData = fs.readFileSync(usageFile, "utf-8");
        data = JSON.parse(rawData);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        data = { total: 0, models: {}, lastReset: today };
      }
      
      // Increment counters
      data.total += 1;
      data.models[model] = (data.models[model] || 0) + 1;
      
      // Write back to file
      fs.writeFileSync(usageFile, JSON.stringify(data, null, 2));
      
      console.info(`OpenRouter usage updated: ${data.total} total requests`);
      
    } catch (error) {
      console.error("Failed to update OpenRouter usage tracking:", error instanceof Error ? error.message : String(error));
    }
  }

  async healthCheck(timeoutMs = 5000): Promise<boolean> {
    logger.debug('Starting OpenRouter health check...', { circuitState: this.circuitState });
    
    if (!this.apiKey) {
      logger.warn("OpenRouter health check failed: OPEN_ROUTER_API_KEY not configured");
      return false;
    }

    // Circuit Breaker Logic
    if (this.circuitState === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.circuitState = "HALF_OPEN";
        logger.info("Circuit Breaker is now HALF_OPEN. Permitting a test call.");
      } else {
        logger.debug(`OpenRouter health check skipped: Circuit is OPEN. Will try again after ${this.resetTimeout / 1000}s.`);
        return false;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ctir.dev',
          'X-Title': 'CTIR - Claude Task Intelligence Router'
        },
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response structure");
      }

      // Success: reset circuit if it was HALF_OPEN
      if (this.circuitState === "HALF_OPEN") {
        logger.info("OpenRouter health check successful. Circuit is now CLOSED.");
        this.circuitState = "CLOSED";
        this.failureCount = 0;
      }

      logger.info("OpenRouter health check passed: API responsive");
      return true;

    } catch (error: any) {
      this.handleFailure(error);
      logger.debug('OpenRouter health check failed.', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private handleFailure(error: any): void {
    this.failureCount++;
    logger.debug('OpenRouter failure count incremented', { count: this.failureCount, circuitState: this.circuitState });
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
    logger.warn('OpenRouter API call failed', { 
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
    const dailyLimit = Number(process.env.OPENROUTER_DAILY_REQ_LIMIT || 1000);
    const bufferThreshold = Math.floor(dailyLimit * this.rateLimitBuffer);
    
    try {
      this.ensureUsageFile();
      const usageFile = this.getUsageFilePath();
      
      if (!fs.existsSync(usageFile)) {
        logger.info("OpenRouter credit tracking: No usage file found, assuming fresh start");
        return true;
      }

      const rawData = fs.readFileSync(usageFile, "utf-8");
      const data = JSON.parse(rawData) as { total: number; models: Record<string, number>; lastReset: string };
      
      const today = new Date().toISOString().slice(0, 10);
      const lastReset = data.lastReset || today;
      
      if (lastReset !== today) {
        const resetData = { total: 0, models: {}, lastReset: today };
        fs.writeFileSync(usageFile, JSON.stringify(resetData, null, 2));
        logger.info("OpenRouter credit tracking: Daily reset applied");
        return true;
      }

      const currentUsage = data.total || 0;
      const available = currentUsage < bufferThreshold;
      
      if (!available) {
        logger.warn(`OpenRouter credit limit reached`, { usage: currentUsage, threshold: bufferThreshold });
      } else {
        logger.info(`OpenRouter credit status`, { usage: currentUsage, threshold: bufferThreshold });
      }
      
      return available;

    } catch (error) {
      logger.error("OpenRouter credit tracking failed", { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

  async generate(params: {
    model: OpenRouterModel;
    messages: OpenRouterMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    logger.debug('Starting OpenRouter generate call...', { model: params.model, circuitState: this.circuitState });
    
    if (!this.apiKey) {
      throw new Error("OPEN_ROUTER_API_KEY missing");
    }

    if (this.circuitState === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.circuitState = "HALF_OPEN";
        logger.info("Circuit Breaker is now HALF_OPEN. Permitting a test call.");
      } else {
        logger.debug(`Circuit is OPEN. OpenRouter API is unavailable. Bypassed for ${this.resetTimeout / 1000}s.`);
        throw new Error(`Circuit is OPEN. OpenRouter API is unavailable. Bypassed for ${this.resetTimeout / 1000}s.`);
      }
    }

    const { model, messages, temperature, maxTokens } = params;
    const config = this.modelConfigs[model];
    
    const requestBody: OpenRouterRequest = {
      model,
      messages,
      temperature: temperature ?? config.temperature,
      max_tokens: maxTokens ?? config.maxTokens,
      stream: false
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ctir.dev',
          'X-Title': 'CTIR - Claude Task Intelligence Router'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response choices available");
      }

      const content = data.choices[0].message.content;
      
      if (!content) {
        throw new Error("Empty response content");
      }

      // Success: reset circuit if it was HALF_OPEN
      if (this.circuitState === "HALF_OPEN") {
        logger.info("OpenRouter call successful. Circuit is now CLOSED.");
        this.circuitState = "CLOSED";
      }
      this.failureCount = 0;

      this.incrementUsage(model);
      logger.debug('OpenRouter generate call successful.', { 
        model: params.model, 
        tokens: data.usage?.total_tokens || 0 
      });
      
      return content;

    } catch (err: any) {
      this.handleFailure(err);
      logger.debug('OpenRouter generate call failed.', { 
        model: params.model, 
        errorMessage: err.message 
      });
      throw new Error(`OpenRouter API call failed: ${err.message || 'Unknown error'}`);
    }
  }

  // Utility method to get model information
  getModelInfo(model: OpenRouterModel): { role: string; description: string; maxTokens: number; temperature: number } {
    const config = this.modelConfigs[model];
    return {
      role: config.role,
      description: config.description,
      maxTokens: config.maxTokens,
      temperature: config.temperature
    };
  }

  // Get all available models
  getAllModels(): OpenRouterModel[] {
    return Object.keys(this.modelConfigs) as OpenRouterModel[];
  }

  /**
   * Esegue un task usando il modello specificato
   */
  async executeTask(model: string, task: string, context?: string): Promise<string> {
    try {
      const messages: OpenRouterMessage[] = [
        {
          role: "system",
          content: `You are a specialized AI coding assistant. Execute the following task: ${task}`
        },
        {
          role: "user",
          content: context ? `${task}\n\nContext: ${context}` : task
        }
      ];

      const response = await this.generate({
        model: model as OpenRouterModel,
        messages,
        temperature: 0.7,
        maxTokens: 4000
      });

      return response;
    } catch (error) {
      logger.error("Failed to execute task via OpenRouter", { error, model, task });
      throw error;
    }
  }
}
