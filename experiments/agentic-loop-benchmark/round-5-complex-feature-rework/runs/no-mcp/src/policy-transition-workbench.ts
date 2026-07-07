import { readFileSync } from "node:fs";

const STATE_ID_PATTERN = /^S64-[01]{6}$/;
const ZERO_MASK = "M64-000000";

type StateId = `S64-${string}`;
type MutationMask = `M64-${string}`;
type RegimeClass =
  | "no_change"
  | "bit_adjustment"
  | "cross_module_regime_shift"
  | "full_bit_reversal";
type VolatilityClass = "calm" | "active" | "volatile";
type PolicyReadiness = "hold" | "review" | "escalate";
type PolicyPriority = "low" | "normal" | "high";

interface InputScenario {
  id: string;
  states: StateId[];
  objective: string;
}

interface ComparePair {
  left: string;
  right: string;
}

interface WorkbenchInput {
  scenarios: InputScenario[];
  comparePairs: ComparePair[];
}

interface ScenarioOutput {
  id: string;
  sourceStateId: StateId;
  targetStateId: StateId;
  states: StateId[];
  transitionCount: number;
  orderedMutationMasks: MutationMask[];
  netMutationMask: MutationMask;
  cumulativeDistance: number;
  netDistance: number;
  dominantRegimeClass: RegimeClass;
  volatilityClass: VolatilityClass;
  policyReadiness: PolicyReadiness;
  signature: string;
  summary: string;
}

interface AggregateOutput {
  scenarioCount: number;
  totalTransitions: number;
  totalCumulativeDistance: number;
  averageCumulativeDistance: number;
  maxCumulativeDistanceScenarioIds: string[];
  volatilityHistogram: Record<string, number>;
  dominantRegimeHistogram: Record<string, number>;
  netMutationHistogram: Record<string, number>;
}

interface ComparisonOutput {
  left: string;
  right: string;
  sameNetMutationMask: boolean;
  sameDominantRegimeClass: boolean;
  sameVolatilityClass: boolean;
  cumulativeDistanceDelta: number;
  sharedOrderedMutationMaskCount: number;
  sharedStateCount: number;
}

interface PolicyQueueItem {
  scenarioId: string;
  triggerSignature: string;
  objective: string;
  priority: PolicyPriority;
  allowedActions: string[];
  forbiddenActions: string[];
  reviewRequired: boolean;
}

interface WorkbenchOutput {
  scenarios: ScenarioOutput[];
  aggregate: AggregateOutput;
  comparisons: ComparisonOutput[];
  policyQueue: PolicyQueueItem[];
}

