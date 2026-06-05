import type { BitPosition, State64Id, State64Transition } from "./types.js";
import { applyMutationMask64, createMutationMask64 } from "./hypercube.js";

export function transformState64(sourceStateId: State64Id, changedPositions: readonly BitPosition[]): State64Transition {
  const mutationMask = createMutationMask64(changedPositions);
  const target = applyMutationMask64(sourceStateId, mutationMask);
  return {
    sourceStateId,
    changedPositions,
    mutationMask,
    distance: new Set(changedPositions).size,
    targetStateId: target.id
  };
}
