#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const roundRoot = resolve(here, "..");
const repoRoot = resolve(roundRoot, "../../..");
const fixturePath = resolve(roundRoot, "fixtures/work-items.json");
const reportsDir = resolve(roundRoot, "reports");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const repeats = positiveInt(process.env.ROUND4_REPEATS, 25);
const warmups = positiveInt(process.env.ROUND4_WARMUPS, 5);

function positiveInt(raw, fallback) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertStateId(value) {
  if (!/^S64-[01]{6}$/.test(value)) throw new Error(`Invalid State64 id: ${value}`);
}

function stateNumber(stateId) {
  assertStateId(stateId);
  return Number.parseInt(stateId.slice(4), 2);
}

function popcount6(value) {
  let count = 0;
  let cursor = value & 0b111111;
  while (cursor > 0) {
    count += cursor & 1;
    cursor >>= 1;
  }
  return count;
}

function maskId(value) {
  return `M64-${value.toString(2).padStart(6, "0")}`;
}

function changedPositions(mask) {
  return [...mask.slice(4)].flatMap((bit, index) => (bit === "1" ? [index + 1] : []));
}

function moduleScope(lowerDistance, upperDistance) {
  if (lowerDistance === 0 && upperDistance === 0) return "none";
  if (lowerDistance > 0 && upperDistance === 0) return "lower_only";
  if (lowerDistance === 0 && upperDistance > 0) return "upper_only";
  return "both_modules";
}

function regimeClass(distance, scope) {
  if (distance === 0) return "no_change";
  if (distance === 1) return "bit_adjustment";
  if (distance <= 2 && scope !== "both_modules") return "module_reconfiguration";
  if (distance === 6) return "full_bit_reversal";
  if (distance >= 4) return "near_total_inversion";
  return "cross_module_regime_shift";
}

function directFacts(transition) {
  const source = stateNumber(transition.sourceStateId);
  const target = stateNumber(transition.targetStateId);
  const mutationMaskNumber = source ^ target;
  const mutationMask = maskId(mutationMaskNumber);
  const distance = popcount6(mutationMaskNumber);
  const lowerDistance = popcount6((mutationMaskNumber >> 3) & 0b111);
  const upperDistance = popcount6(mutationMaskNumber & 0b111);
  const scope = moduleScope(lowerDistance, upperDistance);
  return {
    sourceStateId: transition.sourceStateId,
    targetStateId: transition.targetStateId,
    mutationMask,
    changedPositions: changedPositions(mutationMask),
    distance,
    lowerDistance,
    upperDistance,
    moduleScope: scope,
    regimeClass: regimeClass(distance, scope),
    transitionIndex: source * 64 + target,
    inferenceUsed: false
  };
}

function riskBand(distance) {
  if (distance <= 1) return "low";
  if (distance <= 3) return "medium";
  return "high";
}

function recommendedAction(facts) {
  if (facts.distance === 0) return "record_no_change";
  if (facts.distance <= 2) return "monitor_standard_transition";
  if (facts.distance <= 3) return "review_cross_module_context";
  return "escalate_transition_review";
}

