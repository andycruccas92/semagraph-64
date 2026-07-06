#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATE64_PATTERN = /^S64-[01]{6}$/;

export type State64Id = `S64-${string}`;
export type MutationMask64 = `M64-${string}`;
export type VolatilityClass = "calm" | "active" | "volatile";

export type ScenarioInput = {
  id: string;
  states: readonly State64Id[];
};

export type ComparePairInput = {
  left: string;
  right: string;
};

export type TransitionWorkbenchDataset = {
  scenarios: readonly ScenarioInput[];
  comparePairs: readonly ComparePairInput[];
};

export type ScenarioWorkbenchOutput = {
  id: string;
  sourceStateId: State64Id;
  targetStateId: State64Id;
  states: readonly State64Id[];
  transitionCount: number;
  changedMasks: readonly MutationMask64[];
  netMutationMask: MutationMask64;
  cumulativeDistance: number;
  netDistance: number;
  volatilityClass: VolatilityClass;
  summary: string;
};

export type AggregateWorkbenchOutput = {
  scenarioCount: number;
  totalTransitions: number;
  totalCumulativeDistance: number;
  maxCumulativeDistanceScenarioId: string | null;
  netMutationHistogram: Record<string, number>;
};

export type ComparisonWorkbenchOutput = {
  left: string;
  right: string;
  sameNetMutationMask: boolean;
  cumulativeDistanceDelta: number;
  sharedChangedMaskCount: number;
};

export type TransitionWorkbenchOutput = {
  scenarios: readonly ScenarioWorkbenchOutput[];
  aggregate: AggregateWorkbenchOutput;
  comparisons: readonly ComparisonWorkbenchOutput[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }
  if (value.length === 0) {
    throw new Error(`${path} must not be empty.`);
  }
  return value;
}

function requireState64Id(value: unknown, path: string): State64Id {
  if (typeof value !== "string" || !STATE64_PATTERN.test(value)) {
    throw new Error(`${path} must match S64-[01]{6}.`);
  }
  return value as State64Id;
}

function stateBits(state: State64Id): string {
  return state.slice(4);
}

function maskBetween(source: State64Id, target: State64Id): MutationMask64 {
  const sourceBits = stateBits(source);
  const targetBits = stateBits(target);
  let maskBits = "";

  for (let index = 0; index < 6; index += 1) {
    maskBits += sourceBits.charAt(index) === targetBits.charAt(index) ? "0" : "1";
  }

  return `M64-${maskBits}`;
}

function distanceFromMask(mask: MutationMask64): number {
  let distance = 0;
  for (const bit of mask.slice(4)) {
    if (bit === "1") distance += 1;
  }
  return distance;
}

function classifyVolatility(cumulativeDistance: number): VolatilityClass {
  if (cumulativeDistance <= 3) return "calm";
  if (cumulativeDistance <= 7) return "active";
  return "volatile";
}

export function parseTransitionWorkbenchDataset(parsed: unknown): TransitionWorkbenchDataset {
  if (!isRecord(parsed)) {
    throw new Error("Input JSON must be an object with scenarios and comparePairs.");
  }

  const scenariosRaw = parsed.scenarios;
  const comparePairsRaw = parsed.comparePairs;

  if (!Array.isArray(scenariosRaw)) {
    throw new Error("scenarios must be an array.");
  }
  if (!Array.isArray(comparePairsRaw)) {
    throw new Error("comparePairs must be an array.");
  }

  const seenScenarioIds = new Set<string>();
  const scenarios = scenariosRaw.map((scenarioRaw, scenarioIndex): ScenarioInput => {
    if (!isRecord(scenarioRaw)) {
      throw new Error(`scenarios[${scenarioIndex}] must be an object.`);
    }

    const id = requireString(scenarioRaw.id, `scenarios[${scenarioIndex}].id`);
    if (seenScenarioIds.has(id)) {
      throw new Error(`Duplicate scenario id: ${id}.`);
    }
    seenScenarioIds.add(id);

    if (!Array.isArray(scenarioRaw.states)) {
      throw new Error(`scenarios[${scenarioIndex}].states must be an array.`);
    }
    if (scenarioRaw.states.length < 2) {
      throw new Error(`scenarios[${scenarioIndex}].states must contain at least 2 states.`);
    }

    const states = scenarioRaw.states.map((state, stateIndex) =>
      requireState64Id(state, `scenarios[${scenarioIndex}].states[${stateIndex}]`)
    );

    return { id, states };
  });

  const comparePairs = comparePairsRaw.map((pairRaw, pairIndex): ComparePairInput => {
    if (!isRecord(pairRaw)) {
      throw new Error(`comparePairs[${pairIndex}] must be an object.`);
    }

    return {
      left: requireString(pairRaw.left, `comparePairs[${pairIndex}].left`),
      right: requireString(pairRaw.right, `comparePairs[${pairIndex}].right`)
    };
  });

  return { scenarios, comparePairs };
}

