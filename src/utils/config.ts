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

  // Validate required files exist
  validateRequiredFiles();

  try {
    const raw = fs.readFileSync(cfgPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate configuration structure
    validateConfigStructure(parsed);

    cached = parsed as CTIRConfig;
    return cached;
  } catch (error) {
    throw new Error(`Failed to load configuration from ${cfgPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateRequiredFiles(): void {
  const requiredFiles = [
    { path: "config/default.json", description: "Main configuration file" },
    { path: "templates/auto-resume.md", description: "Auto-resume template" }
  ];

  const missingFiles: string[] = [];

  for (const file of requiredFiles) {
    const fullPath = path.join(process.cwd(), file.path);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(`${file.path} (${file.description})`);
    }
  }

  if (missingFiles.length > 0) {
    console.warn("⚠️  Missing required files:");
    missingFiles.forEach(file => console.warn(`   - ${file}`));
    console.warn("Some features may not work correctly. Run setup to create missing files.");
  }
}

function validateConfigStructure(config: any): void {
  const requiredFields = [
    "ctir.version",
    "ctir.mode",
    "ctir.tokenBudget",
    "ctir.models",
    "ctir.integrations"
  ];

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const keys = field.split(".");
    let current = config;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        missingFields.push(field);
        break;
      }
    }
  }

  if (missingFields.length > 0) {
    throw new Error(`Configuration validation failed. Missing required fields: ${missingFields.join(", ")}`);
  }

  // Validate specific values
  if (!["development", "production"].includes(config.ctir?.mode)) {
    console.warn(`⚠️  Invalid mode '${config.ctir?.mode}'. Expected 'development' or 'production'.`);
  }

  // Validate model configurations
  const models = config.ctir?.models;
  if (models) {
    const requiredModels = ["defaultDebugModel", "defaultGenerationModel", "defaultFormattingModel"];
    for (const model of requiredModels) {
      if (!models[model]) {
        console.warn(`⚠️  Missing model configuration: ${model}`);
      }
    }
  }
}

