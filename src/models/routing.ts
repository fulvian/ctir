export type RoutingStrategy = 
  | "claude_direct"           // Sonnet 4 - Modello principale e orchestratore
  | "openrouter_technical"    // Qwen3-Coder-480B - Technical Lead & Architecture
  | "openrouter_prototyping"  // GPT-OSS-120B - Rapid Prototyping Specialist
  | "openrouter_research"     // Gemini 2.5 Pro - Problem Solver & Research
  | "openrouter_multilang"    // Qwen2.5-Coder-32B - Multi-Language Developer
  | "openrouter_efficiency"   // DeepCoder-14B - Efficiency Champion
  | "hybrid_approach"         // Approccio ibrido multi-modello
  | "fallback_mode";          // Modalità fallback

export interface RoutingDecision {
  strategy: RoutingStrategy;
  model?: string;
  confidence: number;
  reasoning: string;
  estimatedTokens: number;
  contextStrategy: 'minimal' | 'full' | 'incremental';
  fallbackModel?: string;
}

export interface TokenBudget {
  remaining: number; // 0-1 normalized remaining budget
}

export interface ModelAvailability {
  [key: string]: boolean;
}

export interface RoutingContext {
  taskComplexity: number;
  taskCategory: string;
  contextFiles: string[];
  tokenBudget: number;
  userPreferences: any;
  modelPerformance: Map<string, any>;
}

