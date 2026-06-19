export type ParameterValue = boolean | number | string;

export type ParameterKind = "boolean" | "number" | "ordinal" | "categorical";

export type ParameterDefinition = {
  key: string;
  label: string;
  kind: ParameterKind;
  description?: string;
  min?: number;
  max?: number;
  allowedValues?: readonly string[];
};

export type ParameterSnapshot = Readonly<Record<string, ParameterValue>>;

export type PredicateOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";

export type Predicate = {
  parameterKey: string;
  operator: PredicateOperator;
  value: ParameterValue | readonly ParameterValue[];
};

export type PredicateExpression = Predicate | PredicateSet;

export type PredicateSet = {
  all?: readonly PredicateExpression[];
  any?: readonly PredicateExpression[];
  none?: readonly PredicateExpression[];
};

export type StateId = string;

export type DerivedStateDefinition<TStateId extends StateId = StateId> = {
  id: TStateId;
  label: string;
  description?: string;
  priority?: number;
  predicates: PredicateSet;
  tags?: readonly string[];
};

export type EvaluatedState<TStateId extends StateId = StateId> = {
  stateId: TStateId;
  matched: boolean;
  predicateResults: readonly boolean[];
};

export type StateEvaluation<TStateId extends StateId = StateId> = {
  parameters: ParameterSnapshot;
  matchingStateIds: readonly TStateId[];
  selectedStateId: TStateId | null;
  evaluatedStates: readonly EvaluatedState<TStateId>[];
};

export type TransitionAuthority =
  | "rule_allowed"
  | "observed"
  | "triggered"
  | "simulated"
  | "inferred"
  | "validated";

export type ParameterAssignment = {
  parameterKey: string;
  value: ParameterValue;
};

export type TransitionRule<TStateId extends StateId = StateId> = {
  id: string;
  label: string;
  sourceStateIds?: readonly TStateId[];
  targetStateId?: TStateId;
  guards?: PredicateSet;
  effects: readonly ParameterAssignment[];
  allowedAuthorities: readonly TransitionAuthority[];
  eventType?: string;
};

export type StateGraphNode<TStateId extends StateId = StateId> = {
  stateId: TStateId;
  label: string;
};

export type StateGraphEdge<TStateId extends StateId = StateId> = {
  ruleId: string;
  sourceStateId: TStateId;
  targetStateId: TStateId;
  allowedAuthorities: readonly TransitionAuthority[];
};

export type DeclaredStateGraph<TStateId extends StateId = StateId> = {
  nodes: readonly StateGraphNode<TStateId>[];
  edges: readonly StateGraphEdge<TStateId>[];
};

export type TransitionAttempt<TStateId extends StateId = StateId> = {
  ruleId: string;
  sourceStateId: TStateId | null;
  authority: TransitionAuthority;
  parameters: ParameterSnapshot;
  observedAt?: string;
  eventRef?: string;
  note?: string;
};

export type TransitionResult<TStateId extends StateId = StateId> = {
  ruleId: string;
  authority: TransitionAuthority;
  accepted: boolean;
  reason: string;
  sourceStateId: TStateId | null;
  targetStateId: TStateId | null;
  before: ParameterSnapshot;
  after: ParameterSnapshot;
  observedAt?: string;
  eventRef?: string;
  note?: string;
};

export type Trajectory<TStateId extends StateId = StateId> = {
  id: string;
  initialParameters: ParameterSnapshot;
  initialStateId: TStateId | null;
  events: readonly TransitionResult<TStateId>[];
};

export type WeightedParameter = {
  parameterKey: string;
  weight: number;
};
