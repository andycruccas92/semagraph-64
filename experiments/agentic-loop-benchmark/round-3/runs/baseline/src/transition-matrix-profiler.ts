declare const require: any;
declare const process: any;
declare const module: any;

const fs = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const STATE_ID_RE = /^S64-[01]{6}$/;

type JsonRecord = Record<string, unknown>;

type InputTransition = {
  id: string;
  sourceStateId: string;
  targetStateId: string;
  groupId: string;
};

type InputGroup = {
  id: string;
  transitionIds: string[];
};

type InputComparePair = {
  left: string;
  right: string;
};

type InputDataset = {
  transitions: InputTransition[];
  groups: InputGroup[];
  comparePairs: InputComparePair[];
};

type ModuleScope = "none" | "lower_only" | "upper_only" | "both_modules";
type RegimeClass =
  | "no_change"
  | "bit_adjustment"
  | "module_reconfiguration"
  | "full_bit_reversal"
  | "near_total_inversion"
  | "cross_module_regime_shift";

type ProfiledTransition = InputTransition & {
  mutationMask: string;
  changedPositions: number[];
  distance: number;
  lowerDistance: number;
  upperDistance: number;
  moduleScope: ModuleScope;
  regimeClass: RegimeClass;
  transitionIndex: number;
  summary: string;
};

type Histogram = Record<string, number>;

type GroupOutput = {
  id: string;
  transitionCount: number;
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
  maxDistanceTransitionIds: string[];
  regimeHistogram: Histogram;
  moduleScopeHistogram: Histogram;
};

type AggregateOutput = {
  transitionCount: number;
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
  maxDistanceTransitionIds: string[];
  regimeHistogram: Histogram;
  moduleScopeHistogram: Histogram;
  mutationMaskHistogram: Histogram;
};

type PairwiseComparison = {
  left: string;
  right: string;
  sameMutationMask: boolean;
  sameRegimeClass: boolean;
  sameModuleScope: boolean;
  distanceDelta: number;
  sharedChangedPositionCount: number;
};

type ProfilerOutput = {
  transitions: ProfiledTransition[];
  groups: GroupOutput[];
  aggregate: AggregateOutput;
  comparisons: PairwiseComparison[];
};

export function profileDataset(dataset: unknown): ProfilerOutput {
  const parsed = parseInputDataset(dataset);
  const transitionIds = new Set<string>();
  const groupIds = new Set<string>();

  for (const transition of parsed.transitions) {
    assertNonEmptyUnique(transition.id, transitionIds, "transition id");
    assertStateId(transition.sourceStateId, `transition ${transition.id} sourceStateId`);
    assertStateId(transition.targetStateId, `transition ${transition.id} targetStateId`);
  }

  for (const group of parsed.groups) {
    assertNonEmptyUnique(group.id, groupIds, "group id");
  }

  for (const transition of parsed.transitions) {
    if (!groupIds.has(transition.groupId)) {
      throw new Error(`transition ${transition.id} references unknown groupId ${JSON.stringify(transition.groupId)}`);
    }
  }

  for (const group of parsed.groups) {
    for (const transitionId of group.transitionIds) {
      if (!transitionIds.has(transitionId)) {
        throw new Error(`group ${group.id} references unknown transition id ${JSON.stringify(transitionId)}`);
      }
    }
  }

  for (const pair of parsed.comparePairs) {
    if (!transitionIds.has(pair.left)) {
      throw new Error(`comparePairs left references unknown transition id ${JSON.stringify(pair.left)}`);
    }
    if (!transitionIds.has(pair.right)) {
      throw new Error(`comparePairs right references unknown transition id ${JSON.stringify(pair.right)}`);
    }
  }

  const transitions = parsed.transitions.map(profileTransition);
  const transitionsById = new Map(transitions.map((transition) => [transition.id, transition]));

  const groups = parsed.groups.map((group) => {
    const members = group.transitionIds.map((id) => mustGetTransition(transitionsById, id));
    return summarizeGroup(group.id, members);
  });

  return {
    transitions,
    groups,
    aggregate: summarizeAggregate(transitions),
    comparisons: parsed.comparePairs.map((pair) => comparePair(pair, transitionsById))
  };
}

