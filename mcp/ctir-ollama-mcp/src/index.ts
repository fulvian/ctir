#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONSchema7 } from "json-schema";
import ollama from "ollama";

const server = new Server(
  { name: "ctir-ollama-mcp", version: "0.1.0" },
  new StdioServerTransport()
);

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

const AnalyzeErrorSchema: JSONSchema7 = {
  type: "object",
  properties: {
    code: { type: "string" },
    error: { type: "string" },
    model: { type: "string" },
  },
  required: ["code", "error"],
};

server.tool(
  "analyze_error",
  "Analizza un errore e suggerisce una fix minimal con passi chiari",
  { inputSchema: AnalyzeErrorSchema },
  async (args: any) => {
    const model = args.model || process.env.DEFAULT_DEBUG_MODEL || "codellama:7b-instruct";
    const prompt = `Analizza il seguente errore e fornisci:
1) Causa probabile
2) Fix minima proposta (codice diff o snippet)
3) Test rapido per validare

Codice:
${args.code}

Errore:
${args.error}`;
    const output = await askOllama(model, prompt);
    return { content: [{ type: "text", text: output }] } as any;
  }
);

const GenerateTestsSchema: JSONSchema7 = {
  type: "object",
  properties: {
    language: { type: "string" },
    code: { type: "string" },
    framework: { type: "string" },
    requirements: { type: "string" },
    model: { type: "string" },
  },
  required: ["language", "code"],
};

server.tool(
  "generate_unit_tests",
  "Genera test unitari per il codice fornito con framework indicato",
  { inputSchema: GenerateTestsSchema },
  async (args: any) => {
    const model = args.model || process.env.DEFAULT_GENERATION_MODEL || "mistral:7b-instruct-v0.2";
    const fw = args.framework || "jest";
    const prompt = `Scrivi test unitari in ${fw} per il seguente codice ${args.language}. Mantieni i test minimi ma utili, includi casi edge. Restituisci solo il codice dei test.

Codice sotto test:
${args.code}

Requisiti aggiuntivi (se presenti): ${args.requirements || "nessuno"}`;
    const output = await askOllama(model, prompt);
    return { content: [{ type: "text", text: output }] } as any;
  }
);

const FormatCodeSchema: JSONSchema7 = {
  type: "object",
  properties: {
    language: { type: "string" },
    code: { type: "string" },
    style: { type: "string" },
    model: { type: "string" },
  },
  required: ["language", "code"],
};

server.tool(
  "format_code",
  "Formatta il codice secondo lo stile indicato (o default del linguaggio)",
  { inputSchema: FormatCodeSchema },
  async (args: any) => {
    const model = args.model || process.env.DEFAULT_FORMATTING_MODEL || "starcoder:7b";
    const prompt = `Formatta il seguente codice ${args.language} secondo lo stile ${args.style || "standard"}. Restituisci solo il codice formattato.

Codice:
${args.code}`;
    const output = await askOllama(model, prompt);
    return { content: [{ type: "text", text: output }] } as any;
  }
);

server.start();

