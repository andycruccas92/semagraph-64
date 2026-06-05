import type {
  DerivedStateDefinition,
  ParameterSnapshot,
  StateId,
  TransitionAttempt,
  TransitionResult,
  TransitionRule
} from "./types.js";
import { evaluatePredicateSet } from "./predicates.js";
import { evaluateStates } from "./states.js";

export function applyEffects(parameters: ParameterSnapshot, rule: TransitionRule): ParameterSnapshot {
  const next: Record<string, boolean | number | string> = { ...parameters };
  for (const effect of rule.effects) next[effect.parameterKey] = effect.value;
  return next;
}

function rejected<TStateId extends StateId>(
  attempt: TransitionAttempt<TStateId>,
  reason: string
): TransitionResult<TStateId> {
  return {
    ruleId: attempt.ruleId,
    authority: attempt.authority,
    accepted: false,
    reason,
    sourceStateId: attempt.sourceStateId,
    targetStateId: attempt.sourceStateId,
    before: attempt.parameters,
    after: attempt.parameters,
    ...(attempt.observedAt !== undefined ? { observedAt: attempt.observedAt } : {}),
    ...(attempt.eventRef !== undefined ? { eventRef: attempt.eventRef } : {}),
    ...(attempt.note !== undefined ? { note: attempt.note } : {})
  };
}

export function evaluateTransition<TStateId extends StateId>(
  rule: TransitionRule<TStateId>,
  attempt: TransitionAttempt<TStateId>,
  stateDefinitions: readonly DerivedStateDefinition<TStateId>[]
): TransitionResult<TStateId> {
  if (rule.id !== attempt.ruleId) return rejected(attempt, "Attempt does not identify the evaluated rule.");
  if (!rule.allowedAuthorities.includes(attempt.authority)) return rejected(attempt, "Authority type is not allowed by this rule.");
  if (rule.sourceStateIds && (!attempt.sourceStateId || !rule.sourceStateIds.includes(attempt.sourceStateId))) {
    return rejected(attempt, "Source state is not admitted by this rule.");
  }
  if (!evaluatePredicateSet(rule.guards, attempt.parameters)) return rejected(attempt, "Transition guards are not satisfied.");

  const after = applyEffects(attempt.parameters, rule);
  const targetStateId = evaluateStates(stateDefinitions, after).selectedStateId;
  if (rule.targetStateId && targetStateId !== rule.targetStateId) {
    return rejected(attempt, "Derived target state does not match the declared rule target.");
  }

  return {
    ruleId: attempt.ruleId,
    authority: attempt.authority,
    accepted: true,
    reason: "Transition accepted by explicit rule evaluation.",
    sourceStateId: attempt.sourceStateId,
    targetStateId,
    before: attempt.parameters,
    after,
    ...(attempt.observedAt !== undefined ? { observedAt: attempt.observedAt } : {}),
    ...(attempt.eventRef !== undefined ? { eventRef: attempt.eventRef } : {}),
    ...(attempt.note !== undefined ? { note: attempt.note } : {})
  };
}
