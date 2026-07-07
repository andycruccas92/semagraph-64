#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const roundRoot = resolve(here, "..");
const repoRoot = resolve(roundRoot, "../../..");
const reportsDir = resolve(roundRoot, "reports");
const outputsDir = resolve(roundRoot, "outputs");
const fixturePath = resolve(roundRoot, "fixtures/anchor-timeline.json");
const invalidFixturePath = resolve(roundRoot, "fixtures/invalid-anchor-timeline.json");

const fixture = readJson(fixturePath);
const invalidFixture = readJson(invalidFixturePath);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compareValues(left, operator, right) {
  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

function assertSnapshot(snapshot) {
  if (!snapshot?.id) throw new Error("snapshot id is required");
  if (!Array.isArray(snapshot.observations) || snapshot.observations.length !== 6) {
    throw new Error(`snapshot ${snapshot.id} requires exactly six observations`);
  }
}

function anchorSnapshot(snapshot) {
  assertSnapshot(snapshot);
  const decisions = snapshot.observations.map((observation, index) => {
    if (!observation.key) throw new Error(`snapshot ${snapshot.id} observation ${index + 1} requires key`);
    const result = compareValues(observation.value, observation.operator, observation.threshold);
    const trueBit = observation.trueBit ?? 1;
    const falseBit = observation.falseBit ?? 0;
    const bit = result ? trueBit : falseBit;
    return compact({
      position: index + 1,
      key: observation.key,
      operator: observation.operator,
      value: observation.value,
      threshold: observation.threshold,
      result,
      trueBit,
      falseBit,
      selectedBit: bit,
      unit: observation.unit,
      source: observation.source
    });
  });
  const binary = decisions.map((decision) => String(decision.selectedBit)).join("");
  const stateId = `S64-${binary}`;
  return {
    snapshotId: snapshot.id,
    stateId,
    stateNumber: Number.parseInt(binary, 2),
    binary,
    decisions,
    anchorMode: "deterministic_observed_parameters",
    inferenceUsed: false
  };
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function bits(state) {
  if (!/^S64-[01]{6}$/.test(state)) throw new Error(`Invalid State64 id: ${state}`);
  return state.slice(4);
}

function maskBetween(source, target) {
  const left = bits(source);
  const right = bits(target);
  let mask = "";
  for (let index = 0; index < 6; index += 1) {
    mask += left[index] === right[index] ? "0" : "1";
  }
  return `M64-${mask}`;
}

function xorMasks(left, right) {
  const a = left.slice(4);
  const b = right.slice(4);
  let out = "";
  for (let index = 0; index < 6; index += 1) {
    out += a[index] === b[index] ? "0" : "1";
  }
  return `M64-${out}`;
}

function distance(mask) {
  return [...mask.slice(4)].filter((bit) => bit === "1").length;
}

function transitionRegime(source, target) {
  const mask = maskBetween(source, target);
  const total = distance(mask);
  const lowerDistance = distance(`M64-${mask.slice(4, 7)}000`);
  const upperDistance = distance(`M64-000${mask.slice(7, 10)}`);
  const moduleScope =
    lowerDistance === 0 && upperDistance === 0
      ? "none"
      : lowerDistance > 0 && upperDistance === 0
        ? "lower_only"
        : lowerDistance === 0 && upperDistance > 0
          ? "upper_only"
          : "both_modules";
  const regimeClass =
    total === 0
      ? "no_change"
      : total === 1
        ? "bit_adjustment"
        : total <= 2 && moduleScope !== "both_modules"
          ? "module_reconfiguration"
          : total === 6
            ? "full_bit_reversal"
            : total >= 4
              ? "near_total_inversion"
              : "cross_module_regime_shift";
  return { mutationMask: mask, distance: total, lowerDistance, upperDistance, moduleScope, regimeClass };
}

function volatilityClass(cumulativeDistance) {
  if (cumulativeDistance <= 3) return "calm";
  if (cumulativeDistance <= 7) return "active";
  return "volatile";
}

function policyReadiness(volatility) {
  return volatility === "calm" ? "hold" : volatility === "active" ? "review" : "escalate";
}

function dominantRegime(transitions) {
  const counts = new Map();
  const distances = new Map();
  for (const transition of transitions) {
    counts.set(transition.regimeClass, (counts.get(transition.regimeClass) ?? 0) + 1);
    distances.set(transition.regimeClass, (distances.get(transition.regimeClass) ?? 0) + transition.distance);
  }
  return [...counts.keys()].sort((left, right) => {
    const countDelta = counts.get(right) - counts.get(left);
    if (countDelta !== 0) return countDelta;
    const distanceDelta = distances.get(right) - distances.get(left);
    if (distanceDelta !== 0) return distanceDelta;
    return left.localeCompare(right);
  })[0];
}

function analyzeTimelineScenario(id, states, objective) {
  const transitions = [];
  const orderedMutationMasks = [];
  let netMutationMask = "M64-000000";
  let cumulativeDistance = 0;
  for (let index = 0; index < states.length - 1; index += 1) {
    const transition = transitionRegime(states[index], states[index + 1]);
    transitions.push(transition);
    orderedMutationMasks.push(transition.mutationMask);
    netMutationMask = xorMasks(netMutationMask, transition.mutationMask);
    cumulativeDistance += transition.distance;
  }
  const sourceStateId = states[0];
  const targetStateId = states[states.length - 1];
  const volatility = volatilityClass(cumulativeDistance);
  const signature = `C64:${sourceStateId}>${targetStateId}|M:${orderedMutationMasks.join(".")}|N:${netMutationMask}`;
  const scenario = {
    id,
    sourceStateId,
    targetStateId,
    states,
    transitionCount: orderedMutationMasks.length,
    orderedMutationMasks,
    netMutationMask,
    cumulativeDistance,
    netDistance: distance(netMutationMask),
    dominantRegimeClass: dominantRegime(transitions),
    volatilityClass: volatility,
    policyReadiness: policyReadiness(volatility),
    signature,
    summary: `${id}: ${sourceStateId} to ${targetStateId}; ${volatility}; cumulative distance ${cumulativeDistance}.`
  };
  return {
    scenarios: [scenario],
    aggregate: {
      scenarioCount: 1,
      totalTransitions: scenario.transitionCount,
      totalCumulativeDistance: scenario.cumulativeDistance,
      averageCumulativeDistance: scenario.cumulativeDistance,
      maxCumulativeDistanceScenarioIds: [id],
      volatilityHistogram: { [scenario.volatilityClass]: 1 },
      dominantRegimeHistogram: { [scenario.dominantRegimeClass]: 1 },
      netMutationHistogram: { [scenario.netMutationMask]: 1 }
    },
    comparisons: [],
    policyQueue: [
      {
        scenarioId: id,
        triggerSignature: signature,
        objective,
        priority: scenario.volatilityClass === "calm" ? "low" : scenario.volatilityClass === "active" ? "normal" : "high",
        allowedActions: ["monitor", "review", "escalate"],
        forbiddenActions: [
          "do not infer observations",
          "do not mutate State64 ids",
          "do not override deterministic signatures"
        ],
        reviewRequired: true
      }
    ],
    inferenceUsed: false
  };
}

function transitionChoices(anchors) {
  return anchors.slice(0, -1).map((anchor, index) => {
    const next = anchors[index + 1];
    const transition = transitionRegime(anchor.stateId, next.stateId);
    return {
      fromSnapshotId: anchor.snapshotId,
      toSnapshotId: next.snapshotId,
      sourceStateId: anchor.stateId,
      targetStateId: next.stateId,
      mutationMask: transition.mutationMask,
      distance: transition.distance,
      regimeClass: transition.regimeClass,
      choice: "lookup deterministic State64 transition"
    };
  });
}

function buildOutput({ source, anchors, transitionPacket }) {
  const scenario = transitionPacket.scenarios[0];
  const selectedAction =
    scenario.policyReadiness === "escalate" ? "escalate" : scenario.policyReadiness === "review" ? "review" : "monitor";
  return {
    timelineId: fixture.id,
    anchorRuleVersion: fixture.anchorRuleVersion,
    source,
    anchors,
    transitionPacket,
    finalOutput: {
      finalStateId: scenario.targetStateId,
      triggerSignature: scenario.signature,
      selectedAction,
      selectedPriority: transitionPacket.policyQueue[0].priority,
      inferenceUsed: false
    },
    choiceReconstruction: {
      anchorChoices: anchors.map((anchor) => ({
        snapshotId: anchor.snapshotId,
        stateId: anchor.stateId,
        decisions: anchor.decisions
      })),
      transitionChoices: transitionChoices(anchors),
      outputChoices: [
        {
          choice: "state chain",
          selected: anchors.map((anchor) => anchor.stateId),
          basis: "anchored snapshot states"
        },
        {
          choice: "transition signature",
          selected: scenario.signature,
          basis: "ordered mutation masks and net mutation mask"
        },
        {
          choice: "final action",
          selected: selectedAction,
          basis: `policyReadiness=${scenario.policyReadiness}; volatilityClass=${scenario.volatilityClass}`
        }
      ]
    }
  };
}

function runBaseline(input) {
  const started = performance.now();
  const anchors = input.snapshots.map(anchorSnapshot);
  const transitionPacket = analyzeTimelineScenario(input.id, anchors.map((anchor) => anchor.stateId), input.objective);
  return { output: buildOutput({ source: "baseline-js-local", anchors, transitionPacket }), durationMs: performance.now() - started };
}

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

class McpClient {
  constructor(binary) {
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

  async tool(name, args) {
    const response = await this.request("tools/call", { name, arguments: args });
    const structured = response?.result?.structuredContent;
    if (structured?.status !== "ok") throw new Error(`MCP ${name} rejected: ${JSON.stringify(structured)}`);
    return structured.result;
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

function findMcpBinary() {
  const exe = process.platform === "win32" ? "semagraph-mcp.exe" : "semagraph-mcp";
  const debugCandidate = resolve(repoRoot, "packages/target/debug", exe);
  execFileSync("cargo", ["build", "--manifest-path", "packages/Cargo.toml", "--bin", "semagraph-mcp"], {
    cwd: repoRoot,
    stdio: "pipe"
  });
  if (existsSync(debugCandidate) && statSync(debugCandidate).isFile()) return debugCandidate;
  throw new Error("Unable to find or build semagraph-mcp");
}

function normalizeMcpAnchor(snapshotId, raw) {
  return {
    snapshotId,
    stateId: raw.stateId,
    stateNumber: raw.stateNumber,
    binary: raw.binary,
    decisions: raw.decisions.map((decision) =>
      compact({
        position: decision.position,
        key: decision.key,
        operator: decision.operator,
        value: decision.value,
        threshold: decision.threshold,
        result: decision.result,
        trueBit: decision.trueBit,
        falseBit: decision.falseBit,
        selectedBit: decision.bit,
        unit: decision.unit,
        source: decision.source
      })
    ),
    anchorMode: raw.anchorMode,
    inferenceUsed: raw.inferenceUsed
  };
}

async function runMcp(input) {
  const binary = findMcpBinary();
  const client = new McpClient(binary);
  const started = performance.now();
  let calls = 0;
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "round-6-anchor-choice-reconstruction", version: "0.1.0" }
    });
    const tools = await client.request("tools/list");
    const toolNames = tools?.result?.tools?.map((tool) => tool.name) ?? [];
    for (const required of ["semagraph_anchor_state64", "semagraph_analyze_scenarios64", "semagraph_validate_policy_packet64"]) {
      if (!toolNames.includes(required)) throw new Error(`MCP tool missing: ${required}`);
    }

    const anchors = [];
    for (const snapshot of input.snapshots) {
      calls += 1;
      const raw = await client.tool("semagraph_anchor_state64", { observations: snapshot.observations });
      anchors.push(normalizeMcpAnchor(snapshot.id, raw));
    }

    const scenarioArgs = {
      scenarios: [{ id: input.id, states: anchors.map((anchor) => anchor.stateId), objective: input.objective }],
      comparePairs: [],
      excludePolicyScenarioIds: []
    };
    calls += 1;
    const transitionPacket = await client.tool("semagraph_analyze_scenarios64", scenarioArgs);
    calls += 1;
    const validation = await client.tool("semagraph_validate_policy_packet64", { ...scenarioArgs, packet: transitionPacket });
    if (validation.valid !== true) throw new Error(`MCP transition packet validation failed: ${JSON.stringify(validation.errors)}`);
    return {
      output: buildOutput({ source: "rust-mcp-updated", anchors, transitionPacket }),
      durationMs: performance.now() - started,
      mcpCallCount: calls,
      mcpBinary: binary,
      stderr: client.stderr.trim()
    };
  } finally {
    await client.close();
  }
}

async function runMcpSingleCall(input) {
  const binary = findMcpBinary();
  const client = new McpClient(binary);
  const started = performance.now();
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "round-6-anchor-choice-reconstruction-single-call", version: "0.1.0" }
    });
    const tools = await client.request("tools/list");
    const toolNames = tools?.result?.tools?.map((tool) => tool.name) ?? [];
    if (!toolNames.includes("semagraph_analyze_observed_timeline64")) {
      throw new Error("MCP tool missing: semagraph_analyze_observed_timeline64");
    }
    const output = await client.tool("semagraph_analyze_observed_timeline64", input);
    return {
      output,
      durationMs: performance.now() - started,
      mcpCallCount: 1,
      mcpBinary: binary,
      stderr: client.stderr.trim()
    };
  } finally {
    await client.close();
  }
}

