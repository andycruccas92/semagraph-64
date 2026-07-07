import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkbenchError } from "./input.js";

type JsonRpcId = number;

type McpConfig = {
  mcpServers?: {
    semagraph?: {
      command?: string;
      args?: string[];
    };
  };
};

type McpStructuredContent<T> = {
  tool: string;
  status: "ok" | "rejected";
  result?: T;
  error?: string;
};

type McpResponse<T> = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: {
    structuredContent?: McpStructuredContent<T>;
  };
  error?: {
    code: number;
    message: string;
  };
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
const runRoot = resolve(moduleDir, "..");
const workspaceRoot = findWorkspaceRoot(resolve(runRoot, ".."));

export function callSemagraphTool<T>(name: string, args: Record<string, unknown>, requestId = 1): T {
  const semagraphServer = readSemagraphServerConfig();
  const request = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: {
      name,
      arguments: args
    }
  };

  const targetDir = resolve(runRoot, ".cargo-target");
  mkdirSync(targetDir, { recursive: true });
  const result = spawnSync(semagraphServer.command, semagraphServer.args, {
    cwd: workspaceRoot,
    input: frameJson(request),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: targetDir
    }
  });

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    throw new WorkbenchError(`Rust MCP server failed${stderr ? `: ${stderr}` : "."}`);
  }

  const [response] = readFrames<T>(result.stdout);
  if (!response) {
    throw new WorkbenchError(`Rust MCP server returned no response for ${name}.`);
  }
  if (response.error) {
    throw new WorkbenchError(`Rust MCP JSON-RPC error for ${name}: ${response.error.message}`);
  }

  const structured = response.result?.structuredContent;
  if (!structured) {
    throw new WorkbenchError(`Rust MCP response for ${name} lacked structuredContent.`);
  }
  if (structured.tool !== name) {
    throw new WorkbenchError(`Rust MCP returned '${structured.tool}', expected '${name}'.`);
  }
  if (structured.status !== "ok" || structured.result === undefined) {
    throw new WorkbenchError(`Rust MCP tool ${name} rejected request: ${structured.error ?? "unknown error"}`);
  }
  return structured.result;
}

function readSemagraphServerConfig(): { command: string; args: string[] } {
  const configPath = resolve(workspaceRoot, ".mcp.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as McpConfig;
  const semagraph = config.mcpServers?.semagraph;
  if (!semagraph?.command || !Array.isArray(semagraph.args)) {
    throw new WorkbenchError(".mcp.json does not define the semagraph MCP server command.");
  }
  return {
    command: semagraph.command,
    args: semagraph.args
  };
}

function findWorkspaceRoot(start: string): string {
  let current = start;
  while (true) {
    if (existsSync(resolve(current, ".mcp.json")) && existsSync(resolve(current, "packages", "Cargo.toml"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new WorkbenchError("Could not locate workspace root containing .mcp.json and packages/Cargo.toml.");
    }
    current = parent;
  }
}

function frameJson(value: unknown): string {
  const body = JSON.stringify(value);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function readFrames<T>(output: string): McpResponse<T>[] {
  const frames: McpResponse<T>[] = [];
  let cursor = 0;
  while (cursor < output.length) {
    const headerEnd = output.indexOf("\r\n\r\n", cursor);
    if (headerEnd === -1) {
      break;
    }
    const header = output.slice(cursor, headerEnd);
    const lengthMatch = /^Content-Length:\s*(\d+)/im.exec(header);
    if (!lengthMatch) {
      throw new WorkbenchError(`Missing Content-Length in Rust MCP response header '${header}'.`);
    }
    const length = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const body = output.slice(bodyStart, bodyStart + length);
    frames.push(JSON.parse(body) as McpResponse<T>);
    cursor = bodyStart + length;
  }
  return frames;
}
