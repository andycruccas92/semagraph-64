#!/usr/bin/env node

import { readFileSync } from "node:fs";

type TransitionInput = {
  id: string;
  sourceStateId: string;
  targetStateId: string;
  groupId: string;
};

type GroupInput = {
  id: string;
  transitionIds: string[];
};

type ComparePairInput = {
  left: string;
  right: string;
};

type DatasetInput = {
  transitions: TransitionInput[];
  groups: GroupInput[];
  comparePairs: ComparePairInput[];
};

type ModuleScope = "none" | "lower_only" | "upper_only" | "both_modules";

type RegimeClass =
  | "no_change"
  | "bit_adjustment"
  | "module_reconfiguration"
  | "full_bit_reversal"
  | "near_total_inversion"
  | "cross_module_regime_shift";

type ProfiledTransition = TransitionInput & {
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

type AggregateOutput = Omit<GroupOutput, "id"> & {
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

const STATE_ID_PATTERN = /^S64-[01]{6}$/;
const REGIME_ORDER: RegimeClass[] = [
  "no_change",
  "bit_adjustment",
  "module_reconfiguration",
  "cross_module_regime_shift",
  "near_total_inversion",
  "full_bit_reversal",
];
const MODULE_SCOPE_ORDER: ModuleScope[] = [
  "none",
  "lower_only",
  "upper_only",
  "both_modules",
];

function main(): void {
  const inputPath = process.argv[2];
  if (!inputPath) {
    fail("Usage: transition-matrix-profiler <dataset.json>");
  }

  const dataset = readDataset(inputPath);
  const output = profileDataset(dataset);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function readDataset(inputPath: string): DatasetInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    fail(`Failed to read JSON dataset: ${errorMessage(error)}`);
  }

  return validateDataset(parsed);
}

function validateDataset(value: unknown): DatasetInput {
  if (!isRecord(value)) {
    fail("Dataset must be a JSON object.");
  }

  const transitions = value.transitions;
  const groups = value.groups;
  const comparePairs = value.comparePairs;

  if (!Array.isArray(transitions)) {
    fail("Dataset transitions must be an array.");
  }
  if (!Array.isArray(groups)) {
    fail("Dataset groups must be an array.");
  }
  if (!Array.isArray(comparePairs)) {
    fail("Dataset comparePairs must be an array.");
  }

  const transitionIds = new Set<string>();
  const groupIds = new Set<string>();
  const checkedTransitions: TransitionInput[] = transitions.map((item, index) =>
    validateTransition(item, index, transitionIds),
  );
  const checkedGroups: GroupInput[] = groups.map((item, index) =>
    validateGroup(item, index, groupIds),
  );

  for (const transition of checkedTransitions) {
    if (!groupIds.has(transition.groupId)) {
      fail(`Transition ${transition.id} references unknown group ${transition.groupId}.`);
    }
  }

  for (const group of checkedGroups) {
    for (const transitionId of group.transitionIds) {
      if (!transitionIds.has(transitionId)) {
        fail(`Group ${group.id} references unknown transition ${transitionId}.`);
      }
    }
  }

  const checkedPairs: ComparePairInput[] = comparePairs.map((item, index) =>
    validateComparePair(item, index, transitionIds),
  );

  return {
    transitions: checkedTransitions,
    groups: checkedGroups,
    comparePairs: checkedPairs,
  };
}

function validateTransition(
  value: unknown,
  index: number,
  transitionIds: Set<string>,
): TransitionInput {
  if (!isRecord(value)) {
    fail(`Transition at index ${index} must be an object.`);
  }

  const id = requireNonEmptyString(value.id, `transitions[${index}].id`);
  if (transitionIds.has(id)) {
    fail(`Duplicate transition id ${id}.`);
  }
  transitionIds.add(id);

  const sourceStateId = requireStateId(value.sourceStateId, `transitions[${index}].sourceStateId`);
  const targetStateId = requireStateId(value.targetStateId, `transitions[${index}].targetStateId`);
  const groupId = requireNonEmptyString(value.groupId, `transitions[${index}].groupId`);

  return { id, sourceStateId, targetStateId, groupId };
}

function validateGroup(value: unknown, index: number, groupIds: Set<string>): GroupInput {
  if (!isRecord(value)) {
    fail(`Group at index ${index} must be an object.`);
  }

  const id = requireNonEmptyString(value.id, `groups[${index}].id`);
  if (groupIds.has(id)) {
    fail(`Duplicate group id ${id}.`);
  }
  groupIds.add(id);

  if (!Array.isArray(value.transitionIds)) {
    fail(`groups[${index}].transitionIds must be an array.`);
  }

  const transitionIds = value.transitionIds.map((transitionId, transitionIndex) =>
    requireNonEmptyString(transitionId, `groups[${index}].transitionIds[${transitionIndex}]`),
  );

  return { id, transitionIds };
}

function validateComparePair(
  value: unknown,
  index: number,
  transitionIds: Set<string>,
): ComparePairInput {
  if (!isRecord(value)) {
    fail(`Compare pair at index ${index} must be an object.`);
  }

  const left = requireNonEmptyString(value.left, `comparePairs[${index}].left`);
  const right = requireNonEmptyString(value.right, `comparePairs[${index}].right`);

  if (!transitionIds.has(left)) {
    fail(`Compare pair ${index} references unknown left transition ${left}.`);
  }
  if (!transitionIds.has(right)) {
    fail(`Compare pair ${index} references unknown right transition ${right}.`);
  }

  return { left, right };
}

function profileDataset(dataset: DatasetInput): ProfilerOutput {
  const transitions = dataset.transitions.map(profileTransition);
  const transitionById = new Map(transitions.map((transition) => [transition.id, transition]));

  return {
    transitions,
    groups: dataset.groups.map((group) => profileGroup(group, transitionById)),
    aggregate: profileAggregate(transitions),
    comparisons: dataset.comparePairs.map((pair) => comparePair(pair, transitionById)),
  };
}

function profileTransition(transition: TransitionInput): ProfiledTransition {
  const sourceBits = stateBits(transition.sourceStateId);
  const targetBits = stateBits(transition.targetStateId);
  const maskBits = xorBits(sourceBits, targetBits);
  const changedPositions = positionsOfOnes(maskBits);
  const distance = changedPositions.length;
  const lowerDistance = countOnes(maskBits.slice(0, 3));
  const upperDistance = countOnes(maskBits.slice(3));
  const moduleScope = classifyModuleScope(lowerDistance, upperDistance);
  const regimeClass = classifyRegime(distance, moduleScope);
  const mutationMask = `M64-${maskBits}`;
  const sourceNumber = parseInt(sourceBits, 2);
  const targetNumber = parseInt(targetBits, 2);
  const transitionIndex = sourceNumber * 64 + targetNumber;

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
    summary: `${transition.id}: ${transition.sourceStateId} to ${transition.targetStateId} uses ${mutationMask} with distance ${distance}, classified as ${regimeClass} in ${moduleScope}.`,
  };
}