async function invalidMcpCheck(input) {
  const binary = findMcpBinary();
  const client = new McpClient(binary);
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "round-6-invalid-check", version: "0.1.0" }
    });
    const response = await client.request("tools/call", {
      name: "semagraph_anchor_state64",
      arguments: { observations: input.snapshots[0].observations }
    });
    return response?.result?.structuredContent?.status === "rejected";
  } finally {
    await client.close();
  }
}

async function invalidMcpSingleCallCheck(input) {
  const binary = findMcpBinary();
  const client = new McpClient(binary);
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "round-6-invalid-single-call-check", version: "0.1.0" }
    });
    const response = await client.request("tools/call", {
      name: "semagraph_analyze_observed_timeline64",
      arguments: input
    });
    return response?.result?.structuredContent?.status === "rejected";
  } finally {
    await client.close();
  }
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

function comparable(output) {
  return {
    timelineId: output.timelineId,
    anchorRuleVersion: output.anchorRuleVersion,
    anchors: output.anchors,
    transitionPacket: output.transitionPacket,
    finalOutput: output.finalOutput,
    choiceReconstruction: output.choiceReconstruction
  };
}

function quality(output, expected) {
  const actual = comparable(output);
  const comparableExpected = comparable(expected);
  const checks = [
    { name: "anchors", passed: deepEqual(actual.anchors, comparableExpected.anchors) },
    { name: "transitionPacket", passed: deepEqual(actual.transitionPacket, comparableExpected.transitionPacket) },
    { name: "finalOutput", passed: deepEqual(actual.finalOutput, comparableExpected.finalOutput) },
    { name: "choiceReconstruction", passed: deepEqual(actual.choiceReconstruction, comparableExpected.choiceReconstruction) }
  ];
  return { passed: checks.filter((check) => check.passed).length, total: checks.length, checks };
}

