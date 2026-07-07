import { spawnSync } from "node:child_process";

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function readFrames(output) {
  const frames = [];
  let cursor = 0;
  while (cursor < output.length) {
    const headerEnd = output.indexOf("\r\n\r\n", cursor);
    if (headerEnd === -1) break;
    const header = output.slice(cursor, headerEnd);
    const match = /^Content-Length:\s*(\d+)/im.exec(header);
    if (!match) throw new Error(`Missing Content-Length in header: ${header}`);
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const body = output.slice(bodyStart, bodyStart + length);
    frames.push(JSON.parse(body));
    cursor = bodyStart + length;
  }
  return frames;
}

function callTool(id, name, args) {
  const request = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args }
  };

  const result = spawnSync(
    "cargo",
    ["run", "--quiet", "--manifest-path", "packages/Cargo.toml", "--bin", "semagraph-mcp"],
    {
      cwd: new URL("../../..", import.meta.url),
      input: frame(request),
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const [response] = readFrames(result.stdout);
  const structured = response?.result?.structuredContent;
  if (structured?.status !== "ok") {
    throw new Error(`Expected ok structuredContent, got ${JSON.stringify(structured)}`);
  }

  return structured.result;
}

const lookup = callTool(1, "semagraph_lookup_transition64", {
  sourceStateId: "S64-000000",
  targetStateId: "S64-111111"
});

if (
  lookup.sourceStateId !== "S64-000000" ||
  lookup.targetStateId !== "S64-111111" ||
  lookup.mutationMask !== "M64-111111" ||
  lookup.transitionIndex !== 63
) {
  throw new Error(`Unexpected lookup payload: ${JSON.stringify(lookup)}`);
}

const workbenchArgs = {
  scenarios: [
    {
      id: "alpha",
      states: ["S64-000000", "S64-000111", "S64-111111"],
      objective: "smoke"
    },
    {
      id: "calm-zero",
      states: ["S64-101010", "S64-101010"],
      objective: "smoke hold"
    }
  ],
  comparePairs: [{ left: "alpha", right: "calm-zero" }],
  excludePolicyScenarioIds: ["calm-zero"]
};

const packet = callTool(2, "semagraph_analyze_scenarios64", workbenchArgs);
if (
  packet.scenarios?.length !== 2 ||
  packet.policyQueue?.length !== 1 ||
  packet.scenarios[0].signature !== "C64:S64-000000>S64-111111|M:M64-000111.M64-111000|N:M64-111111"
) {
  throw new Error(`Unexpected workbench payload: ${JSON.stringify(packet)}`);
}

const validation = callTool(3, "semagraph_validate_policy_packet64", {
  ...workbenchArgs,
  packet
});

if (validation.valid !== true || validation.errors?.length !== 0) {
  throw new Error(`Unexpected validation payload: ${JSON.stringify(validation)}`);
}

console.log("semagraph-mcp smoke ok");
