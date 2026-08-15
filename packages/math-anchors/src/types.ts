export type JsonPrimitive = boolean | number | string | null;
export type FormalValue = boolean | number | string;
export type FormalValueType = "boolean" | "number" | "string";

export type MathematicalDomainId = string;
export type AnchorVersion = string;

export type MathematicalStructureFamily =
  | "metric_geometric"
  | "order"
  | "graph"
  | "probability_information"
  | "dynamical_state"
  | "constraint"
  | "decision_value"
  | "similarity"
  | "uncertainty";

export type MathematicalStructureKind =
  | "metric"
  | "pseudometric"
  | "norm"
  | "vector_space_relation"
  | "partial_order"
  | "total_order"
  | "ranking_relation"
  | "node"
  | "edge"
  | "directed_relation"
  | "path"
  | "connectivity"
  | "dependency_graph"
  | "probability_distribution"
  | "conditional_probability"
  | "entropy"
  | "divergence"
  | "mutual_information_relation"
  | "state_space"
  | "transition_relation"
  | "discrete_dynamical_system"
  | "feasibility_relation"
  | "constraint_set"
  | "boundary"
  | "admissible_region"
  | "utility"
  | "cost"
  | "objective"
  | "preference_relation"
  | "similarity_function"
  | "kernel_relation"
  | "equivalence_relation"
  | "probability_uncertainty"
  | "interval_uncertainty"
  | "bounded_uncertainty";

export type MathematicalStructureDescriptor = {
  kind: MathematicalStructureKind;
  family: MathematicalStructureFamily;
  description: string;
  declaredAxioms: readonly string[];
};

export type SemanticObservationalSpace = {
  description: string;
  admissibleObservationKeys: readonly string[];
};

export type MathematicalDomainDefinition = {
  id: MathematicalDomainId;
  version: string;
  label: string;
  observationalSpace: SemanticObservationalSpace;
  structure: MathematicalStructureDescriptor;
};

export type UnitConversion = {
  fromUnit: string;
  scale: number;
  offset: number;
};

export type UnitConstraint = {
  dimension: string;
  canonicalUnit: string;
  conversions: readonly UnitConversion[];
};

export type FormalVariable = {
  id: string;
  label: string;
  valueType: FormalValueType;
  description: string;
  unitConstraint?: UnitConstraint;
};

export type FormalRelation = {
  id: string;
  kind: string;
  operandVariableIds: readonly string[];
  description: string;
};

export type ObservationTransform =
  | { kind: "identity" }
  | { kind: "absolute" }
  | { kind: "scale_offset"; scale: number; offset: number };

export type ObservationBinding = {
  id: string;
  observationKey: string;
  formalVariableId: string;
  required: boolean;
  transform: ObservationTransform;
  declaredDefault?: FormalValue;
};

export type Assumption = {
  id: string;
  statement: string;
};

export type ValidityScope = {
  description: string;
  appliesWhen: readonly string[];
  excludes: readonly string[];
};

export type EvidenceReference = {
  id: string;
  source: string;
  uri?: string;
  observedAt?: string;
  contentHash?: string;
};

export type EvidenceProvenanceRequirements = {
  minimumReferencesPerObservation: number;
  requireContentHash: boolean;
};

export type FormalPredicateOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";

export type FormalPredicate = {
  formalVariableId: string;
  formalRelationIds: readonly string[];
  operator: FormalPredicateOperator;
  value: FormalValue | readonly FormalValue[];
};

export type FormalPredicateExpression = FormalPredicate | {
  all?: readonly FormalPredicateExpression[];
  any?: readonly FormalPredicateExpression[];
  none?: readonly FormalPredicateExpression[];
};

export type PredicateContract = {
  id: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  label: string;
  expression: FormalPredicateExpression;
  trueValue?: 0 | 1;
  falseValue?: 0 | 1;
};

export type ProjectionDefinition = {
  version: string;
  predicates: readonly [PredicateContract, PredicateContract, PredicateContract, PredicateContract, PredicateContract, PredicateContract];
};

export type MathematicalAnchorDefinition = {
  id: string;
  version: AnchorVersion;
  label: string;
  mathematicalDomainId: MathematicalDomainId;
  mathematicalDomainVersion: string;
  structureKind: MathematicalStructureKind;
  formalizationDescription: string;
  variables: readonly FormalVariable[];
  relations: readonly FormalRelation[];
  observationBindings: readonly ObservationBinding[];
  assumptions: readonly Assumption[];
  validityScope: ValidityScope;
  projection: ProjectionDefinition;
  evidenceProvenance: EvidenceProvenanceRequirements;
};

export type AnchorProposalOrigin = "human" | "llm" | "automated_discovery";

export type CandidateAnchor = {
  authority: "candidate";
  proposedBy: AnchorProposalOrigin;
  definition: MathematicalAnchorDefinition;
};

export type RegisteredAnchor = {
  authority: "registered";
  acceptedBy: string;
  definition: MathematicalAnchorDefinition;
};

export type MathematicalAnchorObservation = {
  key: string;
  value: FormalValue;
  unit?: string;
  evidenceReferences: readonly EvidenceReference[];
};

export type FormalizedObservation = {
  bindingId: string;
  observationKey: string;
  formalVariableId: string;
  observedValue?: FormalValue;
  observedUnit?: string;
  formalValue: FormalValue;
  canonicalUnit?: string;
  origin: "observation" | "declared_default";
  evidenceReferences: readonly EvidenceReference[];
};

export type FormalizedSnapshot = {
  mathematicalDomainId: MathematicalDomainId;
  mathematicalDomainVersion: string;
  anchorDefinitionId: string;
  anchorVersion: AnchorVersion;
  projectionVersion: string;
  formalVariables: Readonly<Record<string, FormalValue>>;
  formalizedObservations: readonly FormalizedObservation[];
  assumptions: readonly Assumption[];
  validityScope: ValidityScope;
  replayKey: string;
};

export type ProjectionDecision = {
  predicateId: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  label: string;
  result: boolean;
  value: 0 | 1;
  formalVariableIds: readonly string[];
  formalRelationIds: readonly string[];
  observationBindingIds: readonly string[];
  evidenceReferences: readonly EvidenceReference[];
};

export type ProjectionEvaluation = {
  projectionVersion: string;
  bits: readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
  decisions: readonly ProjectionDecision[];
};

export type AnchorTrace<TStateId extends string = string> = {
  stateId: TStateId;
  mathematicalDomainId: MathematicalDomainId;
  mathematicalDomainVersion: string;
  anchorDefinitionId: string;
  anchorVersion: AnchorVersion;
  projectionVersion: string;
  assumptions: readonly Assumption[];
  validityScope: ValidityScope;
  bits: readonly ProjectionDecision[];
  replayKey: string;
};

export type AnchorValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type MathematicalStructureComparison = {
  sameDefinition: boolean;
  sameStructureKind: boolean;
  sameDeclaredStructure: boolean;
  sameLexicalLabel: boolean;
  semanticIdentityAsserted: false;
};