function markdown(report) {
  return `# Round 6 Complex Anchor Choice Reconstruction

Generated from:

\`\`\`bash
node experiments/agentic-loop-benchmark/round-6-complex-anchor-choice-reconstruction/scripts/evaluate.mjs
\`\`\`

## Result

| Variant | Correct | Quality | Invalid Input | Duration | MCP Calls |
| --- | --- | ---: | --- | ---: | ---: |
${report.results
  .map(
    (result) =>
      `| \`${result.variant}\` | ${result.correct ? "yes" : "no"} | ${result.quality.passed}/${result.quality.total} | ${result.invalidInputPassed ? "passed" : "failed"} | ${result.durationMs.toFixed(3)} ms | ${result.mcpCallCount} |`
  )
  .join("\n")}

## What Is Being Tested

- Complex deterministic anchoring from six observed values per snapshot.
- Mixed value types and operators, including inverted true/false bit mappings.
- Reconstruction of the per-bit choices used to form each State64 id.
- Reconstruction of transition choices and final output action from the
  deterministic transition packet.

## Interpretation

The multi-call Rust MCP path uses \`semagraph_anchor_state64\` for every
snapshot, \`semagraph_analyze_scenarios64\` for the anchored chain, and
\`semagraph_validate_policy_packet64\` before output reconstruction.

The single-call Rust MCP path uses \`semagraph_analyze_observed_timeline64\`,
which moves the full deterministic workflow behind one tool boundary. The useful
signal is whether the MCP paths preserve the same anchor decisions and output
basis as the local baseline while making those choices auditable through tool
results.
`;
}

