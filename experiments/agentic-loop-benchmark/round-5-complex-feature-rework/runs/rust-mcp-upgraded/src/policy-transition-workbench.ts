#!/usr/bin/env node

import { buildWorkbenchArgs, loadWorkbenchInput, WorkbenchError } from "./input.js";
import { callSemagraphTool } from "./mcp-client.js";

type PolicyPacket = {
  scenarios?: unknown[];
  aggregate?: unknown;
  comparisons?: unknown[];
  policyQueue?: unknown[];
  inferenceUsed?: boolean;
};

function main(): void {
  try {
    const inputPath = process.argv[2];
    if (!inputPath) {
      throw new WorkbenchError("usage: node dist/policy-transition-workbench.js <input.json>", 2);
    }

    const input = loadWorkbenchInput(inputPath);
    const packet = callSemagraphTool<PolicyPacket>(
      "semagraph_analyze_scenarios64",
      buildWorkbenchArgs(input)
    );
    assertPacketShape(packet);
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
    process.exitCode = error instanceof WorkbenchError ? error.exitCode : 1;
  }
}

function assertPacketShape(packet: PolicyPacket): void {
  if (!Array.isArray(packet.scenarios)) {
    throw new WorkbenchError("Rust MCP packet is missing scenarios.");
  }
  if (typeof packet.aggregate !== "object" || packet.aggregate === null || Array.isArray(packet.aggregate)) {
    throw new WorkbenchError("Rust MCP packet is missing aggregate.");
  }
  if (!Array.isArray(packet.comparisons)) {
    throw new WorkbenchError("Rust MCP packet is missing comparisons.");
  }
  if (!Array.isArray(packet.policyQueue)) {
    throw new WorkbenchError("Rust MCP packet is missing policyQueue.");
  }
  if (packet.inferenceUsed !== false) {
    throw new WorkbenchError("Rust MCP packet must report inferenceUsed=false.");
  }
}

main();
