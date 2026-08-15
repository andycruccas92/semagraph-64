import { describe, expect, it } from "vitest";
import {
  MathematicalAnchorRegistry,
  createCandidateAnchor,
  inspectAnchorTrace,
  type MathematicalAnchorDefinition,
  type MathematicalDomainDefinition
} from "@semagraph/math-anchors";
import {
  anchorMathematicalObservationsToState64,
  lookupState64Transition
} from "../src/index.js";

const DOMAIN: MathematicalDomainDefinition = {
  id: "decision-gates",
  version: "1",
  label: "Decision gate feasibility",
  observationalSpace: {
    description: "Six explicitly recorded decision gates.",
    admissibleObservationKeys: ["gate1", "gate2", "gate3", "gate4", "gate5", "gate6"]
  },
  structure: {
    kind: "feasibility_relation",
    family: "constraint",
    description: "A conjunction-ready set of declared Boolean feasibility coordinates.",
    declaredAxioms: ["Every gate is supplied by an identified record."]
  }
};

const ANCHOR: MathematicalAnchorDefinition = {
  id: "decision-gates-anchor",
  version: "1",
  label: "Decision gate projection",
  mathematicalDomainId: DOMAIN.id,
  mathematicalDomainVersion: DOMAIN.version,
  structureKind: "feasibility_relation",
  formalizationDescription: "Bind each recorded gate to one Boolean feasibility coordinate.",
  variables: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `gate${position}`, label: `Gate ${position}`, valueType: "boolean", description: `Declared gate ${position}.` })),
  relations: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `relation-gate${position}`, kind: "feasibility_coordinate", operandVariableIds: [`gate${position}`], description: `Gate ${position} belongs to the feasibility relation.` })),
  observationBindings: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `binding-gate${position}`, observationKey: `gate${position}`, formalVariableId: `gate${position}`, required: true, transform: { kind: "identity" } })),
  assumptions: [{ id: "gate-authority", statement: "Each gate record is authoritative for this decision window." }],
  validityScope: { description: "One reviewed decision window.", appliesWhen: ["review=open"], excludes: ["draft gate records"] },
  projection: {
    version: "projection-1",
    predicates: [1, 2, 3, 4, 5, 6].map((position) => ({
      id: `predicate-gate${position}`,
      position,
      label: `Gate ${position} is satisfied`,
      expression: { formalVariableId: `gate${position}`, formalRelationIds: [`relation-gate${position}`], operator: "eq", value: true }
    })) as MathematicalAnchorDefinition["projection"]["predicates"]
  },
  evidenceProvenance: { minimumReferencesPerObservation: 1, requireContentHash: false }
};

function registered(): MathematicalAnchorRegistry {
  const registry = new MathematicalAnchorRegistry();
  registry.registerDomain(DOMAIN);
  registry.registerAnchor(createCandidateAnchor(ANCHOR, "human"), "decision-review-board");
  return registry;
}

const OBSERVATIONS = [true, false, true, false, true, true].map((value, index) => ({
  key: `gate${index + 1}`,
  value,
  evidenceReferences: [{ id: `gate-evidence-${index + 1}`, source: "decision-register" }]
}));

describe("mathematical-anchor State64 integration", () => {
  it("keeps mathematical formalization upstream while producing canonical State64", () => {
    const result = anchorMathematicalObservationsToState64(registered(), ANCHOR.id, ANCHOR.version, OBSERVATIONS);
    expect(result.anchorMode).toBe("deterministic_mathematical_anchor");
    expect(result.state.id).toBe("S64-101011");
    expect(result.trace.anchorDefinitionId).toBe(ANCHOR.id);
    expect(inspectAnchorTrace(result.trace, 4)).toMatchObject({
      value: 0,
      formalVariableIds: ["gate4"],
      observationBindingIds: ["binding-gate4"]
    });
    expect(inspectAnchorTrace(result.trace, 4).evidenceReferences[0]?.source).toBe("decision-register");
  });

  it("preserves deterministic transition metadata after mathematical anchoring", () => {
    const first = anchorMathematicalObservationsToState64(registered(), ANCHOR.id, ANCHOR.version, OBSERVATIONS);
    const second = anchorMathematicalObservationsToState64(registered(), ANCHOR.id, ANCHOR.version, OBSERVATIONS);
    expect(lookupState64Transition(first.state.id, second.state.id)).toEqual(lookupState64Transition(first.state.id, second.state.id));
  });
});