mkdirSync(reportsDir, { recursive: true });
mkdirSync(outputsDir, { recursive: true });

const baseline = runBaseline(fixture);
const mcp = await runMcp(fixture);
const mcpSingleCall = await runMcpSingleCall(fixture);
const expected = { ...baseline.output, source: "expected" };
const invalidBaselinePassed = (() => {
  try {
    runBaseline(invalidFixture);
    return false;
  } catch {
    return true;
  }
})();
const invalidMcpPassed = await invalidMcpCheck(invalidFixture);
const invalidMcpSingleCallPassed = await invalidMcpSingleCallCheck(invalidFixture);

writeFileSync(resolve(outputsDir, "baseline-output.json"), `${JSON.stringify(baseline.output, null, 2)}\n`);
writeFileSync(resolve(outputsDir, "rust-mcp-updated-output.json"), `${JSON.stringify(mcp.output, null, 2)}\n`);
writeFileSync(resolve(outputsDir, "rust-mcp-single-call-output.json"), `${JSON.stringify(mcpSingleCall.output, null, 2)}\n`);

const baselineQuality = quality(baseline.output, expected);
const mcpQuality = quality(mcp.output, expected);
const mcpSingleCallQuality = quality(mcpSingleCall.output, expected);
const report = {
  benchmark: "round-6-complex-anchor-choice-reconstruction",
  generatedAt: new Date().toISOString(),
  fixture: "fixtures/anchor-timeline.json",
  invalidFixture: "fixtures/invalid-anchor-timeline.json",
  results: [
    {
      variant: "baseline-js-local",
      correct: baselineQuality.passed === baselineQuality.total && invalidBaselinePassed,
      quality: baselineQuality,
      invalidInputPassed: invalidBaselinePassed,
      durationMs: baseline.durationMs,
      mcpCallCount: 0
    },
    {
      variant: "rust-mcp-updated",
      correct: mcpQuality.passed === mcpQuality.total && invalidMcpPassed,
      quality: mcpQuality,
      invalidInputPassed: invalidMcpPassed,
      durationMs: mcp.durationMs,
      mcpCallCount: mcp.mcpCallCount,
      mcpBinary: mcp.mcpBinary,
      stderr: mcp.stderr
    },
    {
      variant: "rust-mcp-single-call",
      correct: mcpSingleCallQuality.passed === mcpSingleCallQuality.total && invalidMcpSingleCallPassed,
      quality: mcpSingleCallQuality,
      invalidInputPassed: invalidMcpSingleCallPassed,
      durationMs: mcpSingleCall.durationMs,
      mcpCallCount: mcpSingleCall.mcpCallCount,
      mcpBinary: mcpSingleCall.mcpBinary,
      stderr: mcpSingleCall.stderr
    }
  ]
};

writeFileSync(resolve(reportsDir, "latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(reportsDir, "comparison.md"), markdown(report));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