function profileTransition(transition: InputTransition): ProfiledTransition {
  const sourceBits = bitsOfState(transition.sourceStateId);
  const targetBits = bitsOfState(transition.targetStateId);
  const maskBits: string[] = [];
  const changedPositions: number[] = [];

  for (let index = 0; index < 6; index += 1) {
    const changed = sourceBits[index] === targetBits[index] ? "0" : "1";
    maskBits.push(changed);
    if (changed === "1") {
      changedPositions.push(index + 1);
    }
  }

  const mutationMask = `M64-${maskBits.join("")}`;
  const lowerDistance = changedPositions.filter((position) => position >= 1 && position <= 3).length;
  const upperDistance = changedPositions.filter((position) => position >= 4 && position <= 6).length;
  const distance = changedPositions.length;
  const moduleScope = classifyModuleScope(lowerDistance, upperDistance);
  const regimeClass = classifyRegime(distance, moduleScope);
  const transitionIndex = stateNumber(transition.sourceStateId) * 64 + stateNumber(transition.targetStateId);

  return {
    ...transition,
    mutationMask,
    changedPositions,
    distance,
    lowerDistance,
    upperDistance,
    moduleScope,
    regimeClass,
    transitionIndex,
    summary: summarizeTransition(transition.id, mutationMask, changedPositions, distance, moduleScope, regimeClass)
  };
}

function summarizeGroup(id: string, transitions: ProfiledTransition[]): GroupOutput {
  const common = summarizeTransitions(transitions);
  return {
    id,
    transitionCount: transitions.length,
    totalDistance: common.totalDistance,
    averageDistance: common.averageDistance,
    maxDistance: common.maxDistance,
    maxDistanceTransitionIds: common.maxDistanceTransitionIds,
    regimeHistogram: histogram(transitions, (transition) => transition.regimeClass),
    moduleScopeHistogram: histogram(transitions, (transition) => transition.moduleScope)
  };
}

function summarizeAggregate(transitions: ProfiledTransition[]): AggregateOutput {
  const common = summarizeTransitions(transitions);
  return {
    transitionCount: transitions.length,
    totalDistance: common.totalDistance,
    averageDistance: common.averageDistance,
    maxDistance: common.maxDistance,
    maxDistanceTransitionIds: common.maxDistanceTransitionIds,
    regimeHistogram: histogram(transitions, (transition) => transition.regimeClass),
    moduleScopeHistogram: histogram(transitions, (transition) => transition.moduleScope),
    mutationMaskHistogram: histogram(transitions, (transition) => transition.mutationMask)
  };
}

function comparePair(pair: InputComparePair, transitionsById: Map<string, ProfiledTransition>): PairwiseComparison {
  const left = mustGetTransition(transitionsById, pair.left);
  const right = mustGetTransition(transitionsById, pair.right);
  const rightPositions = new Set(right.changedPositions);
  const sharedChangedPositionCount = left.changedPositions.filter((position) => rightPositions.has(position)).length;

  return {
    left: pair.left,
    right: pair.right,
    sameMutationMask: left.mutationMask === right.mutationMask,
    sameRegimeClass: left.regimeClass === right.regimeClass,
    sameModuleScope: left.moduleScope === right.moduleScope,
    distanceDelta: left.distance - right.distance,
    sharedChangedPositionCount
  };
}

function summarizeTransitions(transitions: ProfiledTransition[]): {
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
  maxDistanceTransitionIds: string[];
} {
  const totalDistance = transitions.reduce((total, transition) => total + transition.distance, 0);
  const maxDistance = transitions.reduce((max, transition) => Math.max(max, transition.distance), 0);
  const maxDistanceTransitionIds = transitions
    .filter((transition) => transition.distance === maxDistance)
    .map((transition) => transition.id);

  return {
    totalDistance,
    averageDistance: roundThree(transitions.length === 0 ? 0 : totalDistance / transitions.length),
    maxDistance,
    maxDistanceTransitionIds
  };
}

function classifyModuleScope(lowerDistance: number, upperDistance: number): ModuleScope {
  if (lowerDistance === 0 && upperDistance === 0) {
    return "none";
  }
  if (lowerDistance !== 0 && upperDistance === 0) {
    return "lower_only";
  }
  if (lowerDistance === 0 && upperDistance !== 0) {
    return "upper_only";
  }
  return "both_modules";
}

