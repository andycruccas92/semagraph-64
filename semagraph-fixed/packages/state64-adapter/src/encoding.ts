import { assertValidParameterSnapshot, evaluatePredicate } from "@semagraph/kernel";
import type { EncodedState64, State64EncodingDecision, State64EncodingDefinition } from "./types.js";
import { createBinaryState64 } from "./hypercube.js";

export function encodeParameterSnapshotToState64(
  definition: State64EncodingDefinition,
  parameters: EncodedState64["parameters"]
): EncodedState64 {
  assertValidParameterSnapshot(definition.parameterDefinitions, parameters);
  const positions = new Set(definition.bitRules.map((rule) => rule.position));
  if (definition.bitRules.some((rule) => !Number.isInteger(rule.position) || rule.position < 1 || rule.position > 6) || positions.size !== 6) {
    throw new Error("A State64 encoder must define bit positions 1 through 6 exactly once.");
  }

  const decisions: State64EncodingDecision[] = definition.bitRules
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((rule) => {
      const result = evaluatePredicate(rule.predicate, parameters);
      return {
        position: rule.position,
        label: rule.label,
        result,
        value: result ? (rule.trueValue ?? 1) : (rule.falseValue ?? 0)
      };
    });

  const state = createBinaryState64(decisions.map((decision) => decision.value).join(""));
  return { definitionId: definition.id, parameters, state, decisions };
}
