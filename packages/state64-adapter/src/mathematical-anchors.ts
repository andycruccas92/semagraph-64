import {
  applyMathematicalAnchor,
  evaluateRegisteredProjection,
  type AnchorTrace,
  type FormalizedSnapshot,
  type MathematicalAnchorObservation,
  type MathematicalAnchorRegistry,
  type ProjectionDecision
} from "@semagraph/math-anchors";
import { createBinaryState64 } from "./hypercube.js";
import type { BinaryState64, State64Id } from "./types.js";

export type MathematicallyAnchoredState64 = {
  anchorMode: "deterministic_mathematical_anchor";
  mathematicalDomainId: string;
  mathematicalDomainVersion: string;
  anchorDefinitionId: string;
  anchorVersion: string;
  projectionVersion: string;
  formalizedSnapshot: FormalizedSnapshot;
  state: BinaryState64;
  decisions: readonly ProjectionDecision[];
  trace: AnchorTrace<State64Id>;
};

export function projectFormalizedSnapshotToState64(
  registry: MathematicalAnchorRegistry,
  formalizedSnapshot: FormalizedSnapshot
): MathematicallyAnchoredState64 {
  const projection = evaluateRegisteredProjection(registry, formalizedSnapshot);
  const state = createBinaryState64(projection.bits.join(""));
  const trace: AnchorTrace<State64Id> = {
    stateId: state.id,
    mathematicalDomainId: formalizedSnapshot.mathematicalDomainId,
    mathematicalDomainVersion: formalizedSnapshot.mathematicalDomainVersion,
    anchorDefinitionId: formalizedSnapshot.anchorDefinitionId,
    anchorVersion: formalizedSnapshot.anchorVersion,
    projectionVersion: formalizedSnapshot.projectionVersion,
    assumptions: formalizedSnapshot.assumptions,
    validityScope: formalizedSnapshot.validityScope,
    bits: projection.decisions,
    replayKey: formalizedSnapshot.replayKey
  };
  return {
    anchorMode: "deterministic_mathematical_anchor",
    mathematicalDomainId: formalizedSnapshot.mathematicalDomainId,
    mathematicalDomainVersion: formalizedSnapshot.mathematicalDomainVersion,
    anchorDefinitionId: formalizedSnapshot.anchorDefinitionId,
    anchorVersion: formalizedSnapshot.anchorVersion,
    projectionVersion: projection.projectionVersion,
    formalizedSnapshot,
    state,
    decisions: projection.decisions,
    trace
  };
}

export function anchorMathematicalObservationsToState64(
  registry: MathematicalAnchorRegistry,
  anchorDefinitionId: string,
  anchorVersion: string,
  observations: readonly MathematicalAnchorObservation[]
): MathematicallyAnchoredState64 {
  const formalized = applyMathematicalAnchor(registry, anchorDefinitionId, anchorVersion, observations);
  return projectFormalizedSnapshotToState64(registry, formalized);
}
