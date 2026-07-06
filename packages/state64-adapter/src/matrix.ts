import type { MutationMask64, State64Id } from "./types.js";
import { STATE64_CATALOG } from "./catalog.js";
import { hammingDistance64, mutationMaskBetween64, positionsFromMutationMask64 } from "./hypercube.js";
import { classifyState64RegimePair, type State64ModuleScope, type State64RegimeClass } from "./regimes.js";
import { createBinaryState64 } from "./hypercube.js";

export type State64TransitionMatrixEntry = {
  sourceStateId: State64Id;
  targetStateId: State64Id;
  mutationMask: MutationMask64;
  changedPositions: readonly number[];
  distance: number;
  lowerDistance: number;
  upperDistance: number;
  moduleScope: State64ModuleScope;
  regimeClass: State64RegimeClass;
};

export function lookupState64Transition(sourceStateId: State64Id, targetStateId: State64Id): State64TransitionMatrixEntry {
  const source = createBinaryState64(sourceStateId.slice(4));
  const target = createBinaryState64(targetStateId.slice(4));
  const mutationMask = mutationMaskBetween64(source, target);
  const classification = classifyState64RegimePair(source, target);
  return {
    sourceStateId,
    targetStateId,
    mutationMask,
    changedPositions: positionsFromMutationMask64(mutationMask),
    distance: hammingDistance64(source, target),
    lowerDistance: classification.lowerDistance,
    upperDistance: classification.upperDistance,
    moduleScope: classification.moduleScope,
    regimeClass: classification.regimeClass
  };
}

export function createState64TransitionMatrix(): readonly State64TransitionMatrixEntry[] {
  return STATE64_CATALOG.flatMap((source) =>
    STATE64_CATALOG.map((target) => lookupState64Transition(source.id, target.id))
  );
}
