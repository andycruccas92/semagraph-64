#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dispatchSemagraphTool } from "./index.js";

const [toolName, filePath] = process.argv.slice(2);
if (!toolName || !filePath) {
  console.error("Usage: semagraph-tool <tool-name> <args.json>");
  process.exit(2);
}

const args = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
const result = dispatchSemagraphTool(toolName, args);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(result.status === "ok" ? 0 : 1);
