#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const STATE_ID_PATTERN = /^S64-[01]{6}$/;
const MASK_ID_PATTERN = /^M64-[01]{6}$/;
const FORBIDDEN_ACTIONS = [
  "do not infer observations",
  "do not mutate State64 ids",
  "do not override deterministic signatures"
] as const;
const ALLOWED_POLICY_ACTIONS = ["monitor", "review", "escalate"] as const;

type JsonRpcId = number;

type InputFile = {
  scenarios: ScenarioInput[];
  comparePairs: ComparePairInput[];
};

type ScenarioInput = {
  id: string;
  states: string[];
  objective: string;
};

type ComparePairInput = {
  left: string;
  right: string;
};

type RegimeClass =
  | "no_change"
  | "bit_adjustment"
  | "module_reconfiguration"
  | "cross_module_regime_shift"
  | "near_total_inversion"
  | "full_bit_reversal";

type VolatilityClass = "calm" | "active" | "volatile";
type PolicyReadiness = "hold" | "review" | "escalate";
type PolicyPriority = "low" | "normal" | "high";

type McpTransition = {
  sourceStateId: string;
  targetStateId: string;
  mutationMask: string;
  distance: number;
  lowerDistance: number;
  upperDistance: number;
  moduleScope: string;
  regimeClass: RegimeClass;
  sourceNumber: number;
  targetNumber: number;
  mutationMaskNumber: number;
  transitionIndex: number;
  packed: string;
  inferenceUsed: false;
};

type McpCompression = {
  sourceStateId: string;
  targetStateId: string;
  states: string[];
  transitions: McpTransition[];
  orderedMutationMasks: string[];
  netMutationMask: string;
  cumulativeDistance: number;
  signature: string;
  stateNumbers: number[];
  netMutationMaskNumber: number;
  inferenceUsed: false;
};

type McpStructuredContent<T> = {
  tool: string;
  status: "ok" | "rejected";
  result?: T;
  error?: string;
};

type ScenarioOutput = {
  id: string;
  sourceStateId: string;
  targetStateId: string;
  states: string[];
  transitionCount: number;
  orderedMutationMasks: string[];
  netMutationMask: string;
  cumulativeDistance: number;
  netDistance: number;
  dominantRegimeClass: RegimeClass;
  volatilityClass: VolatilityClass;
  policyReadiness: PolicyReadiness;
  signature: string;
  summary: string;
};

type AggregateOutput = {
  scenarioCount: number;
  totalTransitions: number;
  totalCumulativeDistance: number;
  averageCumulativeDistance: number;
  maxCumulativeDistanceScenarioIds: string[];
  volatilityHistogram: Record<string, number>;
  dominantRegimeHistogram: Record<string, number>;
  netMutationHistogram: Record<string, number>;
};

type ComparisonOutput = {
  left: string;
  right: string;
  sameNetMutationMask: boolean;
  sameDominantRegimeClass: boolean;
  sameVolatilityClass: boolean;
  cumulativeDistanceDelta: number;
  sharedOrderedMutationMaskCount: number;
  sharedStateCount: number;
};

type PolicyQueueItem = {
  scenarioId: string;
  triggerSignature: string;
  objective: string;
  priority: PolicyPriority;
  allowedActions: string[];
  forbiddenActions: string[];
  reviewRequired: boolean;
};

type WorkbenchOutput = {
  scenarios: ScenarioOutput[];
  aggregate: AggregateOutput;
  comparisons: ComparisonOutput[];
  policyQueue: PolicyQueueItem[];
};

type PendingMcpCall = {
  id: JsonRpcId;
  name: string;
  arguments: Record<string, unknown>;
};

type McpResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: {
    structuredContent?: McpStructuredContent<unknown>;
  };
  error?: {
    code: number;
    message: string;
  };
};

class WorkbenchError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

function main(): void {
  try {
    const inputPath = process.argv[2];
    if (!inputPath) {
      throw new WorkbenchError("usage: node dist/policy-transition-workbench.js <input.json>", 2);
    }

    const input = loadInput(inputPath);
    validateInput(input);

    const mcpFacts = requestDeterministicFacts(input.scenarios);
    const scenarios = input.scenarios.map((scenario) => {
      const compression = mcpFacts.compressions.get(scenario.id);
      if (!compression) {
        throw new WorkbenchError(`Missing deterministic compression for scenario '${scenario.id}'.`);
      }
      return buildScenarioOutput(scenario, compression);
    });

    const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    const aggregate = buildAggregate(scenarios);
    const comparisons = input.comparePairs.map((pair) => buildComparison(pair, scenarioById));
    const policyQueue = buildPolicyQueue(input.scenarios, scenarioById);

    const output: WorkbenchOutput = {
      scenarios,
      aggregate,
      comparisons,
      policyQueue
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
    process.exitCode = error instanceof WorkbenchError ? error.exitCode : 1;
  }
}

function loadInput(path: string): InputFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new WorkbenchError(`Failed to read or parse input JSON: ${detail}`);
  }
  return parsed as InputFile;
}

