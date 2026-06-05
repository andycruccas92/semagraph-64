import type { StateId, TransitionAuthority, TransitionResult } from "./types.js";
import type { RegimeClass, RegimeClassification } from "./regimes.js";

export type PolicyRule<TStateId extends StateId = StateId> = {
  id: string;
  label: string;
  description?: string;
  appliesToRegimeClasses: readonly RegimeClass[];
  sourceStateIds?: readonly TStateId[];
  targetStateIds?: readonly TStateId[];
  transitionRuleIds?: readonly string[];
  allowedAuthorities?: readonly TransitionAuthority[];
  priority?: number;
  policyText: string;
  tags?: readonly string[];
};

export type ResolvedPolicy<TStateId extends StateId = StateId> = {
  rule: PolicyRule<TStateId>;
  reason: string;
};

export type PolicyResolutionResult<TStateId extends StateId = StateId> = {
  classification: RegimeClassification<TStateId>;
  matchedPolicies: readonly ResolvedPolicy<TStateId>[];
  selectedPolicy: ResolvedPolicy<TStateId> | null;
};

export function resolvePoliciesForClassification<TStateId extends StateId>(
  classification: RegimeClassification<TStateId>,
  policies: readonly PolicyRule<TStateId>[],
  transition?: TransitionResult<TStateId>
): PolicyResolutionResult<TStateId> {
  const matchedPolicies = policies
    .filter((policy) => policyMatchesClassification(policy, classification, transition))
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((rule) => ({
      rule,
      reason: `Policy matches regimeClass=${classification.regimeClass}.`
    }));

  return {
    classification,
    matchedPolicies,
    selectedPolicy: matchedPolicies[0] ?? null
  };
}

function policyMatchesClassification<TStateId extends StateId>(
  policy: PolicyRule<TStateId>,
  classification: RegimeClassification<TStateId>,
  transition?: TransitionResult<TStateId>
): boolean {
  if (!policy.appliesToRegimeClasses.includes(classification.regimeClass)) return false;
  if (policy.sourceStateIds && (!classification.sourceStateId || !policy.sourceStateIds.includes(classification.sourceStateId))) return false;
  if (policy.targetStateIds && (!classification.targetStateId || !policy.targetStateIds.includes(classification.targetStateId))) return false;
  if (policy.transitionRuleIds && !policy.transitionRuleIds.includes(classification.transitionRuleId)) return false;
  if (policy.allowedAuthorities && transition && !policy.allowedAuthorities.includes(transition.authority)) return false;
  return true;
}