function profileGroup(group: GroupInput, transitionById: Map<string, ProfiledTransition>): GroupOutput {
  const transitions = group.transitionIds.map((id) => mustGetTransition(transitionById, id));
  const stats = summarizeTransitions(transitions);

  return {
    id: group.id,
    transitionCount: transitions.length,
    totalDistance: stats.totalDistance,
    averageDistance: stats.averageDistance,
    maxDistance: stats.maxDistance,
    maxDistanceTransitionIds: stats.maxDistanceTransitionIds,
    regimeHistogram: histogram(transitions.map((transition) => transition.regimeClass), REGIME_ORDER),
    moduleScopeHistogram: histogram(
      transitions.map((transition) => transition.moduleScope),
      MODULE_SCOPE_ORDER,
    ),
  };
}

function profileAggregate(transitions: ProfiledTransition[]): AggregateOutput {
  const stats = summarizeTransitions(transitions);

  return {
    transitionCount: transitions.length,
    totalDistance: stats.totalDistance,
    averageDistance: stats.averageDistance,
    maxDistance: stats.maxDistance,
    maxDistanceTransitionIds: stats.maxDistanceTransitionIds,
    regimeHistogram: histogram(transitions.map((transition) => transition.regimeClass), REGIME_ORDER),
    moduleScopeHistogram: histogram(
      transitions.map((transition) => transition.moduleScope),
      MODULE_SCOPE_ORDER,
    ),
    mutationMaskHistogram: histogram(
      transitions.map((transition) => transition.mutationMask),
      [...new Set(transitions.map((transition) => transition.mutationMask))].sort(),
    ),
  };
}

function comparePair(
  pair: ComparePairInput,
  transitionById: Map<string, ProfiledTransition>,
): PairwiseComparison {
  const left = mustGetTransition(transitionById, pair.left);
  const right = mustGetTransition(transitionById, pair.right);
  const rightPositions = new Set(right.changedPositions);
  const sharedChangedPositionCount = left.changedPositions.filter((position) =>
    rightPositions.has(position),
  ).length;

  return {
    left: pair.left,
    right: pair.right,
    sameMutationMask: left.mutationMask === right.mutationMask,
    sameRegimeClass: left.regimeClass === right.regimeClass,
    sameModuleScope: left.moduleScope === right.moduleScope,
    distanceDelta: left.distance - right.distance,
    sharedChangedPositionCount,
  };
}

function summarizeTransitions(transitions: ProfiledTransition[]): {
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
  maxDistanceTransitionIds: string[];
} {
  const totalDistance = transitions.reduce((sum, transition) => sum + transition.distance, 0);
  const maxDistance = transitions.reduce(
    (max, transition) => Math.max(max, transition.distance),
    0,
  );

  return {
    totalDistance,
    averageDistance: round3(transitions.length === 0 ? 0 : totalDistance / transitions.length),
    maxDistance,
    maxDistanceTransitionIds: transitions
      .filter((transition) => transition.distance === maxDistance)
      .map((transition) => transition.id),
  };
}

function histogram(values: string[], order: string[]): Histogram {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const output: Histogram = {};
  for (const key of order) {
    const count = counts.get(key);
    if (count !== undefined) {
      output[key] = count;
      counts.delete(key);
    }
  }

  for (const key of [...counts.keys()].sort()) {
    output[key] = counts.get(key) ?? 0;
  }

  return output;
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

function xorBits(left: string, right: string): string {
  return [...left].map((bit, index) => (bit === right[index] ? "0" : "1")).join("");
}

function positionsOfOnes(bits: string): number[] {
  const positions: number[] = [];
  for (let index = 0; index < bits.length; index += 1) {
    if (bits[index] === "1") {
      positions.push(index + 1);
    }
  }
  return positions;
}

function countOnes(bits: string): number {
  return positionsOfOnes(bits).length;
}

function stateBits(stateId: string): string {
  return stateId.slice("S64-".length);
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function mustGetTransition(
  transitionById: Map<string, ProfiledTransition>,
  id: string,
): ProfiledTransition {
  const transition = transitionById.get(id);
  if (!transition) {
    fail(`Unknown transition ${id}.`);
  }
  return transition;
}

function requireStateId(value: unknown, label: string): string {
  const stateId = requireNonEmptyString(value, label);
  if (!STATE_ID_PATTERN.test(stateId)) {
    fail(`${label} must match S64-[01]{6}.`);
  }
  return stateId;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

main();