export function analyzeScenario(scenario: ScenarioInput): ScenarioWorkbenchOutput {
  if (scenario.states.length < 2) {
    throw new Error(`Scenario ${scenario.id} must contain at least 2 states.`);
  }

  const sourceStateId = scenario.states.at(0);
  const targetStateId = scenario.states.at(-1);
  if (sourceStateId === undefined || targetStateId === undefined) {
    throw new Error(`Scenario ${scenario.id} has an invalid empty state chain.`);
  }

  const changedMasks: MutationMask64[] = [];
  for (let index = 0; index < scenario.states.length - 1; index += 1) {
    const source = scenario.states[index];
    const target = scenario.states[index + 1];
    if (source === undefined || target === undefined) {
      throw new Error(`Scenario ${scenario.id} has an invalid state chain.`);
    }
    changedMasks.push(maskBetween(source, target));
  }

  const transitionCount = changedMasks.length;
  const netMutationMask = maskBetween(sourceStateId, targetStateId);
  const cumulativeDistance = changedMasks.reduce((sum, mask) => sum + distanceFromMask(mask), 0);
  const netDistance = distanceFromMask(netMutationMask);
  const volatilityClass = classifyVolatility(cumulativeDistance);

  return {
    id: scenario.id,
    sourceStateId,
    targetStateId,
    states: scenario.states,
    transitionCount,
    changedMasks,
    netMutationMask,
    cumulativeDistance,
    netDistance,
    volatilityClass,
    summary: `${scenario.id}: ${transitionCount} deterministic State64 transition${transitionCount === 1 ? "" : "s"} from ${sourceStateId} to ${targetStateId}; net mutation ${netMutationMask} with net distance ${netDistance}; cumulative distance ${cumulativeDistance}; volatility ${volatilityClass}.`
  };
}

function buildAggregate(scenarios: readonly ScenarioWorkbenchOutput[]): AggregateWorkbenchOutput {
  const histogram = new Map<MutationMask64, number>();
  let totalTransitions = 0;
  let totalCumulativeDistance = 0;
  let maxCumulativeDistanceScenarioId: string | null = null;
  let maxCumulativeDistance = Number.NEGATIVE_INFINITY;

  for (const scenario of scenarios) {
    totalTransitions += scenario.transitionCount;
    totalCumulativeDistance += scenario.cumulativeDistance;
    histogram.set(scenario.netMutationMask, (histogram.get(scenario.netMutationMask) ?? 0) + 1);

    if (scenario.cumulativeDistance > maxCumulativeDistance) {
      maxCumulativeDistance = scenario.cumulativeDistance;
      maxCumulativeDistanceScenarioId = scenario.id;
    }
  }

  return {
    scenarioCount: scenarios.length,
    totalTransitions,
    totalCumulativeDistance,
    maxCumulativeDistanceScenarioId,
    netMutationHistogram: Object.fromEntries(histogram.entries())
  };
}

function compareScenarios(left: ScenarioWorkbenchOutput, right: ScenarioWorkbenchOutput): ComparisonWorkbenchOutput {
  const rightMasks = new Set(right.changedMasks);
  const sharedMasks = new Set<MutationMask64>();

  for (const mask of left.changedMasks) {
    if (rightMasks.has(mask)) {
      sharedMasks.add(mask);
    }
  }

  return {
    left: left.id,
    right: right.id,
    sameNetMutationMask: left.netMutationMask === right.netMutationMask,
    cumulativeDistanceDelta: Math.abs(left.cumulativeDistance - right.cumulativeDistance),
    sharedChangedMaskCount: sharedMasks.size
  };
}

export function runTransitionWorkbench(dataset: TransitionWorkbenchDataset): TransitionWorkbenchOutput {
  const scenarios = dataset.scenarios.map(analyzeScenario);
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  const comparisons = dataset.comparePairs.map((pair, pairIndex) => {
    const left = scenariosById.get(pair.left);
    const right = scenariosById.get(pair.right);

    if (left === undefined) {
      throw new Error(`comparePairs[${pairIndex}].left references unknown scenario id: ${pair.left}.`);
    }
    if (right === undefined) {
      throw new Error(`comparePairs[${pairIndex}].right references unknown scenario id: ${pair.right}.`);
    }

    return compareScenarios(left, right);
  });

  return {
    scenarios,
    aggregate: buildAggregate(scenarios),
    comparisons
  };
}

function usage(): string {
  return "Usage: transition-workbench <dataset.json>";
}

export function runTransitionWorkbenchCli(args: readonly string[]): void {
  const [filePath] = args;
  if (filePath === undefined) {
    console.error(usage());
    process.exit(2);
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    const dataset = parseTransitionWorkbenchDataset(parsed);
    const output = runTransitionWorkbench(dataset);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const entryPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);

if (entryPath === modulePath) {
  runTransitionWorkbenchCli(process.argv.slice(2));
}
