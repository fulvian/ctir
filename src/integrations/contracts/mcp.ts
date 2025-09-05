/**
 * CTIR — MCP contract
 * Client interface for local MCP servers (e.g., ctir-ollama-mcp).
 */

export interface MCPHealth {
  readonly name: string;
  readonly version: string;
  readonly ok: boolean;
  readonly latencyMs: number;
}

export interface MCPCallOptions {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryBackoffMs?: number;
}

export interface MCPAdapter {
  health(): Promise<MCPHealth>;
  callTool<TPayload extends Record<string, unknown>, TResult = unknown>(
    toolName: 'analyze_error' | 'generate_unit_tests' | 'format_code',
    payload: TPayload,
    options?: MCPCallOptions,
  ): Promise<TResult>;
}


