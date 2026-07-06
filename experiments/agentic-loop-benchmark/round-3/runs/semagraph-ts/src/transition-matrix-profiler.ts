#!/usr/bin/env node
import { readFileSync } from "node:fs";

type RawTransition = {
  id: unknown;
  sourceStateId: unknown;
  targetStateId: unknown;
  groupId: unknown;
};

type RawGroup = {
  id: unknown;
  transitionIds: unknown;
};

type RawComparePair = {
  left: unknown;
  right: unknown;
};

type Dataset = {
  transitions: RawTransition[];
  groups: RawGroup[];
  comparePairs: RawComparePair[];
};

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

type ModuleScope = "none" | "lower_only" | "upper_only" | "both_modules";

type RegimeClass =
  | "no_change"
  | "bit_adjustment"
  | "module_reconfiguration"
  | "full_bit_reversal"
  | "near_total_inversion"
  | "cross_module_regime_shift";

type TransitionProfile = TransitionInput & {
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

type GroupProfile = {
  id: string;
  transitionCount: number;
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
  maxDistanceTransitionIds: string[];
  regimeHistogram: Record<string, number>;
  moduleScopeHistogram: Record<string, number>;
};

type AggregateProfile = Omit<GroupProfile, "id"> & {
  mutationMaskHistogram: Record<string, number>;
};

type PairwiseComparison = ComparePairInput & {
  sameMutationMask: boolean;
  sameRegimeClass: boolean;
  sameModuleScope: boolean;
  distanceDelta: number;
  sharedChangedPositionCount: number;
};

const STATE64_PATTERN = /^S64-[01]{6}$/;

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a unique non-empty string.`);
  }
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array of transition ids.`);
  }
  return value.map((item, index) => asString(item, `${label}[${index}]`));
}

function assertState64(value: string, label: string): void {
  if (!STATE64_PATTERN.test(value)) {
    throw new Error(`${label} must match S64-[01]{6}; received ${value}.`);
  }
}

function uniqueInsert(seen: Set<string>, id: string, label: string): void {
  if (seen.has(id)) {
    throw new Error(`${label} id must be unique; duplicate ${id}.`);
  }
  seen.add(id);
}

function validateDataset(raw: unknown): {
  transitions: TransitionInput[];
  groups: GroupInput[];
  comparePairs: ComparePairInput[];
} {
  const root = asObject(raw, "dataset");
  if (!Array.isArray(root.transitions)) {
    throw new Error("dataset.transitions must be an array.");
  }
  if (!Array.isArray(root.groups)) {
    throw new Error("dataset.groups must be an array.");
  }
  if (!Array.isArray(root.comparePairs)) {
    throw new Error("dataset.comparePairs must be an array.");
  }

  const transitionIds = new Set<string>();
  const groupIds = new Set<string>();

  const transitions = (root.transitions as RawTransition[]).map((rawTransition, index) => {
    const item = asObject(rawTransition, `transitions[${index}]`);
    const id = asString(item.id, `transitions[${index}].id`);
    const sourceStateId = asString(item.sourceStateId, `transitions[${index}].sourceStateId`);
    const targetStateId = asString(item.targetStateId, `transitions[${index}].targetStateId`);
    const groupId = asString(item.groupId, `transitions[${index}].groupId`);
    uniqueInsert(transitionIds, id, "transition");
    assertState64(sourceStateId, `transitions[${index}].sourceStateId`);
    assertState64(targetStateId, `transitions[${index}].targetStateId`);
    return { id, sourceStateId, targetStateId, groupId };
  });

  const groups = (root.groups as RawGroup[]).map((rawGroup, index) => {
    const item = asObject(rawGroup, `groups[${index}]`);
    const id = asString(item.id, `groups[${index}].id`);
    const transitionIdsForGroup = asStringArray(item.transitionIds, `groups[${index}].transitionIds`);
    uniqueInsert(groupIds, id, "group");
    return { id, transitionIds: transitionIdsForGroup };
  });

  for (const transition of transitions) {
    if (!groupIds.has(transition.groupId)) {
      throw new Error(`transition ${transition.id} references unknown group ${transition.groupId}.`);
    }
  }

  for (const group of groups) {
    for (const transitionId of group.transitionIds) {
      if (!transitionIds.has(transitionId)) {
        throw new Error(`group ${group.id} references unknown transition ${transitionId}.`);
      }
    }
  }

  const comparePairs = (root.comparePairs as RawComparePair[]).map((rawPair, index) => {
    const item = asObject(rawPair, `comparePairs[${index}]`);
    const left = asString(item.left, `comparePairs[${index}].left`);
    const right = asString(item.right, `comparePairs[${index}].right`);
    if (!transitionIds.has(left)) {
      throw new Error(`comparePairs[${index}].left references unknown transition ${left}.`);
    }
    if (!transitionIds.has(right)) {
      throw new Error(`comparePairs[${index}].right references unknown transition ${right}.`);
    }
    return { left, right };
  });

  return { transitions, groups, comparePairs };
}

function stateBits(stateId: string): string {
  return stateId.slice("S64-".length);
}