function validateInput(input: InputFile): void {
  if (!isRecord(input)) {
    throw new WorkbenchError("Input must be a JSON object.");
  }
  if (!Array.isArray(input.scenarios)) {
    throw new WorkbenchError("Input field 'scenarios' must be an array.");
  }
  if (!Array.isArray(input.comparePairs)) {
    throw new WorkbenchError("Input field 'comparePairs' must be an array.");
  }

  const ids = new Set<string>();
  for (const [index, scenario] of input.scenarios.entries()) {
    if (!isRecord(scenario)) {
      throw new WorkbenchError(`Scenario at index ${index} must be an object.`);
    }
    if (typeof scenario.id !== "string" || scenario.id.trim() === "") {
      throw new WorkbenchError(`Scenario at index ${index} requires a non-empty string id.`);
    }
    if (ids.has(scenario.id)) {
      throw new WorkbenchError(`Duplicate scenario id '${scenario.id}'.`);
    }
    ids.add(scenario.id);

    if (!Array.isArray(scenario.states) || scenario.states.length < 2) {
      throw new WorkbenchError(`Scenario '${scenario.id}' requires at least two states.`);
    }
    for (const state of scenario.states) {
      if (typeof state !== "string" || !STATE_ID_PATTERN.test(state)) {
        throw new WorkbenchError(`Scenario '${scenario.id}' has invalid canonical State64 id '${String(state)}'.`);
      }
    }
    if (typeof scenario.objective !== "string") {
      throw new WorkbenchError(`Scenario '${scenario.id}' requires a string objective.`);
    }
  }

  for (const [index, pair] of input.comparePairs.entries()) {
    if (!isRecord(pair) || typeof pair.left !== "string" || typeof pair.right !== "string") {
      throw new WorkbenchError(`Compare pair at index ${index} must contain string left and right ids.`);
    }
    if (!ids.has(pair.left)) {
      throw new WorkbenchError(`Compare pair at index ${index} references unknown left scenario '${pair.left}'.`);
    }
    if (!ids.has(pair.right)) {
      throw new WorkbenchError(`Compare pair at index ${index} references unknown right scenario '${pair.right}'.`);
    }
  }
}

function requestDeterministicFacts(scenarios: ScenarioInput[]): { compressions: Map<string, McpCompression> } {
  const calls: PendingMcpCall[] = [
    {
      id: 1,
      name: "semagraph_verify_transition_basis",
      arguments: {}
    }
  ];

  for (const [index, scenario] of scenarios.entries()) {
    calls.push({
      id: index + 2,
      name: "semagraph_compress_chain64",
      arguments: { states: scenario.states }
    });
  }

  const responses = callSemagraphMcp(calls);
  const verify = extractMcpResult<{ verified: number; total: number; ok: boolean }>(
    responses,
    1,
    "semagraph_verify_transition_basis"
  );
  if (!verify.ok || verify.verified !== 4096 || verify.total !== 4096) {
    throw new WorkbenchError("Rust MCP transition basis verification failed.");
  }

  const compressions = new Map<string, McpCompression>();
  for (const [index, scenario] of scenarios.entries()) {
    const compression = extractMcpResult<McpCompression>(
      responses,
      index + 2,
      "semagraph_compress_chain64"
    );
    assertMcpCompressionShape(scenario, compression);
    compressions.set(scenario.id, compression);
  }
  return { compressions };
}

function callSemagraphMcp(calls: PendingMcpCall[]): Map<JsonRpcId, McpResponse> {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
  const input = calls
    .map((call) =>
      frameJson({
        jsonrpc: "2.0",
        id: call.id,
        method: "tools/call",
        params: {
          name: call.name,
          arguments: call.arguments
        }
      })
    )
    .join("");

  const result = spawnSync(
    "cargo",
    ["run", "--quiet", "--manifest-path", "packages/Cargo.toml", "--bin", "semagraph-mcp"],
    {
      cwd: workspaceRoot,
      input,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    }
  );

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    throw new WorkbenchError(`Rust MCP server failed${stderr ? `: ${stderr}` : "."}`);
  }

  const parsed = readFrames(result.stdout);
  const responses = new Map<JsonRpcId, McpResponse>();
  for (const response of parsed) {
    responses.set(response.id, response);
  }
  return responses;
}

