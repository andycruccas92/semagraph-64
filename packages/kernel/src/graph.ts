import type { DeclaredStateGraph, DerivedStateDefinition, StateId, TransitionRule } from "./types.js";

export function compileDeclaredStateGraph<TStateId extends StateId>(
  stateDefinitions: readonly DerivedStateDefinition<TStateId>[],
  rules: readonly TransitionRule<TStateId>[]
): DeclaredStateGraph<TStateId> {
  const stateIds = new Set(stateDefinitions.map((definition) => definition.id));
  const edges = rules.flatMap((rule) => {
    if (!rule.sourceStateIds?.length || !rule.targetStateId) {
      throw new Error(`Rule ${rule.id} cannot become a graph edge without declared source and target states.`);
    }
    if (!stateIds.has(rule.targetStateId)) throw new Error(`Rule ${rule.id} references unknown target state: ${rule.targetStateId}`);
    return rule.sourceStateIds.map((sourceStateId) => {
      if (!stateIds.has(sourceStateId)) throw new Error(`Rule ${rule.id} references unknown source state: ${sourceStateId}`);
      return {
        ruleId: rule.id,
        sourceStateId,
        targetStateId: rule.targetStateId as TStateId,
        allowedAuthorities: rule.allowedAuthorities
      };
    });
  });

  return {
    nodes: stateDefinitions.map((definition) => ({ stateId: definition.id, label: definition.label })),
    edges
  };
}

export function outgoingEdges<TStateId extends StateId>(
  graph: DeclaredStateGraph<TStateId>,
  stateId: TStateId
): DeclaredStateGraph<TStateId>["edges"] {
  return graph.edges.filter((edge) => edge.sourceStateId === stateId);
}
