import {
  compressState64Chain,
  createMutationMask64FromNumber,
  lookupState64Transition,
  mutationMask64ToNumber,
  state64IdToNumber,
  state64NumberToId,
  type State64Id
} from "@semagraph/state64-adapter";

export type NumericAnchorObservation = {
  key: string;
  value: number | boolean | string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  threshold: number | boolean | string;
  trueBit?: 0 | 1;
  falseBit?: 0 | 1;
  unit?: string;
  source?: string;
};

export type SemagraphToolResult = {
  tool: string;
  status: "ok" | "rejected";
  result?: unknown;
  error?: string;
};

function compare(value: number | boolean | string, operator: NumericAnchorObservation["operator"], threshold: number | boolean | string): boolean {
  if (operator === "eq") return value === threshold;
  if (operator === "neq") return value !== threshold;
  if (typeof value !== "number" || typeof threshold !== "number") {
    throw new Error(`Operator ${operator} requires numeric value and threshold.`);
  }
  switch (operator) {
    case "gt": return value > threshold;
    case "gte": return value >= threshold;
    case "lt": return value < threshold;
    case "lte": return value <= threshold;
    default: throw new Error(`Unsupported operator: ${operator}`);
  }
}

function assertStateId(value: string): asserts value is State64Id {
  if (!/^S64-[01]{6}$/.test(value)) throw new Error(`Expected State64 id like S64-010101, received: ${value}`);
}

export function semagraphAnchorState64(observations: readonly NumericAnchorObservation[]) {
  if (observations.length !== 6) throw new Error("State64 anchoring requires exactly six observations/rules.");
  const decisions = observations.map((observation, index) => {
    if (!observation.key.trim()) throw new Error(`Observation at index ${index} has an empty key.`);
    const result = compare(observation.value, observation.operator, observation.threshold);
    const trueBit = observation.trueBit ?? 1;
    const falseBit = observation.falseBit ?? 0;
    const bit = result ? trueBit : falseBit;
    if (bit !== 0 && bit !== 1) throw new Error(`Invalid bit at position ${index + 1}.`);
    return {
      position: index + 1,
      key: observation.key,
      result,
      bit,
      source: observation.source,
      unit: observation.unit
    };
  });
  const binary = decisions.map((decision) => String(decision.bit)).join("");
  return {
    stateId: `S64-${binary}`,
    stateNumber: state64IdToNumber(`S64-${binary}` as State64Id),
    binary,
    decisions,
    anchorMode: "deterministic_observed_parameters",
    inferenceUsed: false
  };
}

export function semagraphLookupTransition64(sourceStateId: string, targetStateId: string) {
  assertStateId(sourceStateId);
  assertStateId(targetStateId);
  const transition = lookupState64Transition(sourceStateId, targetStateId);
  return {
    ...transition,
    sourceNumber: state64IdToNumber(sourceStateId),
    targetNumber: state64IdToNumber(targetStateId),
    mutationMaskNumber: mutationMask64ToNumber(transition.mutationMask),
    transitionIndex: state64IdToNumber(sourceStateId) * 64 + state64IdToNumber(targetStateId),
    inferenceUsed: false
  };
}

export function semagraphCompressChain64(states: readonly string[]) {
  const typed = states.map((state) => {
    assertStateId(state);
    return state;
  });
  const compression = compressState64Chain(typed);
  return {
    ...compression,
    stateNumbers: typed.map((state) => state64IdToNumber(state)),
    netMutationMaskNumber: mutationMask64ToNumber(compression.netMutationMask),
    inferenceUsed: false
  };
}

export function semagraphPolicyContext64(args: { states: readonly string[]; objective?: string; constraints?: readonly string[]; evidenceRefs?: readonly string[] }) {
  const compression = semagraphCompressChain64(args.states);
  return {
    policySynthesisBoundary: "LLM may synthesize policy only after deterministic state anchoring and transition compression. LLM must not modify states, measurements, masks or signatures.",
    objective: args.objective ?? "stabilize operational response to the observed transition signature",
    constraints: args.constraints ?? [],
    evidenceRefs: args.evidenceRefs ?? [],
    compressedTransition: compression,
    requiredPolicyOutput: {
      policyId: "string",
      policySummary: "string",
      triggerSignature: compression.signature,
      allowedActions: ["string"],
      forbiddenActions: ["do not infer or mutate observed states", "do not override deterministic transition signature"],
      reviewRequired: true
    }
  };
}

export function dispatchSemagraphTool(toolName: string, args: Record<string, unknown>): SemagraphToolResult {
  try {
    switch (toolName) {
      case "semagraph_anchor_state64":
        return { tool: toolName, status: "ok", result: semagraphAnchorState64(args.observations as NumericAnchorObservation[]) };
      case "semagraph_lookup_transition64":
        return { tool: toolName, status: "ok", result: semagraphLookupTransition64(args.sourceStateId as string, args.targetStateId as string) };
      case "semagraph_compress_chain64":
        return { tool: toolName, status: "ok", result: semagraphCompressChain64(args.states as string[]) };
      case "semagraph_policy_context64":
        return { tool: toolName, status: "ok", result: semagraphPolicyContext64(args as { states: string[]; objective?: string; constraints?: string[]; evidenceRefs?: string[] }) };
      default:
        return { tool: toolName, status: "rejected", error: `Unknown SemaGraph tool: ${toolName}` };
    }
  } catch (error) {
    return { tool: toolName, status: "rejected", error: error instanceof Error ? error.message : String(error) };
  }
}

export function createMutationMaskNumber(value: number) {
  return createMutationMask64FromNumber(value);
}