function classifyRegime(distance: number, moduleScope: ModuleScope): RegimeClass {
  if (distance === 0) {
    return "no_change";
  }
  if (distance === 1) {
    return "bit_adjustment";
  }
  if (distance <= 2 && moduleScope !== "both_modules") {
    return "module_reconfiguration";
  }
  if (distance === 6) {
    return "full_bit_reversal";
  }
  if (distance >= 4) {
    return "near_total_inversion";
  }
  return "cross_module_regime_shift";
}

function summarizeTransition(
  id: string,
  mutationMask: string,
  changedPositions: number[],
  distance: number,
  moduleScope: ModuleScope,
  regimeClass: RegimeClass
): string {
  const positions = changedPositions.length === 0 ? "none" : changedPositions.join(",");
  return `${id} has mask ${mutationMask}, distance ${distance}, changed positions ${positions}, scope ${moduleScope}, regime ${regimeClass}.`;
}

function histogram<T>(items: T[], keyOf: (item: T) => string): Histogram {
  const counts: Histogram = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function roundThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function bitsOfState(stateId: string): string {
  return stateId.slice("S64-".length);
}

function stateNumber(stateId: string): number {
  return Number.parseInt(bitsOfState(stateId), 2);
}

function mustGetTransition(
  transitionsById: Map<string, ProfiledTransition>,
  id: string
): ProfiledTransition {
  const transition = transitionsById.get(id);
  if (transition === undefined) {
    throw new Error(`unknown transition id ${JSON.stringify(id)}`);
  }
  return transition;
}

function parseInputDataset(value: unknown): InputDataset {
  const record = assertRecord(value, "dataset");
  const transitions = assertArray(record.transitions, "transitions").map((item, index) =>
    parseTransition(item, `transitions[${index}]`)
  );
  const groups = assertArray(record.groups, "groups").map((item, index) => parseGroup(item, `groups[${index}]`));
  const comparePairs = assertArray(record.comparePairs, "comparePairs").map((item, index) =>
    parseComparePair(item, `comparePairs[${index}]`)
  );

  return { transitions, groups, comparePairs };
}

function parseTransition(value: unknown, label: string): InputTransition {
  const record = assertRecord(value, label);
  return {
    id: assertString(record.id, `${label}.id`),
    sourceStateId: assertString(record.sourceStateId, `${label}.sourceStateId`),
    targetStateId: assertString(record.targetStateId, `${label}.targetStateId`),
    groupId: assertString(record.groupId, `${label}.groupId`)
  };
}

function parseGroup(value: unknown, label: string): InputGroup {
  const record = assertRecord(value, label);
  return {
    id: assertString(record.id, `${label}.id`),
    transitionIds: assertArray(record.transitionIds, `${label}.transitionIds`).map((item, index) =>
      assertString(item, `${label}.transitionIds[${index}]`)
    )
  };
}

function parseComparePair(value: unknown, label: string): InputComparePair {
  const record = assertRecord(value, label);
  return {
    left: assertString(record.left, `${label}.left`),
    right: assertString(record.right, `${label}.right`)
  };
}

function assertRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function assertArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function assertNonEmptyUnique(value: string, seen: Set<string>, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (seen.has(value)) {
    throw new Error(`${label} must be unique: ${JSON.stringify(value)}`);
  }
  seen.add(value);
}

function assertStateId(value: string, label: string): void {
  if (!STATE_ID_RE.test(value)) {
    throw new Error(`${label} must match S64-[01]{6}: ${JSON.stringify(value)}`);
  }
}

function main(): void {
  const inputPath = process.argv[2];
  if (typeof inputPath !== "string" || inputPath.length === 0) {
    process.stderr.write("Usage: transition-matrix-profiler <dataset.json>\n");
    process.exitCode = 2;
    return;
  }

  try {
    const inputText = fs.readFileSync(inputPath, "utf8");
    const dataset = JSON.parse(inputText) as unknown;
    const output = profileDataset(dataset);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`transition-matrix-profiler: ${message}\n`);
    process.exitCode = 1;
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
