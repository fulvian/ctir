import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const serverPath = path.join(__dirname, "..", "dist", "index.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env },
  });

  const client = new Client({ name: "ctir-e2e-client", version: "0.1.0" });
  await client.connect(transport);

  const code = `function add(a, b){ return a + b }\nconsole.log(add(2))`;
  const error = `TypeError: Cannot read properties of undefined (reading 'b')`;

  const result = await client.callTool({
    name: "analyze_error",
    arguments: {
      code,
      error,
      model: process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b",
    },
  } as any);

  const text = (result as any)?.content?.[0]?.text || JSON.stringify(result);
  // eslint-disable-next-line no-console
  console.log("E2E analyze_error output:\n", text.slice(0, 1000));

  await client.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("E2E test failed:", err);
  process.exit(2);
});

