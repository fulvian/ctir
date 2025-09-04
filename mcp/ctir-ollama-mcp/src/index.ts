#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import ollama from "ollama";

const mcp = new McpServer({ name: "ctir-ollama-mcp", version: "0.1.0" });

async function askOllama(model: string, prompt: string): Promise<string> {
  const res = await ollama.chat({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a precise coding assistant. Return concise, actionable results.",
      },
      { role: "user", content: prompt },
    ],
    stream: false,
  } as any);
  const content = (res as any)?.message?.content ?? "";
  return String(content);
}

async function runHealthCheck(): Promise<number> {
  try {
    // Quick connectivity check to Ollama
    // Any call is fine; list models is light-weight
    await Promise.race([
      (async () => {
        await ollama.list();
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
    ]);
    // If reached here, Ollama reachable
    return 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("ctir-ollama-mcp health-check failed:", err);
    return 2;
  }
}

const AnalyzeErrorShape = {
  code: z.string(),
  error: z.string(),
  model: z.string().optional(),
};

mcp.tool(
  "analyze_error",
  "Analizza un errore e suggerisce una fix minimal con passi chiari",
  AnalyzeErrorShape,
  async ({ code, error, model }) => {
    const chosen = model || process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b";
    const prompt = `Analizza il seguente errore e fornisci:
1) Causa probabile
2) Fix minima proposta (codice diff o snippet)
3) Test rapido per validare

Codice:
${code}

Errore:
${error}`;
    const output = await askOllama(chosen, prompt);
    return { content: [{ type: "text", text: output }] } as any;
  }
);

const GenerateTestsShape = {
  language: z.string(),
  code: z.string(),
  framework: z.string().optional(),
  requirements: z.string().optional(),
  model: z.string().optional(),
};

mcp.tool(
  "generate_unit_tests",
  "Genera test unitari per il codice fornito con framework indicato",
  GenerateTestsShape,
  async ({ language, code, framework, requirements, model }) => {
    const chosen = model || process.env.DEFAULT_GENERATION_MODEL || "qwen2.5-coder:7b";
    const fw = framework || "jest";
    const prompt = `Scrivi test unitari in ${fw} per il seguente codice ${language}. Mantieni i test minimi ma utili, includi casi edge. Restituisci solo il codice dei test.

Codice sotto test:
${code}

Requisiti aggiuntivi (se presenti): ${requirements || "nessuno"}`;
    const output = await askOllama(chosen, prompt);
    return { content: [{ type: "text", text: output }] } as any;
  }
);

const FormatCodeShape = {
  language: z.string(),
  code: z.string(),
  style: z.string().optional(),
  model: z.string().optional(),
};

mcp.tool(
  "format_code",
  "Formatta il codice secondo lo stile indicato (o default del linguaggio)",
  FormatCodeShape,
  async ({ language, code, style, model }) => {
    const chosen = model || process.env.DEFAULT_FORMATTING_MODEL || "qwen2.5-coder:7b";
    const prompt = `Formatta il seguente codice ${language} secondo lo stile ${style || "standard"}. Restituisci solo il codice formattato.

Codice:
${code}`;
    const output = await askOllama(chosen, prompt);
    return { content: [{ type: "text", text: output }] } as any;
  }
);

if (process.argv.includes("--health-check")) {
  const code = await runHealthCheck();
  process.exit(code);
} else {
  await mcp.connect(new StdioServerTransport());
}
