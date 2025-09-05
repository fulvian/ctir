import { spawn } from "child_process";
import path from "path";

export class MCPIntegration {
  async healthCheckCtirOllama(timeoutMs = 6000): Promise<boolean> {
    const script = path.join(
      process.cwd(),
      "mcp",
      "ctir-ollama-mcp",
      "dist",
      "index.js"
    );
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [script, "--health-check"], {
        env: { ...process.env },
        stdio: "ignore",
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(false);
      }, timeoutMs);

      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  async callTool(server: string, tool: string, args: unknown): Promise<unknown> {
    try {
      // For now, we only support the internal ctir-ollama-mcp server
      if (server !== 'ctir-ollama-mcp') {
        throw new Error(`Unsupported MCP server: ${server}`);
      }

      const script = path.join(
        process.cwd(),
        "mcp",
        "ctir-ollama-mcp",
        "dist",
        "index.js"
      );

      // Create a temporary file with the tool call request
      const tempFile = path.join(process.cwd(), "temp-mcp-call.json");
      const requestData = {
        tool,
        args,
        timestamp: new Date().toISOString()
      };

      await import("fs/promises").then(fs => fs.writeFile(tempFile, JSON.stringify(requestData)));

      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, "--tool-call", tempFile], {
          env: { ...process.env },
          stdio: "pipe",
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("exit", async (code) => {
          // Cleanup temp file
          try {
            await import("fs/promises").then(fs => fs.unlink(tempFile));
          } catch {}

          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              resolve({ output: stdout });
            }
          } else {
            reject(new Error(`MCP tool call failed: ${stderr || stdout}`));
          }
        });

        child.on("error", (error) => {
          reject(error);
        });
      });

    } catch (error) {
      console.error("MCP callTool error:", error);
      throw error;
    }
  }
}
