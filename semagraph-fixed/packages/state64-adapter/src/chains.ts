import type { MutationMask64, State64Id } from "./types.js";
import { lookupState64Transition, type State64TransitionMatrixEntry } from "./matrix.js";
import { createMutationMask64FromBinary, xorMutationMasks64 } from "./hypercube.js";

export type State64ChainCompression = {
  sourceStateId: State64Id;
  targetStateId: State64Id;
  states: readonly State64Id[];
  transitions: readonly State64TransitionMatrixEntry[];
  orderedMutationMasks: readonly MutationMask64[];
  netMutationMask: MutationMask64;
  cumulativeDistance: number;
  signature: string;
};

export function compressState64Chain(states: readonly State64Id[]): State64ChainCompression {
  if (states.length < 2) throw new Error("A State64 chain requires at least two states.");

  const transitions = states.slice(0, -1).map((state, index) => lookupState64Transition(state, states[index + 1] as State64Id));
  const orderedMutationMasks = transitions.map((transition) => transition.mutationMask);
  const netMutationMask = orderedMutationMasks.reduce(
    (current, mask) => xorMutationMasks64(current, mask),
    createMutationMask64FromBinary("000000")
  );
  const cumulativeDistance = transitions.reduce((sum, transition) => sum + transition.distance, 0);
  const sourceStateId = states[0] as State64Id;
  const targetStateId = states[states.length - 1] as State64Id;

  return {
    sourceStateId,
    targetStateId,
    states,
    transitions,
    orderedMutationMasks,
    netMutationMask,
    cumulativeDistance,
    signature: `C64:${sourceStateId}>${targetStateId}|M:${orderedMutationMasks.join(".")}|N:${netMutationMask}`
  };
}
