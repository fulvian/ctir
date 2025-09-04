export type RoutingStrategy = "claude_direct" | "ccr_local" | "mcp_delegate";

export interface RoutingDecision {
  strategy: RoutingStrategy;
  model?: string;
  confidence: number;
  reasoning: string;
}

export interface TokenBudget {
  remaining: number; // 0-1 normalized remaining budget
}

