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

const request = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "semagraph_lookup_transition64",
    arguments: {
      sourceStateId: "S64-000000",
      targetStateId: "S64-111111"
    }
  }
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

const payload = structured.result;
if (
  payload.sourceStateId !== "S64-000000" ||
  payload.targetStateId !== "S64-111111" ||
  payload.mutationMask !== "M64-111111" ||
  payload.transitionIndex !== 63
) {
  throw new Error(`Unexpected lookup payload: ${JSON.stringify(payload)}`);
}

console.log("semagraph-mcp smoke ok");
