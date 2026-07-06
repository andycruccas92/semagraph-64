#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATE64_PATTERN = /^S64-[01]{6}$/;
const STATE_PREFIX_LENGTH = "S64-".length;
const MASK_PREFIX = "M64-";

type State64Id = `S64-${string}`;
type Mask64Id = `M64-${string}`;
type VolatilityClass = "calm" | "active" | "volatile";

interface Dataset {
  scenarios: InputScenario[];
  comparePairs: ComparePair[];
}

interface InputScenario {
  id: string;
  states: State64Id[];
}

interface ComparePair {
  left: string;
  right: string;
}

interface ScenarioResult {
  id: string;
  sourceStateId: State64Id;
  targetStateId: State64Id;
  transitionCount: number;
  changedMasks: Mask64Id[];
  netMutationMask: Mask64Id;
  cumulativeDistance: number;
  netDistance: number;
  volatilityClass: VolatilityClass;
  summary: string;
}

interface AggregateResult {
  scenarioCount: number;
  totalTransitions: number;
  totalCumulativeDistance: number;
  maxCumulativeDistanceScenarioId: string;
  netMutationHistogram: Record<string, number>;
}

interface ComparisonResult {
  left: string;
  right: string;
  sameNetMutationMask: boolean;
  cumulativeDistanceDelta: number;
  sharedChangedMaskCount: number;
}

interface WorkbenchResult {
  scenarios: ScenarioResult[];
  aggregate: AggregateResult;
  comparisons: ComparisonResult[];
}

interface CliOptions {
  inputPath: string;
  outputPath?: string;
}

function fail(message: string): never {
  process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  process.exit(1);
}

function usage(): string {
  return [
    "Usage: transition-workbench <dataset.json> [--output <output.json>]",
    "",
    "Dataset shape:",
    '{ "scenarios": [{ "id": string, "states": string[] }], "comparePairs": [{ "left": string, "right": string }] }'
  ].join("\n");
}

function parseCliOptions(args: string[]): CliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }

    if (arg === "--output" || arg === "-o") {
      const next = args[index + 1];
      if (!next) {
        fail("Missing path after --output.");
      }
      outputPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      const next = arg.slice("--output=".length);
      if (next.length === 0) {
        fail("Missing path after --output=.");
      }
      outputPath = next;
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}.`);
    }

    if (inputPath !== undefined) {
      fail("Expected exactly one dataset path.");
    }

    inputPath = arg;
  }

  if (inputPath === undefined) {
    fail(usage());
  }

  return outputPath === undefined ? { inputPath } : { inputPath, outputPath };
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read or parse JSON file: ${detail}`);
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function parseStateId(value: unknown, path: string): State64Id {
  if (typeof value !== "string" || !STATE64_PATTERN.test(value)) {
    throw new Error(`${path} must match S64-[01]{6}.`);
  }

  return value as State64Id;
}

function parseScenario(value: unknown, index: number): InputScenario {
  const record = expectRecord(value, `scenarios[${index}]`);
  const id = record.id;
  const states = record.states;

  if (typeof id !== "string") {
    throw new Error(`scenarios[${index}].id must be a string.`);
  }

  if (!Array.isArray(states)) {
    throw new Error(`scenarios[${index}].states must be an array.`);
  }

  if (states.length < 2) {
    throw new Error(`scenarios[${index}].states must contain at least 2 states.`);
  }

  return {
    id,
    states: states.map((state, stateIndex) =>
      parseStateId(state, `scenarios[${index}].states[${stateIndex}]`)
    )
  };
}

function parseComparePair(value: unknown, index: number): ComparePair {
  const record = expectRecord(value, `comparePairs[${index}]`);
  const left = record.left;
  const right = record.right;

  if (typeof left !== "string") {
    throw new Error(`comparePairs[${index}].left must be a string.`);
  }

  if (typeof right !== "string") {
    throw new Error(`comparePairs[${index}].right must be a string.`);
  }

  return { left, right };
}

function parseDataset(value: unknown): Dataset {
  const record = expectRecord(value, "dataset");
  const scenarios = record.scenarios;
  const comparePairs = record.comparePairs;

  if (!Array.isArray(scenarios)) {
    throw new Error("dataset.scenarios must be an array.");
  }

  if (scenarios.length === 0) {
    throw new Error("dataset.scenarios must contain at least one scenario.");
  }

  if (!Array.isArray(comparePairs)) {
    throw new Error("dataset.comparePairs must be an array.");
  }

  const parsedScenarios = scenarios.map((scenario, index) => parseScenario(scenario, index));
  const scenarioIds = new Set<string>();

  for (const scenario of parsedScenarios) {
    if (scenarioIds.has(scenario.id)) {
      throw new Error(`Duplicate scenario id: ${scenario.id}.`);
    }
    scenarioIds.add(scenario.id);
  }

  const parsedPairs = comparePairs.map((pair, index) => parseComparePair(pair, index));

  for (const [index, pair] of parsedPairs.entries()) {
    if (!scenarioIds.has(pair.left)) {
      throw new Error(`comparePairs[${index}].left does not reference a scenario id: ${pair.left}.`);
    }

    if (!scenarioIds.has(pair.right)) {
      throw new Error(`comparePairs[${index}].right does not reference a scenario id: ${pair.right}.`);
    }
  }

  return {
    scenarios: parsedScenarios,
    comparePairs: parsedPairs
  };
}

function stateBits(stateId: State64Id): string {
  return stateId.slice(STATE_PREFIX_LENGTH);
}

function mutationMask(fromStateId: State64Id, toStateId: State64Id): Mask64Id {
  const fromBits = stateBits(fromStateId);
  const toBits = stateBits(toStateId);
  let maskBits = "";

  for (let index = 0; index < 6; index += 1) {
    maskBits += fromBits.charAt(index) === toBits.charAt(index) ? "0" : "1";
  }

  return `${MASK_PREFIX}${maskBits}` as Mask64Id;
}

