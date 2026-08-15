import { describe, expect, it } from "vitest";
import {
  MathematicalAnchorRegistry,
  createCandidateAnchor,
  type MathematicalAnchorDefinition,
  type MathematicalDomainDefinition
} from "@semagraph/math-anchors";
import {
  dispatchSemagraphTool,
  semagraphAnchorFormalizedState64,
  semagraphFormalizeObservations,
  semagraphInspectAnchorTrace,
  semagraphValidateMathAnchor,
  type MathematicalRegistryBundle
} from "../src/index.js";

const DOMAIN: MathematicalDomainDefinition = {
  id: "tool-test-domain",
  version: "1",
  label: "Tool test feasibility",
  observationalSpace: { description: "Six supplied Boolean records.", admissibleObservationKeys: ["b1", "b2", "b3", "b4", "b5", "b6"] },
  structure: { kind: "constraint_set", family: "constraint", description: "Six declared Boolean constraints.", declaredAxioms: ["records are externally supplied"] }
};

const ANCHOR: MathematicalAnchorDefinition = {
  id: "tool-test-anchor",
  version: "1",
  label: "Tool test projection",
  mathematicalDomainId: DOMAIN.id,
  mathematicalDomainVersion: DOMAIN.version,
  structureKind: "constraint_set",
  formalizationDescription: "Identity-bind six externally supplied Boolean records.",
  variables: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `b${position}`, label: `B${position}`, valueType: "boolean", description: `Boolean ${position}.` })),
  relations: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `r${position}`, kind: "constraint_membership", operandVariableIds: [`b${position}`], description: `B${position} belongs to the set.` })),
  observationBindings: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `binding${position}`, observationKey: `b${position}`, formalVariableId: `b${position}`, required: true, transform: { kind: "identity" } })),
  assumptions: [{ id: "authority", statement: "Records are authoritative for this test window." }],
  validityScope: { description: "Tool test only.", appliesWhen: ["test=true"], excludes: [] },
  projection: {
    version: "1",
    predicates: [1, 2, 3, 4, 5, 6].map((position) => ({ id: `p${position}`, position, label: `B${position} true`, expression: { formalVariableId: `b${position}`, formalRelationIds: [`r${position}`], operator: "eq", value: true } })) as MathematicalAnchorDefinition["projection"]["predicates"]
  },
  evidenceProvenance: { minimumReferencesPerObservation: 1, requireContentHash: false }
};

function bundle(): MathematicalRegistryBundle {
  const registry = new MathematicalAnchorRegistry();
  registry.registerDomain(DOMAIN);
  const registered = registry.registerAnchor(createCandidateAnchor(ANCHOR, "human"), "test-authority");
  return { domains: [DOMAIN], registeredAnchors: [registered] };
}

const observations = [true, false, true, false, true, false].map((value, index) => ({
  key: `b${index + 1}`,
  value,
  evidenceReferences: [{ id: `e${index + 1}`, source: "test-record" }]
}));

describe("mathematical anchor AI tools", () => {
  it("keeps candidate validation non-authoritative", () => {
    expect(semagraphValidateMathAnchor(DOMAIN, ANCHOR)).toMatchObject({ valid: true, authority: "candidate", authoritative: false, inferenceUsed: false });
  });

  it("formalizes, projects, and inspects one bit through registered records", () => {
    const formalized = semagraphFormalizeObservations({ registryBundle: bundle(), anchorDefinitionId: ANCHOR.id, anchorVersion: ANCHOR.version, observations });
    const anchored = semagraphAnchorFormalizedState64({ registryBundle: bundle(), formalizedSnapshot: formalized.formalizedSnapshot });
    expect(anchored.state.id).toBe("S64-101010");
    expect(semagraphInspectAnchorTrace(anchored.trace, 4).decision).toMatchObject({ value: 0, observationBindingIds: ["binding4"] });
  });

  it("rejects a candidate masquerading inside a registry bundle", () => {
    const result = dispatchSemagraphTool("semagraph_formalize_observations", {
      registryBundle: { domains: [DOMAIN], registeredAnchors: [createCandidateAnchor(ANCHOR, "llm")] },
      anchorDefinitionId: ANCHOR.id,
      anchorVersion: ANCHOR.version,
      observations
    });
    expect(result).toMatchObject({ status: "rejected" });
    expect(result.error).toMatch(/only registered anchors/);
  });
});
