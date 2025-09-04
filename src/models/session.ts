import type { RoutingDecision } from "@/models/routing";

export interface TokenBudget {
  limit: number; // absolute tokens per window
  used: number;
}

export interface ModelMetrics {
  name: string;
  averageLatency?: number;
  successRate?: number;
  qualityScore?: number;
}

export interface ContextWindowInfo {
  size: number;
}

export interface CTIRSession {
  id: string;
  routingHistory: RoutingDecision[];
  tokenBudget: TokenBudget;
  modelPerformanceMetrics: ModelMetrics[];
  contextWindow: ContextWindowInfo;
  userPreferences?: Record<string, unknown>;
}