function frameJson(value: unknown): string {
  const body = JSON.stringify(value);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function readFrames(output: string): McpResponse[] {
  const frames: McpResponse[] = [];
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
    frames.push(JSON.parse(body) as McpResponse);
    cursor = bodyStart + length;
  }
  return frames;
}

function extractMcpResult<T>(responses: Map<JsonRpcId, McpResponse>, id: JsonRpcId, expectedTool: string): T {
  const response = responses.get(id);
  if (!response) {
    throw new WorkbenchError(`Missing Rust MCP response for request id ${id}.`);
  }
  if (response.error) {
    throw new WorkbenchError(`Rust MCP JSON-RPC error for ${expectedTool}: ${response.error.message}`);
  }
  const structured = response.result?.structuredContent as McpStructuredContent<T> | undefined;
  if (!structured) {
    throw new WorkbenchError(`Rust MCP response for ${expectedTool} lacked structuredContent.`);
  }
  if (structured.tool !== expectedTool) {
    throw new WorkbenchError(`Rust MCP response id ${id} returned '${structured.tool}', expected '${expectedTool}'.`);
  }
  if (structured.status !== "ok" || structured.result === undefined) {
    throw new WorkbenchError(`Rust MCP tool ${expectedTool} rejected request: ${structured.error ?? "unknown error"}`);
  }
  return structured.result;
}

function assertMcpCompressionShape(scenario: ScenarioInput, compression: McpCompression): void {
  for (const state of compression.states) {
    if (!STATE_ID_PATTERN.test(state)) {
      throw new WorkbenchError(`Rust MCP returned invalid State64 id '${state}' for scenario '${scenario.id}'.`);
    }
  }
  if (compression.states.join("\u0000") !== scenario.states.join("\u0000")) {
    throw new WorkbenchError(`Rust MCP returned a state chain that differs from scenario '${scenario.id}'.`);
  }
  for (const mask of compression.orderedMutationMasks) {
    if (!MASK_ID_PATTERN.test(mask)) {
      throw new WorkbenchError(`Rust MCP returned invalid mutation mask '${mask}' for scenario '${scenario.id}'.`);
    }
  }
  if (!MASK_ID_PATTERN.test(compression.netMutationMask)) {
    throw new WorkbenchError(`Rust MCP returned invalid net mutation mask '${compression.netMutationMask}' for scenario '${scenario.id}'.`);
  }
  if (compression.inferenceUsed !== false) {
    throw new WorkbenchError(`Rust MCP reported inference use for scenario '${scenario.id}'.`);
  }
}

function buildScenarioOutput(input: ScenarioInput, compression: McpCompression): ScenarioOutput {
  const transitionCount = compression.states.length - 1;
  const netDistance = maskDistance(compression.netMutationMask);
  const dominantRegimeClass = dominantRegime(compression.transitions);
  const volatilityClass = classifyVolatility(compression.cumulativeDistance);
  const policyReadiness = readinessFor(volatilityClass);

  return {
    id: input.id,
    sourceStateId: compression.sourceStateId,
    targetStateId: compression.targetStateId,
    states: [...compression.states],
    transitionCount,
    orderedMutationMasks: [...compression.orderedMutationMasks],
    netMutationMask: compression.netMutationMask,
    cumulativeDistance: compression.cumulativeDistance,
    netDistance,
    dominantRegimeClass,
    volatilityClass,
    policyReadiness,
    signature: compression.signature,
    summary: `${input.id}: ${compression.sourceStateId} to ${compression.targetStateId}; ${volatilityClass}; cumulative distance ${compression.cumulativeDistance}.`
  };
}

function dominantRegime(transitions: McpTransition[]): RegimeClass {
  const stats = new Map<RegimeClass, { count: number; distance: number }>();
  for (const transition of transitions) {
    const current = stats.get(transition.regimeClass) ?? { count: 0, distance: 0 };
    current.count += 1;
    current.distance += transition.distance;
    stats.set(transition.regimeClass, current);
  }

  const ordered = [...stats.entries()].sort(([leftClass, left], [rightClass, right]) => {
    if (left.count !== right.count) return right.count - left.count;
    if (left.distance !== right.distance) return right.distance - left.distance;
    return leftClass.localeCompare(rightClass);
  });
  const winner = ordered[0]?.[0];
  if (!winner) {
    throw new WorkbenchError("Cannot determine dominant regime for an empty transition set.");
  }
  return winner;
}

