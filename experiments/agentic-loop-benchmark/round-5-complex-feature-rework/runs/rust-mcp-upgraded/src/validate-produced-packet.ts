#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { buildWorkbenchArgs, loadWorkbenchInput, WorkbenchError } from "./input.js";
import { callSemagraphTool } from "./mcp-client.js";

type ValidationResult = {
  valid?: boolean;
  errors?: unknown[];
  expected?: unknown;
  inferenceUsed?: boolean;
};

function main(): void {
  try {
    const inputPath = process.argv[2];
    const packetPath = process.argv[3];
    if (!inputPath || !packetPath) {
      throw new WorkbenchError("usage: node dist/validate-produced-packet.js <input.json> <packet.json>", 2);
    }

    const input = loadWorkbenchInput(inputPath);
    const packet = JSON.parse(readFileSync(packetPath, "utf8")) as Record<string, unknown>;
    const validation = callSemagraphTool<ValidationResult>(
      "semagraph_validate_policy_packet64",
      {
        ...buildWorkbenchArgs(input),
        packet
      }
    );

    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
    if (validation.valid !== true || validation.inferenceUsed !== false) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
    process.exitCode = error instanceof WorkbenchError ? error.exitCode : 1;
  }
}

main();
