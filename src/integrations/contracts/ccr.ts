/**
 * CTIR — CCR contract
 * Routing control for local model execution and strategy switching.
 */

export type RoutingStrategy = 'claude_direct' | 'ccr_local' | 'mcp_delegate';

export interface RoutingDecision {
  readonly strategy: RoutingStrategy;
  readonly model?: string;
  readonly confidence: number; // 0..1
  readonly reasoning: string;
}

export interface CCRAdapter {
  switchStrategy(decision: RoutingDecision): Promise<void>;
  enableLocalOnlyMode(): Promise<void>;
  disableLocalOnlyMode(): Promise<void>;
  isLocalOnlyModeEnabled(): Promise<boolean>;
}


