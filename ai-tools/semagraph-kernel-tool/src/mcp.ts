#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import { dispatchSemagraphTool } from "./index.js";

type OpenAiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Tool["inputSchema"];
  };
};

const here = dirname(fileURLToPath(import.meta.url));
const toolsPath = resolve(here, "../openai-tools.json");
const openAiTools = JSON.parse(readFileSync(toolsPath, "utf8")) as OpenAiToolDefinition[];

const tools: Tool[] = openAiTools.map((tool) => ({
  name: tool.function.name,
  description: tool.function.description,
  inputSchema: tool.function.parameters
}));

function jsonContent(value: unknown): CallToolResult["content"] {
  return [
    {
      type: "text",
      text: JSON.stringify(value, null, 2)
    }
  ];
}

const server = new Server(
  {
    name: "semagraph-mcp",
    version: "0.7.0"
  },
  {
    capabilities: {
      tools: {}
    },
    instructions:
      "SemaGraph MCP exposes deterministic State64/Q6 anchoring and transition-chain compression. Do not infer observations or modify State64 ids, mutation masks, or deterministic signatures."
  }
);

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, (request): CallToolResult => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  const result = dispatchSemagraphTool(request.params.name, args);

  if (result.status === "rejected") {
    return {
      isError: true,
      content: jsonContent(result),
      structuredContent: result as unknown as Record<string, unknown>
    };
  }

  return {
    content: jsonContent(result),
    structuredContent: result as unknown as Record<string, unknown>
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
