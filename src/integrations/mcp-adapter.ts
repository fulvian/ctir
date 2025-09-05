import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { performance } from "perf_hooks";
import type { MCPAdapter, MCPCallOptions, MCPHealth } from "@/integrations/contracts/mcp";

const DEFAULT_NODE = process.execPath || "node";
const MCP_ENTRY = path.resolve(process.cwd(), "mcp", "ctir-ollama-mcp", "dist", "index.js");

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

export class StdioMCPAdapter implements MCPAdapter {
  async health(): Promise<MCPHealth> {
    const start = performance.now();
    const code = await this.runOnce(["--health-check"], { timeoutMs: 5000 });
    const latencyMs = performance.now() - start;
    return { name: "ctir-ollama-mcp", version: "0.1.0", ok: code === 0, latencyMs: Math.round(latencyMs) };
  }

  async callTool<TPayload extends Record<string, unknown>, TResult = unknown>(
    toolName: "analyze_error" | "generate_unit_tests" | "format_code",
    payload: TPayload,
    options?: MCPCallOptions,
  ): Promise<TResult> {
    const timeoutMs = options?.timeoutMs ?? 20000;
    const maxRetries = options?.maxRetries ?? 2;
    const backoffMs = options?.retryBackoffMs ?? 800;

    // write payload to temp file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctir-mcp-"));
    const tempFile = path.join(tempDir, "tool.json");
    fs.writeFileSync(tempFile, JSON.stringify({ tool: toolName, args: payload }, null, 2), "utf-8");

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const exitCode = await this.runOnce(["--tool-call", tempFile], { timeoutMs });
        const raw = fs.readFileSync(path.join(process.cwd(), "ctir.out.log"), "utf-8");
        // Prefer stdout capture; if server writes to stdout, we should capture from process; here, the server prints JSON to stdout.
        // To avoid interleaving with overall logs, we re-run process capture; see runOnce implementation below.
        const output = this.lastStdout ?? "";
        if (!output) throw new Error("Empty MCP response");
        const parsed = JSON.parse(output) as TResult;
        return parsed;
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        await delay(backoffMs * Math.pow(2, attempt));
        attempt += 1;
      }
    }
  }

  private lastStdout: string | null = null;

  private runOnce(args: string[], opts: { timeoutMs: number }): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = spawn(DEFAULT_NODE, [MCP_ENTRY, ...args], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`MCP call timed out after ${opts.timeoutMs}ms`));
      }, opts.timeoutMs);

      proc.stdout.on("data", (d) => { stdout += String(d); });
      proc.stderr.on("data", (d) => { stderr += String(d); });
      proc.on("close", (code) => {
        clearTimeout(timer);
        this.lastStdout = stdout.trim();
        if (code === 0) return resolve(0);
        const msg = stderr || stdout || `MCP exited with code ${code}`;
        reject(new Error(msg));
      });
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }
}


