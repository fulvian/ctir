import dotenv from "dotenv";
import fs from "fs";
import path from "path";

export interface CTIRConfig {
  ctir: {
    version: string;
    mode: "development" | "production";
    tokenBudget: {
      conservativeThreshold: number;
      aggressiveThreshold: number;
      criticalThreshold: number;
    };
    models: {
      localModelsPath: string;
      defaultDebugModel: string;
      defaultGenerationModel: string;
      defaultFormattingModel: string;
    };
    performance: {
      maxLatency: number;
      maxMemoryUsage: string;
      enableCaching: boolean;
      cacheSize: string;
    };
    integrations: {
      ccSessions: { enabled: boolean; enhancedTaskFiles: boolean };
      ccr: { enabled: boolean; autoSwitch: boolean };
      mcp: { enabled: boolean; servers: string[] };
    };
    autoResume: {
      enabled: boolean;
      sessionDuration: string;
      preparationTime: string;
      notificationsEnabled: boolean;
      backupInterval: string;
      maxResumeAttempts: number;
      resumePromptTemplate: string;
    };
  };
}

let cached: CTIRConfig | null = null;

export function loadEnvConfig(): void {
  dotenv.config();
}

export function loadConfig(): CTIRConfig {
  if (cached) return cached;
  const cfgPath = path.join(process.cwd(), "config", "default.json");
  const raw = fs.readFileSync(cfgPath, "utf-8");
  cached = JSON.parse(raw) as CTIRConfig;
  return cached;
}