function classifyVolatility(cumulativeDistance: number): VolatilityClass {
  if (cumulativeDistance <= 3) return "calm";
  if (cumulativeDistance <= 7) return "active";
  return "volatile";
}

function readinessFor(volatility: VolatilityClass): PolicyReadiness {
  if (volatility === "calm") return "hold";
  if (volatility === "active") return "review";
  return "escalate";
}

function priorityFor(volatility: VolatilityClass): PolicyPriority {
  if (volatility === "calm") return "low";
  if (volatility === "active") return "normal";
  return "high";
}

function buildAggregate(scenarios: ScenarioOutput[]): AggregateOutput {
  const totalTransitions = scenarios.reduce((sum, scenario) => sum + scenario.transitionCount, 0);
  const totalCumulativeDistance = scenarios.reduce((sum, scenario) => sum + scenario.cumulativeDistance, 0);
  const maxCumulativeDistance = scenarios.length === 0
    ? undefined
    : Math.max(...scenarios.map((scenario) => scenario.cumulativeDistance));

  return {
    scenarioCount: scenarios.length,
    totalTransitions,
    totalCumulativeDistance,
    averageCumulativeDistance: scenarios.length === 0 ? 0 : totalCumulativeDistance / scenarios.length,
    maxCumulativeDistanceScenarioIds: maxCumulativeDistance === undefined
      ? []
      : scenarios
        .filter((scenario) => scenario.cumulativeDistance === maxCumulativeDistance)
        .map((scenario) => scenario.id),
    volatilityHistogram: histogram(scenarios.map((scenario) => scenario.volatilityClass)),
    dominantRegimeHistogram: histogram(scenarios.map((scenario) => scenario.dominantRegimeClass)),
    netMutationHistogram: histogram(scenarios.map((scenario) => scenario.netMutationMask))
  };
}

function buildComparison(pair: ComparePairInput, scenarioById: Map<string, ScenarioOutput>): ComparisonOutput {
  const left = mustGetScenario(pair.left, scenarioById);
  const right = mustGetScenario(pair.right, scenarioById);

  return {
    left: pair.left,
    right: pair.right,
    sameNetMutationMask: left.netMutationMask === right.netMutationMask,
    sameDominantRegimeClass: left.dominantRegimeClass === right.dominantRegimeClass,
    sameVolatilityClass: left.volatilityClass === right.volatilityClass,
    cumulativeDistanceDelta: Math.abs(left.cumulativeDistance - right.cumulativeDistance),
    sharedOrderedMutationMaskCount: countRightItemsPresentInLeftSet(left.orderedMutationMasks, right.orderedMutationMasks),
    sharedStateCount: countRightItemsPresentInLeftSet(left.states, right.states)
  };
}

function buildPolicyQueue(inputs: ScenarioInput[], scenarioById: Map<string, ScenarioOutput>): PolicyQueueItem[] {
  const queue: PolicyQueueItem[] = [];
  for (const input of inputs) {
    if (input.id === "calm-zero") {
      continue;
    }
    const scenario = mustGetScenario(input.id, scenarioById);
    queue.push({
      scenarioId: scenario.id,
      triggerSignature: scenario.signature,
      objective: input.objective,
      priority: priorityFor(scenario.volatilityClass),
      allowedActions: [...ALLOWED_POLICY_ACTIONS],
      forbiddenActions: [...FORBIDDEN_ACTIONS],
      reviewRequired: true
    });
  }
  return queue;
}

function maskDistance(mask: string): number {
  if (!MASK_ID_PATTERN.test(mask)) {
    throw new WorkbenchError(`Invalid canonical mutation mask '${mask}'.`);
  }
  return [...mask.slice(4)].filter((bit) => bit === "1").length;
}

function histogram(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function countRightItemsPresentInLeftSet(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  return right.filter((value) => leftSet.has(value)).length;
}

function mustGetScenario(id: string, scenarioById: Map<string, ScenarioOutput>): ScenarioOutput {
  const scenario = scenarioById.get(id);
  if (!scenario) {
    throw new WorkbenchError(`Unknown scenario '${id}'.`);
  }
  return scenario;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

main();
