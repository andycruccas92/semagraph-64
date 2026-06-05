import type { DerivedStateDefinition, StateEvaluation, StateId, ParameterSnapshot } from "./types.js";
import { evaluatePredicateSet, flattenPredicateResults } from "./predicates.js";

export function evaluateStates<TStateId extends StateId>(
  definitions: readonly DerivedStateDefinition<TStateId>[],
  parameters: ParameterSnapshot
): StateEvaluation<TStateId> {
  const evaluatedStates = definitions.map((definition) => ({
    stateId: definition.id,
    matched: evaluatePredicateSet(definition.predicates, parameters),
    predicateResults: flattenPredicateResults(definition.predicates, parameters)
  }));

  const matchedDefinitions = definitions
    .filter((definition) => evaluatePredicateSet(definition.predicates, parameters))
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));

  return {
    parameters,
    matchingStateIds: matchedDefinitions.map((definition) => definition.id),
    selectedStateId: matchedDefinitions[0]?.id ?? null,
    evaluatedStates
  };
}

export function requireSelectedState<TStateId extends StateId>(evaluation: StateEvaluation<TStateId>): TStateId {
  if (!evaluation.selectedStateId) {
    throw new Error("Parameter snapshot does not satisfy any defined state.");
  }
  return evaluation.selectedStateId;
}
