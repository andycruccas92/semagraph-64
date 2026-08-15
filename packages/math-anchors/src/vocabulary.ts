import type { MathematicalStructureFamily, MathematicalStructureKind } from "./types.js";

export const MATHEMATICAL_STRUCTURE_KINDS = {
  metric: "metric_geometric",
  pseudometric: "metric_geometric",
  norm: "metric_geometric",
  vector_space_relation: "metric_geometric",
  partial_order: "order",
  total_order: "order",
  ranking_relation: "order",
  node: "graph",
  edge: "graph",
  directed_relation: "graph",
  path: "graph",
  connectivity: "graph",
  dependency_graph: "graph",
  probability_distribution: "probability_information",
  conditional_probability: "probability_information",
  entropy: "probability_information",
  divergence: "probability_information",
  mutual_information_relation: "probability_information",
  state_space: "dynamical_state",
  transition_relation: "dynamical_state",
  discrete_dynamical_system: "dynamical_state",
  feasibility_relation: "constraint",
  constraint_set: "constraint",
  boundary: "constraint",
  admissible_region: "constraint",
  utility: "decision_value",
  cost: "decision_value",
  objective: "decision_value",
  preference_relation: "decision_value",
  similarity_function: "similarity",
  kernel_relation: "similarity",
  equivalence_relation: "similarity",
  probability_uncertainty: "uncertainty",
  interval_uncertainty: "uncertainty",
  bounded_uncertainty: "uncertainty"
} as const satisfies Readonly<Record<MathematicalStructureKind, MathematicalStructureFamily>>;

export function isMathematicalStructureKind(value: string): value is MathematicalStructureKind {
  return Object.prototype.hasOwnProperty.call(MATHEMATICAL_STRUCTURE_KINDS, value);
}

export function structureFamilyFor(kind: MathematicalStructureKind): MathematicalStructureFamily {
  return MATHEMATICAL_STRUCTURE_KINDS[kind];
}