function fail(message: string): never {
  throw new Error(message);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function parseInput(value: unknown): WorkbenchInput {
  const root = assertRecord(value, "input");
  if (!Array.isArray(root.scenarios)) {
    fail("input.scenarios must be an array");
  }
  if (!Array.isArray(root.comparePairs)) {
    fail("input.comparePairs must be an array");
  }

  const scenarioIds = new Set<string>();
  const scenarios = root.scenarios.map((entry, index): InputScenario => {
    const scenario = assertRecord(entry, `input.scenarios[${index}]`);
    if (typeof scenario.id !== "string" || scenario.id.length === 0) {
      fail(`input.scenarios[${index}].id must be a non-empty string`);
    }
    if (scenarioIds.has(scenario.id)) {
      fail(`duplicate scenario id: ${scenario.id}`);
    }
    scenarioIds.add(scenario.id);
    if (!Array.isArray(scenario.states) || scenario.states.length < 2) {
      fail(`input.scenarios[${index}].states must contain at least two states`);
    }
    const states = scenario.states.map((state, stateIndex): StateId => {
      if (typeof state !== "string" || !STATE_ID_PATTERN.test(state)) {
        fail(
          `input.scenarios[${index}].states[${stateIndex}] must match S64-[01]{6}`,
        );
      }
      return state as StateId;
    });
    if (typeof scenario.objective !== "string") {
      fail(`input.scenarios[${index}].objective must be a string`);
    }
    return {
      id: scenario.id,
      states,
      objective: scenario.objective,
    };
  });

  const comparePairs = root.comparePairs.map((entry, index): ComparePair => {
    const pair = assertRecord(entry, `input.comparePairs[${index}]`);
    if (typeof pair.left !== "string" || typeof pair.right !== "string") {
      fail(`input.comparePairs[${index}] must include string left and right ids`);
    }
    return {
      left: pair.left,
      right: pair.right,
    };
  });

  return { scenarios, comparePairs };
}

function stateBits(stateId: StateId): string {
  return stateId.slice("S64-".length);
}

function maskBits(mask: MutationMask): string {
  return mask.slice("M64-".length);
}

function hammingDistance(bits: string): number {
  return [...bits].filter((bit) => bit === "1").length;
}

function mutationMask(left: StateId, right: StateId): MutationMask {
  const leftBits = stateBits(left);
  const rightBits = stateBits(right);
  const mask = [...leftBits]
    .map((bit, index) => (bit === rightBits[index] ? "0" : "1"))
    .join("");
  return `M64-${mask}` as MutationMask;
}

function xorMasks(masks: MutationMask[]): MutationMask {
  const bits = masks.reduce(
    (current, mask) =>
      [...current]
        .map((bit, index) => (bit === maskBits(mask)[index] ? "0" : "1"))
        .join(""),
    maskBits(ZERO_MASK as MutationMask),
  );
  return `M64-${bits}` as MutationMask;
}

function regimeClassForMask(mask: MutationMask): RegimeClass {
  const distance = hammingDistance(maskBits(mask));
  if (distance === 0) {
    return "no_change";
  }
  if (distance === 1) {
    return "bit_adjustment";
  }
  if (distance === 6) {
    return "full_bit_reversal";
  }
  return "cross_module_regime_shift";
}

function dominantRegimeClass(masks: MutationMask[]): RegimeClass {
  const totals = new Map<RegimeClass, { count: number; distance: number }>();
  for (const mask of masks) {
    const regimeClass = regimeClassForMask(mask);
    const current = totals.get(regimeClass) ?? { count: 0, distance: 0 };
    current.count += 1;
    current.distance += hammingDistance(maskBits(mask));
    totals.set(regimeClass, current);
  }

  const ranked = [...totals.entries()].sort(
    ([leftClass, left], [rightClass, right]) =>
      right.count - left.count ||
      right.distance - left.distance ||
      leftClass.localeCompare(rightClass),
  );
  const winner = ranked[0];
  if (winner === undefined) {
    fail("cannot determine dominant regime without transitions");
  }
  return winner[0];
}

function volatilityClass(cumulativeDistance: number): VolatilityClass {
  if (cumulativeDistance <= 3) {
    return "calm";
  }
  if (cumulativeDistance <= 7) {
    return "active";
  }
  return "volatile";
}

function policyReadinessFor(volatility: VolatilityClass): PolicyReadiness {
  if (volatility === "calm") {
    return "hold";
  }
  if (volatility === "active") {
    return "review";
  }
  return "escalate";
}

function priorityFor(volatility: VolatilityClass): PolicyPriority {
  if (volatility === "calm") {
    return "low";
  }
  if (volatility === "active") {
    return "normal";
  }
  return "high";
}

function summarizeScenario(scenario: ScenarioOutput): string {
  return `${scenario.id}: ${scenario.sourceStateId} to ${scenario.targetStateId}; ${scenario.volatilityClass}; cumulative distance ${scenario.cumulativeDistance}.`;
}

function analyzeScenario(scenario: InputScenario): ScenarioOutput {
  const sourceStateId = scenario.states[0];
  const targetStateId = scenario.states[scenario.states.length - 1];
  if (sourceStateId === undefined || targetStateId === undefined) {
    fail(`${scenario.id} must contain source and target states`);
  }

  const orderedMutationMasks: MutationMask[] = [];
  for (let index = 0; index < scenario.states.length - 1; index += 1) {
    const left = scenario.states[index];
    const right = scenario.states[index + 1];
    if (left === undefined || right === undefined) {
      fail(`${scenario.id} has an incomplete transition at index ${index}`);
    }
    orderedMutationMasks.push(mutationMask(left, right));
  }

  const cumulativeDistance = orderedMutationMasks.reduce(
    (total, mask) => total + hammingDistance(maskBits(mask)),
    0,
  );
  const netMutationMask = xorMasks(orderedMutationMasks);
  const netDistance = hammingDistance(maskBits(netMutationMask));
  const volatility = volatilityClass(cumulativeDistance);
  const output: ScenarioOutput = {
    id: scenario.id,
    sourceStateId,
    targetStateId,
    states: [...scenario.states],
    transitionCount: orderedMutationMasks.length,
    orderedMutationMasks,
    netMutationMask,
    cumulativeDistance,
    netDistance,
    dominantRegimeClass: dominantRegimeClass(orderedMutationMasks),
    volatilityClass: volatility,
    policyReadiness: policyReadinessFor(volatility),
    signature: `C64:${sourceStateId}>${targetStateId}|M:${orderedMutationMasks.join(".")}|N:${netMutationMask}`,
    summary: "",
  };
  output.summary = summarizeScenario(output);
  return output;
}

function incrementHistogram(histogram: Record<string, number>, key: string): void {
  histogram[key] = (histogram[key] ?? 0) + 1;
}

function buildAggregate(scenarios: ScenarioOutput[]): AggregateOutput {
  const totalTransitions = scenarios.reduce(
    (total, scenario) => total + scenario.transitionCount,
    0,
  );
  const totalCumulativeDistance = scenarios.reduce(
    (total, scenario) => total + scenario.cumulativeDistance,
    0,
  );
  const maxCumulativeDistance = Math.max(
    ...scenarios.map((scenario) => scenario.cumulativeDistance),
  );
  const volatilityHistogram: Record<string, number> = {};
  const dominantRegimeHistogram: Record<string, number> = {};
  const netMutationHistogram: Record<string, number> = {};

  for (const scenario of scenarios) {
    incrementHistogram(volatilityHistogram, scenario.volatilityClass);
    incrementHistogram(dominantRegimeHistogram, scenario.dominantRegimeClass);
    incrementHistogram(netMutationHistogram, scenario.netMutationMask);
  }

  return {
    scenarioCount: scenarios.length,
    totalTransitions,
    totalCumulativeDistance,
    averageCumulativeDistance:
      scenarios.length === 0 ? 0 : totalCumulativeDistance / scenarios.length,
    maxCumulativeDistanceScenarioIds: scenarios
      .filter((scenario) => scenario.cumulativeDistance === maxCumulativeDistance)
      .map((scenario) => scenario.id),
    volatilityHistogram,
    dominantRegimeHistogram,
    netMutationHistogram,
  };
}

function occurrencePairCount(leftValues: string[], rightValues: string[]): number {
  let count = 0;
  for (const leftValue of leftValues) {
    for (const rightValue of rightValues) {
      if (leftValue === rightValue) {
        count += 1;
      }
    }
  }
  return count;
}

function buildComparisons(
  pairs: ComparePair[],
  scenarioById: Map<string, ScenarioOutput>,
): ComparisonOutput[] {
  return pairs.map((pair, index): ComparisonOutput => {
    const left = scenarioById.get(pair.left);
    const right = scenarioById.get(pair.right);
    if (left === undefined) {
      fail(`input.comparePairs[${index}].left references unknown scenario ${pair.left}`);
    }
    if (right === undefined) {
      fail(`input.comparePairs[${index}].right references unknown scenario ${pair.right}`);
    }
    return {
      left: pair.left,
      right: pair.right,
      sameNetMutationMask: left.netMutationMask === right.netMutationMask,
      sameDominantRegimeClass:
        left.dominantRegimeClass === right.dominantRegimeClass,
      sameVolatilityClass: left.volatilityClass === right.volatilityClass,
      cumulativeDistanceDelta: Math.abs(
        left.cumulativeDistance - right.cumulativeDistance,
      ),
      sharedOrderedMutationMaskCount: occurrencePairCount(
        left.orderedMutationMasks,
        right.orderedMutationMasks,
      ),
      sharedStateCount: occurrencePairCount(left.states, right.states),
    };
  });
}

function buildPolicyQueue(
  scenarios: ScenarioOutput[],
  sourceScenarios: InputScenario[],
): PolicyQueueItem[] {
  const objectiveById = new Map(
    sourceScenarios.map((scenario) => [scenario.id, scenario.objective]),
  );
  return scenarios
    .filter((scenario) => scenario.id !== "calm-zero")
    .map((scenario): PolicyQueueItem => ({
      scenarioId: scenario.id,
      triggerSignature: scenario.signature,
      objective: objectiveById.get(scenario.id) ?? "",
      priority: priorityFor(scenario.volatilityClass),
      allowedActions: ["monitor", "review", "escalate"],
      forbiddenActions: [
        "do not infer observations",
        "do not mutate State64 ids",
        "do not override deterministic signatures",
      ],
      reviewRequired: true,
    }));
}

function buildWorkbench(input: WorkbenchInput): WorkbenchOutput {
  const scenarios = input.scenarios.map(analyzeScenario);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  return {
    scenarios,
    aggregate: buildAggregate(scenarios),
    comparisons: buildComparisons(input.comparePairs, scenarioById),
    policyQueue: buildPolicyQueue(scenarios, input.scenarios),
  };
}

function main(argv: string[]): void {
  const inputPath = argv[2];
  if (inputPath === undefined) {
    fail("usage: node dist/policy-transition-workbench.js <input.json>");
  }
  const input = parseInput(JSON.parse(readFileSync(inputPath, "utf8")));
  const output = buildWorkbench(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  main(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`policy-transition-workbench: ${message}\n`);
  process.exitCode = 1;
}
