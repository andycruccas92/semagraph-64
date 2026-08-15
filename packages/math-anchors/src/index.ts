export type {
  AnchorProposalOrigin,
  AnchorTrace,
  AnchorValidationIssue,
  AnchorVersion,
  Assumption,
  CandidateAnchor,
  EvidenceProvenanceRequirements,
  EvidenceReference,
  FormalPredicate,
  FormalPredicateExpression,
  FormalPredicateOperator,
  FormalRelation,
  FormalValue,
  FormalValueType,
  FormalVariable,
  FormalizedObservation,
  FormalizedSnapshot,
  MathematicalAnchorDefinition,
  MathematicalAnchorObservation,
  MathematicalDomainDefinition,
  MathematicalDomainId,
  MathematicalStructureComparison,
  MathematicalStructureDescriptor,
  MathematicalStructureFamily,
  MathematicalStructureKind,
  ObservationBinding,
  ObservationTransform,
  PredicateContract,
  ProjectionDecision,
  ProjectionDefinition,
  ProjectionEvaluation,
  RegisteredAnchor,
  SemanticObservationalSpace,
  UnitConstraint,
  UnitConversion,
  ValidityScope
} from "./types.js";
export { MATHEMATICAL_STRUCTURE_KINDS, isMathematicalStructureKind, structureFamilyFor } from "./vocabulary.js";
export {
  assertValidMathematicalAnchorDefinition,
  assertValidMathematicalDomainDefinition,
  validateMathematicalAnchorDefinition,
  validateMathematicalDomainDefinition
} from "./validation.js";
export { MathematicalAnchorRegistry, createCandidateAnchor } from "./registry.js";
export {
  applyMathematicalAnchor,
  computeFormalizedSnapshotReplayKey,
  evaluateRegisteredProjection
} from "./formalization.js";
export { compareMathematicalStructures, inspectAnchorTrace } from "./comparison.js";
