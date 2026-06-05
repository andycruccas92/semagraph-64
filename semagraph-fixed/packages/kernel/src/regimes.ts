import type { StateId, TransitionResult } from "./types.js";

export type RegimeClass =
  | "no_change"
  | "local_adjustment"
  | "partial_reconfiguration"
  | "regime_shift"
  | "structural_inversion"
  | "unclassified";

export type RegimeClassification<TStateId extends StateId = StateId> = {
  transitionRuleId: string;
  sourceStateId: TStateId | null;
  targetStateId: TStateId | null;
  accepted: boolean;
  changedParameterKeys: readonly string[];
  changeMagnitude: number;
  stateChanged: boolean;
  regimeClass: RegimeClass;
  rationale: string;
};

export type RegimeClassificationThresholds = {
  localMaxChangedParameters?: number;
  partialMaxChangedParameters?: number;
  inversionMinChangedParameters?: number;
};

const DEFAULT_THRESHOLDS: Required<RegimeClassificationThresholds> = {
  localMaxChangedParameters: 1,
  partialMaxChangedParameters: 2,
  inversionMinChangedParameters: 5
};

export function changedParameterKeys(transition: TransitionResult): readonly string[] {
  const keys = new Set([...Object.keys(transition.before), ...Object.keys(transition.after)]);
  return [...keys].filter((key) => transition.before[key] !== transition.after[key]).sort();
}

export function classifyTransitionRegime<TStateId extends StateId>(
  transition: TransitionResult<TStateId>,
  thresholds: RegimeClassificationThresholds = {}
): RegimeClassification<TStateId> {
  const resolvedThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const changedKeys = changedParameterKeys(transition);
  const changeMagnitude = changedKeys.length;
  const stateChanged = transition.sourceStateId !== transition.targetStateId;

  let regimeClass: RegimeClass = "unclassified";
  if (!transition.accepted) regimeClass = "unclassified";
  else if (changeMagnitude === 0 && !stateChanged) regimeClass = "no_change";
  else if (changeMagnitude <= resolvedThresholds.localMaxChangedParameters) regimeClass = "local_adjustment";
  else if (changeMagnitude <= resolvedThresholds.partialMaxChangedParameters) regimeClass = "partial_reconfiguration";
  else if (changeMagnitude >= resolvedThresholds.inversionMinChangedParameters) regimeClass = "structural_inversion";
  else regimeClass = "regime_shift";

  return {
    transitionRuleId: transition.ruleId,
    sourceStateId: transition.sourceStateId,
    targetStateId: transition.targetStateId,
    accepted: transition.accepted,
    changedParameterKeys: changedKeys,
    changeMagnitude,
    stateChanged,
    regimeClass,
    rationale: buildRegimeRationale(regimeClass, changeMagnitude, stateChanged, transition.accepted)
  };
}

function buildRegimeRationale(regimeClass: RegimeClass, magnitude: number, stateChanged: boolean, accepted: boolean): string {
  if (!accepted) return "Rejected transitions are not classified as operative regime changes.";
  if (regimeClass === "no_change") return "No parameter or selected-state change was detected.";
  return `Classified as ${regimeClass} from ${magnitude} changed parameter(s) and stateChanged=${stateChanged}.`;
}
