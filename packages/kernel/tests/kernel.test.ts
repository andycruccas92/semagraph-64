import { describe, expect, it } from "vitest";
import {
  appendTransition,
  compileDeclaredStateGraph,
  assertValidParameterSnapshot,
  assertValidPredicateParameterReferences,
  createTrajectory,
  currentStateId,
  outgoingEdges,
  evaluateStates,
  evaluateTransition,
  resolvePoliciesForClassification,
  classifyTransitionRegime,
  validatePredicateParameterReferences,
  weightedSnapshotSimilarity,
  type DerivedStateDefinition,
  type ParameterDefinition,
  type TransitionRule,
  validatePolicySynthesisInput,
  type PolicyRule
} from "../src/index.js";

type DemoState = "stable" | "strained" | "fragmentation-risk";

const PARAMETERS: readonly ParameterDefinition[] = [
  { key: "pressure", label: "Pressure", kind: "number", min: 0, max: 1 },
  { key: "cohesion", label: "Cohesion", kind: "number", min: 0, max: 1 },
  { key: "constraint", label: "Constraint", kind: "boolean" }
];

const STATES: readonly DerivedStateDefinition<DemoState>[] = [
  {
    id: "fragmentation-risk",
    label: "Fragmentation risk",
    priority: 30,
    predicates: { all: [{ parameterKey: "pressure", operator: "gte", value: 0.65 }, { parameterKey: "cohesion", operator: "lt", value: 0.4 }] }
  },
  {
    id: "strained",
    label: "Strained",
    priority: 20,
    predicates: { all: [{ parameterKey: "pressure", operator: "gte", value: 0.35 }] }
  },
  {
    id: "stable",
    label: "Stable",
    priority: 10,
    predicates: { all: [{ parameterKey: "pressure", operator: "lt", value: 0.35 }, { parameterKey: "cohesion", operator: "gte", value: 0.5 }] }
  }
];

const RULE: TransitionRule<DemoState> = {
  id: "external-constraint-pressure",
  label: "External constraint increases pressure and erodes cohesion",
  sourceStateIds: ["stable"],
  targetStateId: "fragmentation-risk",
  guards: { all: [{ parameterKey: "constraint", operator: "eq", value: true }] },
  effects: [{ parameterKey: "pressure", value: 0.78 }, { parameterKey: "cohesion", value: 0.28 }],
  allowedAuthorities: ["observed", "simulated"]
};

describe("@semagraph-64/kernel", () => {
  it("derives a selected state from explicit parameters and predicates", () => {
    const snapshot = { pressure: 0.2, cohesion: 0.8, constraint: false } as const;
    assertValidParameterSnapshot(PARAMETERS, snapshot);
    expect(evaluateStates(STATES, snapshot).selectedStateId).toBe("stable");
  });

  it("rejects predicate set referencing undeclared parameter key", () => {
    const issues = validatePredicateParameterReferences(PARAMETERS, {
      all: [
        { parameterKey: "pressure", operator: "gte", value: 0.5 },
        {
          any: [
            { parameterKey: "constraint", operator: "eq", value: true },
            { parameterKey: "stale-parameter", operator: "eq", value: true }
          ]
        }
      ]
    });

    expect(issues).toEqual([
      {
        parameterKey: "stale-parameter",
        message: "Predicate references undeclared parameter key."
      }
    ]);
    expect(() => assertValidPredicateParameterReferences(PARAMETERS, { none: [{ parameterKey: "removed", operator: "eq", value: false }] }))
      .toThrow(/removed: Predicate references undeclared parameter key\./);
  });

  it("accepts a guarded transition and derives the declared target", () => {
    const before = { pressure: 0.2, cohesion: 0.8, constraint: true } as const;
    const transition = evaluateTransition(
      RULE,
      { ruleId: RULE.id, sourceStateId: "stable", authority: "observed", parameters: before },
      STATES
    );
    expect(transition.accepted).toBe(true);
    expect(transition.targetStateId).toBe("fragmentation-risk");
  });

  it("keeps transition authority explicit in committed trajectories", () => {
    const before = { pressure: 0.2, cohesion: 0.8, constraint: true } as const;
    const transition = evaluateTransition(
      RULE,
      { ruleId: RULE.id, sourceStateId: "stable", authority: "simulated", parameters: before },
      STATES
    );
    const trajectory = appendTransition(createTrajectory("trajectory-1", before, "stable"), transition);
    expect(currentStateId(trajectory)).toBe("fragmentation-risk");
    expect(trajectory.events[0]?.authority).toBe("simulated");
  });

  it("materialises declared transition rules as a directed state graph", () => {
    const graph = compileDeclaredStateGraph(STATES, [RULE]);
    expect(graph.nodes).toHaveLength(3);
    expect(outgoingEdges(graph, "stable")[0]?.targetStateId).toBe("fragmentation-risk");
  });

  it("supports domain-defined weighted similarity without fixed semantics", () => {
    expect(
      weightedSnapshotSimilarity(
        { pressure: 0.2, cohesion: 0.8, constraint: false },
        { pressure: 0.2, cohesion: 0.4, constraint: false },
        [{ parameterKey: "pressure", weight: 2 }, { parameterKey: "cohesion", weight: 3 }, { parameterKey: "constraint", weight: 1 }]
      )
    ).toBe(0.5);
  });

  it("validates a policy synthesis request after deterministic signature computation", () => {
    const validation = validatePolicySynthesisInput({
      id: "policy-request-1",
      origin: "llm",
      signature: "C64:S64-000000>S64-101010|M:M64-100000.M64-001000.M64-000010|N:M64-101010",
      requestedAt: "2026-06-05T00:00:00Z",
      constraints: ["Do not alter the computed signature."]
    });

    expect(validation.accepted).toBe(true);
  });

  it("keeps generic regime classification and policy resolution deterministic", () => {
    const transition = evaluateTransition(
      RULE,
      { ruleId: RULE.id, sourceStateId: "stable", authority: "observed", parameters: { pressure: 0.2, cohesion: 0.8, constraint: true } },
      STATES
    );
    const classification = classifyTransitionRegime(transition);
    const resolution = resolvePoliciesForClassification(classification, [
      {
        id: "policy-a",
        label: "Priority policy",
        appliesToRegimeClasses: [classification.regimeClass],
        priority: 1,
        policyText: "Use explicit state transition evidence before producing a stable policy."
      }
    ], transition);

    expect(classification.changedParameterKeys).toEqual(["cohesion", "pressure"]);
    expect(resolution.selectedPolicy?.rule.id).toBe("policy-a");
  });

});