function stateNumber(stateId: string): number {
  return Number.parseInt(stateBits(stateId), 2);
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function moduleScopeFor(lowerDistance: number, upperDistance: number): ModuleScope {
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

function regimeClassFor(distance: number, moduleScope: ModuleScope): RegimeClass {
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

function summarizeTransition(profile: Omit<TransitionProfile, "summary">): string {
  return `${profile.id}: ${profile.sourceStateId} to ${profile.targetStateId} changes ${profile.distance} bit(s) with ${profile.mutationMask}, classified as ${profile.regimeClass} in ${profile.moduleScope}.`;
}

function profileTransition(transition: TransitionInput): TransitionProfile {
  const source = stateBits(transition.sourceStateId);
  const target = stateBits(transition.targetStateId);
  const maskBits = [...source].map((bit, index) => (bit === target[index] ? "0" : "1")).join("");
  const changedPositions = [...maskBits]
    .map((bit, index) => (bit === "1" ? index + 1 : 0))
    .filter((position) => position !== 0);
  const lowerDistance = changedPositions.filter((position) => position <= 3).length;
  const upperDistance = changedPositions.filter((position) => position >= 4).length;
  const distance = changedPositions.length;
  const moduleScope = moduleScopeFor(lowerDistance, upperDistance);
  const regimeClass = regimeClassFor(distance, moduleScope);
  const transitionIndex = stateNumber(transition.sourceStateId) * 64 + stateNumber(transition.targetStateId);
  const partial = {
    ...transition,
    mutationMask: `M64-${maskBits}`,
    changedPositions,
    distance,
    lowerDistance,
    upperDistance,
    moduleScope,
    regimeClass,
    transitionIndex
  };
  return { ...partial, summary: summarizeTransition(partial) };
}

function increment(histogram: Record<string, number>, key: string): void {
  histogram[key] = (histogram[key] ?? 0) + 1;
}

function sortHistogram(histogram: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(histogram).sort(([left], [right]) => left.localeCompare(right)));
}

function summarizeProfiles(id: string, profiles: TransitionProfile[]): GroupProfile {
  const totalDistance = profiles.reduce((sum, profile) => sum + profile.distance, 0);
  const maxDistance = profiles.reduce((max, profile) => Math.max(max, profile.distance), 0);
  const regimeHistogram: Record<string, number> = {};
  const moduleScopeHistogram: Record<string, number> = {};

  for (const profile of profiles) {
    increment(regimeHistogram, profile.regimeClass);
    increment(moduleScopeHistogram, profile.moduleScope);
  }

  return {
    id,
    transitionCount: profiles.length,
    totalDistance,
    averageDistance: profiles.length === 0 ? 0 : round3(totalDistance / profiles.length),
    maxDistance,
    maxDistanceTransitionIds: profiles.filter((profile) => profile.distance === maxDistance).map((profile) => profile.id),
    regimeHistogram: sortHistogram(regimeHistogram),
    moduleScopeHistogram: sortHistogram(moduleScopeHistogram)
  };
}

function buildAggregate(profiles: TransitionProfile[]): AggregateProfile {
  const base = summarizeProfiles("aggregate", profiles);
  const mutationMaskHistogram: Record<string, number> = {};
  for (const profile of profiles) {
    increment(mutationMaskHistogram, profile.mutationMask);
  }
  const { id: _id, ...aggregate } = base;
  return {
    ...aggregate,
    mutationMaskHistogram: sortHistogram(mutationMaskHistogram)
  };
}

function compareTransitions(pair: ComparePairInput, byId: Map<string, TransitionProfile>): PairwiseComparison {
  const left = byId.get(pair.left);
  const right = byId.get(pair.right);
  if (!left || !right) {
    throw new Error(`comparison references missing transition ${pair.left} or ${pair.right}.`);
  }
  const rightPositions = new Set(right.changedPositions);
  const sharedChangedPositionCount = left.changedPositions.filter((position) => rightPositions.has(position)).length;
  return {
    ...pair,
    sameMutationMask: left.mutationMask === right.mutationMask,
    sameRegimeClass: left.regimeClass === right.regimeClass,
    sameModuleScope: left.moduleScope === right.moduleScope,
    distanceDelta: left.distance - right.distance,
    sharedChangedPositionCount
  };
}

export function profileDataset(raw: unknown): {
  generatedBy: string;
  semagraphRuntime: "ts";
  transitions: TransitionProfile[];
  groups: GroupProfile[];
  aggregate: AggregateProfile;
  comparisons: PairwiseComparison[];
} {
  const dataset = validateDataset(raw as Dataset);
  const transitions = dataset.transitions.map(profileTransition);
  const byId = new Map(transitions.map((transition) => [transition.id, transition]));
  const groups = dataset.groups.map((group) => {
    const profiles = group.transitionIds.map((transitionId) => {
      const profile = byId.get(transitionId);
      if (!profile) {
        throw new Error(`group ${group.id} references missing transition ${transitionId}.`);
      }
      return profile;
    });
    return summarizeProfiles(group.id, profiles);
  });

  return {
    generatedBy: "transition-matrix-profiler",
    semagraphRuntime: "ts",
    transitions,
    groups,
    aggregate: buildAggregate(transitions),
    comparisons: dataset.comparePairs.map((pair) => compareTransitions(pair, byId))
  };
}

function main(): void {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: transition-matrix-profiler <transitions.json>");
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
  const output = profileDataset(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  if (process.argv[1] && process.argv[1].endsWith("transition-matrix-profiler.js")) {
    main();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ status: "error", error: message }, null, 2)}\n`);
  process.exit(1);
}