function maskDistance(mask: Mask64Id): number {
  let distance = 0;

  for (const bit of mask.slice(MASK_PREFIX.length)) {
    if (bit === "1") {
      distance += 1;
    }
  }

  return distance;
}

function classifyVolatility(cumulativeDistance: number): VolatilityClass {
  if (cumulativeDistance <= 3) {
    return "calm";
  }

  if (cumulativeDistance <= 7) {
    return "active";
  }

  return "volatile";
}

function summarizeScenario(result: Omit<ScenarioResult, "summary">): string {
  const transitionWord = result.transitionCount === 1 ? "transition" : "transitions";
  return (
    `${result.id}: ${result.transitionCount} ${transitionWord} from ` +
    `${result.sourceStateId} to ${result.targetStateId}; net mutation ` +
    `${result.netMutationMask} at distance ${result.netDistance}; cumulative distance ` +
    `${result.cumulativeDistance}; volatility ${result.volatilityClass}.`
  );
}

function evaluateScenario(scenario: InputScenario): ScenarioResult {
  const changedMasks: Mask64Id[] = [];
  let cumulativeDistance = 0;

  for (let index = 0; index < scenario.states.length - 1; index += 1) {
    const fromStateId = scenario.states[index];
    const toStateId = scenario.states[index + 1];

    if (fromStateId === undefined || toStateId === undefined) {
      throw new Error(`Scenario ${scenario.id} has an incomplete adjacent transition.`);
    }

    const mask = mutationMask(fromStateId, toStateId);
    changedMasks.push(mask);
    cumulativeDistance += maskDistance(mask);
  }

  const sourceStateId = scenario.states[0];
  const targetStateId = scenario.states[scenario.states.length - 1];

  if (sourceStateId === undefined || targetStateId === undefined) {
    throw new Error(`Scenario ${scenario.id} must contain at least 2 states.`);
  }

  const netMutationMask = mutationMask(sourceStateId, targetStateId);
  const transitionCount = changedMasks.length;
  const netDistance = maskDistance(netMutationMask);
  const volatilityClass = classifyVolatility(cumulativeDistance);
  const withoutSummary = {
    id: scenario.id,
    sourceStateId,
    targetStateId,
    transitionCount,
    changedMasks,
    netMutationMask,
    cumulativeDistance,
    netDistance,
    volatilityClass
  };

  return {
    ...withoutSummary,
    summary: summarizeScenario(withoutSummary)
  };
}

function buildAggregate(scenarios: ScenarioResult[]): AggregateResult {
  const histogram = new Map<Mask64Id, number>();
  let totalTransitions = 0;
  let totalCumulativeDistance = 0;
  let maxScenario = scenarios[0];

  if (maxScenario === undefined) {
    throw new Error("Cannot aggregate an empty scenario list.");
  }

  for (const scenario of scenarios) {
    totalTransitions += scenario.transitionCount;
    totalCumulativeDistance += scenario.cumulativeDistance;
    histogram.set(scenario.netMutationMask, (histogram.get(scenario.netMutationMask) ?? 0) + 1);

    if (scenario.cumulativeDistance > maxScenario.cumulativeDistance) {
      maxScenario = scenario;
    }
  }

  const netMutationHistogram: Record<string, number> = {};
  for (const mask of [...histogram.keys()].sort()) {
    netMutationHistogram[mask] = histogram.get(mask) ?? 0;
  }

  return {
    scenarioCount: scenarios.length,
    totalTransitions,
    totalCumulativeDistance,
    maxCumulativeDistanceScenarioId: maxScenario.id,
    netMutationHistogram
  };
}

function compareScenarios(pair: ComparePair, scenariosById: Map<string, ScenarioResult>): ComparisonResult {
  const left = scenariosById.get(pair.left);
  const right = scenariosById.get(pair.right);

  if (left === undefined || right === undefined) {
    throw new Error(`Comparison references an unknown scenario: ${pair.left}, ${pair.right}.`);
  }

  const leftChangedMasks = new Set(left.changedMasks);
  const rightChangedMasks = new Set(right.changedMasks);
  let sharedChangedMaskCount = 0;

  for (const mask of leftChangedMasks) {
    if (rightChangedMasks.has(mask)) {
      sharedChangedMaskCount += 1;
    }
  }

  return {
    left: pair.left,
    right: pair.right,
    sameNetMutationMask: left.netMutationMask === right.netMutationMask,
    cumulativeDistanceDelta: left.cumulativeDistance - right.cumulativeDistance,
    sharedChangedMaskCount
  };
}

export function evaluateDataset(dataset: Dataset): WorkbenchResult {
  const scenarios = dataset.scenarios.map((scenario) => evaluateScenario(scenario));
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  return {
    scenarios,
    aggregate: buildAggregate(scenarios),
    comparisons: dataset.comparePairs.map((pair) => compareScenarios(pair, scenariosById))
  };
}

export function evaluateUnknownDataset(value: unknown): WorkbenchResult {
  return evaluateDataset(parseDataset(value));
}

export function main(args: string[]): void {
  const options = parseCliOptions(args);

  try {
    const dataset = parseDataset(readJsonFile(resolve(options.inputPath)));
    const result = evaluateDataset(dataset);
    const output = `${JSON.stringify(result, null, 2)}\n`;

    if (options.outputPath !== undefined) {
      writeFileSync(resolve(options.outputPath), output, "utf8");
    }

    process.stdout.write(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(message);
  }
}

const entryPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);

if (entryPath === modulePath) {
  main(process.argv.slice(2));
}