function histogram(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function round3(value) {
  return Number(value.toFixed(3));
}

function buildPacket(factsById, mode, timings) {
  const transitions = fixture.transitions.map((transition) => {
    const facts = factsById.get(transition.id);
    return {
      id: transition.id,
      groupId: transition.groupId,
      ...facts,
      riskBand: riskBand(facts.distance),
      recommendedAction: recommendedAction(facts),
      summary: `${transition.id}: ${facts.sourceStateId} to ${facts.targetStateId}; ${facts.regimeClass}; distance ${facts.distance}.`
    };
  });
  const byId = new Map(transitions.map((transition) => [transition.id, transition]));
  const groups = fixture.groups.map((group) => {
    const items = group.transitionIds.map((id) => byId.get(id));
    const distances = items.map((item) => item.distance);
    const maxDistance = Math.max(...distances);
    return {
      id: group.id,
      transitionCount: items.length,
      totalDistance: distances.reduce((sum, value) => sum + value, 0),
      averageDistance: round3(distances.reduce((sum, value) => sum + value, 0) / items.length),
      maxDistance,
      highRiskTransitionIds: items.filter((item) => item.riskBand === "high").map((item) => item.id),
      regimeHistogram: histogram(items.map((item) => item.regimeClass)),
      moduleScopeHistogram: histogram(items.map((item) => item.moduleScope))
    };
  });
  const distances = transitions.map((transition) => transition.distance);
  const maxDistance = Math.max(...distances);
  const comparisons = fixture.comparePairs.map((pair) => {
    const left = byId.get(pair.left);
    const right = byId.get(pair.right);
    const leftPositions = new Set(left.changedPositions);
    let sharedChangedPositionCount = 0;
    for (const position of right.changedPositions) {
      if (leftPositions.has(position)) sharedChangedPositionCount += 1;
    }
    return {
      left: pair.left,
      right: pair.right,
      sameMutationMask: left.mutationMask === right.mutationMask,
      sameRegimeClass: left.regimeClass === right.regimeClass,
      sameModuleScope: left.moduleScope === right.moduleScope,
      distanceDelta: left.distance - right.distance,
      sharedChangedPositionCount
    };
  });
  const actionQueue = transitions
    .filter((transition) => transition.recommendedAction !== "record_no_change")
    .map((transition) => ({
      transitionId: transition.id,
      priority: transition.riskBand === "high" ? "high" : transition.riskBand === "medium" ? "normal" : "low",
      action: transition.recommendedAction,
      triggerSignature: `${transition.mutationMask}|${transition.regimeClass}|d=${transition.distance}`
    }));

  return {
    mode,
    deterministicBoundary: mode === "rust-mcp" ? "semagraph-rs-mcp" : "no-semagraph-mcp",
    transitionCount: transitions.length,
    transitions,
    groups,
    aggregate: {
      transitionCount: transitions.length,
      totalDistance: distances.reduce((sum, value) => sum + value, 0),
      averageDistance: round3(distances.reduce((sum, value) => sum + value, 0) / transitions.length),
      maxDistance,
      maxDistanceTransitionIds: transitions.filter((transition) => transition.distance === maxDistance).map((transition) => transition.id),
      riskHistogram: histogram(transitions.map((transition) => transition.riskBand)),
      regimeHistogram: histogram(transitions.map((transition) => transition.regimeClass)),
      moduleScopeHistogram: histogram(transitions.map((transition) => transition.moduleScope))
    },
    comparisons,
    actionQueue,
    narrative: {
      title: "State64 transition review packet",
      executiveSummary: `${transitions.length} transitions reviewed; ${actionQueue.filter((item) => item.priority === "high").length} high-priority actions.`,
      reviewNotes: [
        "No observations were inferred.",
        "State64 ids and mutation masks remain canonical.",
        mode === "rust-mcp" ? "Deterministic facts were obtained through the Rust MCP server." : "Deterministic facts were computed locally without MCP."
      ]
    },
    timings
  };
}

function expectedComparable(packet) {
  return {
    transitions: packet.transitions.map((transition) => ({
      id: transition.id,
      groupId: transition.groupId,
      sourceStateId: transition.sourceStateId,
      targetStateId: transition.targetStateId,
      mutationMask: transition.mutationMask,
      changedPositions: transition.changedPositions,
      distance: transition.distance,
      lowerDistance: transition.lowerDistance,
      upperDistance: transition.upperDistance,
      moduleScope: transition.moduleScope,
      regimeClass: transition.regimeClass,
      transitionIndex: transition.transitionIndex,
      inferenceUsed: transition.inferenceUsed,
      riskBand: transition.riskBand,
      recommendedAction: transition.recommendedAction
    })),
    groups: packet.groups,
    aggregate: packet.aggregate,
    comparisons: packet.comparisons,
    actionQueue: packet.actionQueue
  };
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!deepEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function validatePacket(packet, expected) {
  const comparable = expectedComparable(packet);
  const checks = [
    { name: "deterministicFields", passed: deepEqual(comparable.transitions, expected.transitions) },
    { name: "groups", passed: deepEqual(comparable.groups, expected.groups) },
    { name: "aggregate", passed: deepEqual(comparable.aggregate, expected.aggregate) },
    { name: "comparisons", passed: deepEqual(comparable.comparisons, expected.comparisons) },
    { name: "actionQueue", passed: deepEqual(comparable.actionQueue, expected.actionQueue) },
    {
      name: "narrative",
      passed:
        typeof packet.narrative?.executiveSummary === "string" &&
        packet.narrative.executiveSummary.length > 0 &&
        Array.isArray(packet.narrative.reviewNotes)
    }
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    passed,
    total: checks.length,
    score: Number((passed / checks.length).toFixed(3)),
    checks
  };
}

function noMcpPacket() {
  const factsStarted = performance.now();
  const factsById = new Map(fixture.transitions.map((transition) => [transition.id, directFacts(transition)]));
  const factsMs = performance.now() - factsStarted;
  const assembleStarted = performance.now();
  const packet = buildPacket(factsById, "no-mcp", { deterministicFactsMs: round(factsMs) });
  packet.timings.assemblyMs = round(performance.now() - assembleStarted);
  return packet;
}

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function findMcpBinary() {
  const explicit = process.env.SEMAGRAPH_MCP_BIN;
  if (explicit && existsSync(explicit) && statSync(explicit).isFile()) return explicit;
  const exe = process.platform === "win32" ? "semagraph-mcp.exe" : "semagraph-mcp";
  const release = resolve(repoRoot, "packages/target/release", exe);
  if (existsSync(release) && statSync(release).isFile()) return release;
  execFileSync("cargo", ["build", "--release", "--manifest-path", "packages/Cargo.toml", "--bin", "semagraph-mcp"], {
    cwd: repoRoot,
    stdio: "pipe"
  });
  return release;
}

class McpClient {
  constructor(binary) {
    this.binary = binary;
    this.nextId = 1;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.stderr = "";
    this.child = spawn(binary, [], { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.on("data", (chunk) => this.onData(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString("utf8");
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString("utf8");
      const match = /^Content-Length:\s*(\d+)/im.exec(header);
      if (!match) throw new Error(`Invalid MCP frame header: ${header}`);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (this.buffer.length < bodyEnd) return;
      const body = this.buffer.slice(bodyStart, bodyEnd).toString("utf8");
      this.buffer = this.buffer.slice(bodyEnd);
      const message = JSON.parse(body);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        pending.resolve(message);
      }
    }
  }

  request(method, params) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = { jsonrpc: "2.0", id, method };
    if (params !== undefined) payload.params = params;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(frame(payload), (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async close() {
    this.child.stdin.end();
    await new Promise((resolve) => {
      this.child.once("exit", resolve);
      setTimeout(() => {
        if (!this.child.killed) this.child.kill();
        resolve();
      }, 1000);
    });
  }
}

async function rustMcpPacket(client) {
  const factsStarted = performance.now();
  const factsById = new Map();
  for (const transition of fixture.transitions) {
    const response = await client.request("tools/call", {
      name: "semagraph_lookup_transition64",
      arguments: {
        sourceStateId: transition.sourceStateId,
        targetStateId: transition.targetStateId
      }
    });
    const payload = response?.result?.structuredContent?.result;
    factsById.set(transition.id, {
      sourceStateId: payload.sourceStateId,
      targetStateId: payload.targetStateId,
      mutationMask: payload.mutationMask,
      changedPositions: payload.changedPositions,
      distance: payload.distance,
      lowerDistance: payload.lowerDistance,
      upperDistance: payload.upperDistance,
      moduleScope: payload.moduleScope,
      regimeClass: payload.regimeClass,
      transitionIndex: payload.transitionIndex,
      inferenceUsed: payload.inferenceUsed
    });
  }
  const factsMs = performance.now() - factsStarted;
  const assembleStarted = performance.now();
  const packet = buildPacket(factsById, "rust-mcp", {
    deterministicFactsMs: round(factsMs),
    semagraphCallCount: fixture.transitions.length
  });
  packet.timings.assemblyMs = round(performance.now() - assembleStarted);
  return packet;
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    min: round(sorted[0]),
    median: round(median),
    mean: round(mean),
    p95: round(p95),
    max: round(sorted[sorted.length - 1]),
    stdev: round(Math.sqrt(variance))
  };
}

function round(value) {
  return Number(value.toFixed(6));
}

async function measureVariant(name, runner, expected, options = {}) {
  const samples = [];
  const qualityFailures = [];
  let lastPacket;
  for (let repeat = 0; repeat < repeats + warmups; repeat += 1) {
    const started = performance.now();
    const packet = await runner();
    const durationMs = performance.now() - started;
    const quality = validatePacket(packet, expected);
    if (quality.score !== 1) qualityFailures.push({ repeat, quality });
    if (repeat >= warmups) {
      samples.push({
        sample: repeat - warmups,
        durationMs: round(durationMs),
        deterministicFactsMs: packet.timings.deterministicFactsMs,
        assemblyMs: packet.timings.assemblyMs,
        semagraphCallCount: packet.timings.semagraphCallCount ?? 0
      });
      lastPacket = packet;
    }
  }
  return {
    name,
    boundary: options.boundary,
    deterministicAuthority: options.deterministicAuthority,
    valid: qualityFailures.length === 0,
    qualityFailures,
    repeats,
    warmups,
    samples,
    durationMs: summarize(samples.map((sample) => sample.durationMs)),
    deterministicFactsMs: summarize(samples.map((sample) => sample.deterministicFactsMs)),
    assemblyMs: summarize(samples.map((sample) => sample.assemblyMs)),
    semagraphCallCount: samples.reduce((sum, sample) => sum + sample.semagraphCallCount, 0),
    output: lastPacket
  };
}

function markdown(report) {
  const noMcp = report.results.find((result) => result.name === "no-mcp");
  const rustMcp = report.results.find((result) => result.name === "rust-mcp");
  const overhead = rustMcp.durationMs.median - noMcp.durationMs.median;
  const ratio = rustMcp.durationMs.median / noMcp.durationMs.median;
  return `# Round 4 Standard Agentic Work Comparison

Generated from:

\`\`\`bash
node experiments/agentic-loop-benchmark/round-4-standard-agentic-mcp/scripts/evaluate.mjs
\`\`\`

## Task

Build a transition review packet from the same State64 work items: deterministic
facts, group aggregates, pairwise comparisons, action queue, and narrative notes.

## Results

| Variant | Boundary | Authority | Median full task | Median fact phase | Valid |
| --- | --- | --- | ---: | ---: | --- |
${report.results
  .map(
    (result) =>
      `| ${result.name} | ${result.boundary} | ${result.deterministicAuthority} | ${result.durationMs.median} ms | ${result.deterministicFactsMs.median} ms | ${result.valid ? "yes" : "no"} |`
  )
  .join("\n")}

## KPI

| KPI | Value |
| --- | ---: |
| Rust MCP startup to initialize response | ${report.mcpStartupMs} ms |
| Rust MCP tool calls per task | ${fixture.transitions.length} |
| Median overhead vs no-MCP scripted worker | ${round(overhead)} ms |
| Median full-task latency ratio | ${round(ratio)}x |

## Interpretation

The no-MCP worker is faster because it computes the known math in-process. That
is expected and is not an agent-realistic authority boundary. The Rust MCP worker
adds a small absolute overhead while externalizing deterministic facts through a
replayable MCP tool surface that an LLM agent can use without modifying states,
observations, masks, or signatures.

This benchmark does not infer token usage or live LLM reasoning quality.
`;
}

mkdirSync(reportsDir, { recursive: true });
const expectedFacts = new Map(fixture.transitions.map((transition) => [transition.id, directFacts(transition)]));
const expected = expectedComparable(buildPacket(expectedFacts, "expected", {}));

const mcpBinary = findMcpBinary();
const client = new McpClient(mcpBinary);
const initStarted = performance.now();
const init = await client.request("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "round-4-standard-agentic", version: "0.1.0" }
});
const mcpStartupMs = round(performance.now() - initStarted);
if (init?.result?.serverInfo?.name !== "semagraph-rs-mcp") {
  throw new Error(`Unexpected MCP initialize response: ${JSON.stringify(init)}`);
}

const results = [
  await measureVariant("no-mcp", noMcpPacket, expected, {
    boundary: "scripted-worker-no-mcp",
    deterministicAuthority: "local-js-rules"
  }),
  await measureVariant("rust-mcp", () => rustMcpPacket(client), expected, {
    boundary: "persistent-mcp-tools-call",
    deterministicAuthority: "semagraph-rs-mcp"
  })
];
await client.close();

const report = {
  benchmark: "round-4-standard-agentic-mcp",
  generatedAt: new Date().toISOString(),
  fixture: "fixtures/work-items.json",
  config: { repeats, warmups },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    mcpBinary
  },
  mcpStartupMs,
  results
};

writeFileSync(resolve(reportsDir, "latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(reportsDir, "standard-agentic-comparison.md"), markdown(report));
writeFileSync(resolve(roundRoot, "runs-no-mcp-output.json"), `${JSON.stringify(results[0].output, null, 2)}\n`);
writeFileSync(resolve(roundRoot, "runs-rust-mcp-output.json"), `${JSON.stringify(results[1].output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
