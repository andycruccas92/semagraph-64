import { describe, expect, it } from "vitest";
import {
  MathematicalAnchorRegistry,
  applyMathematicalAnchor,
  compareMathematicalStructures,
  createCandidateAnchor,
  evaluateRegisteredProjection,
  type MathematicalAnchorDefinition,
  type MathematicalAnchorObservation,
  type MathematicalDomainDefinition,
  type PredicateContract
} from "../src/index.js";

const DOMAIN: MathematicalDomainDefinition = {
  id: "engineering-thermal-system",
  version: "1.0.0",
  label: "Thermal operating state",
  observationalSpace: {
    description: "Direct measurements from one declared thermal test rig.",
    admissibleObservationKeys: ["temperature", "vibration", "pressure", "outage", "efficiency", "reversible"]
  },
  structure: {
    kind: "state_space",
    family: "dynamical_state",
    description: "A six-coordinate discrete observation of an operating state.",
    declaredAxioms: ["Each coordinate is measured independently at one snapshot boundary."]
  }
};

function predicate(position: 1 | 2 | 3 | 4 | 5 | 6, variable: string, operator: PredicateContract["expression"] extends infer _T ? "eq" | "gte" | "gt" | "lt" : never, value: number | boolean): PredicateContract {
  return {
    id: `p${position}`,
    position,
    label: `${variable} ${operator} ${String(value)}`,
    expression: { formalVariableId: variable, formalRelationIds: [`relation-${variable}`], operator, value }
  };
}

function anchor(version: string, temperatureThreshold: number, assumption: string): MathematicalAnchorDefinition {
  const variables = [
    { id: "temperature", label: "Temperature", valueType: "number" as const, description: "Canonical temperature.", unitConstraint: { dimension: "temperature", canonicalUnit: "degC", conversions: [{ fromUnit: "degC", scale: 1, offset: 0 }, { fromUnit: "K", scale: 1, offset: -273.15 }] } },
    { id: "vibration", label: "Vibration", valueType: "number" as const, description: "Vibration amplitude.", unitConstraint: { dimension: "speed", canonicalUnit: "mm/s", conversions: [{ fromUnit: "mm/s", scale: 1, offset: 0 }] } },
    { id: "pressure", label: "Pressure", valueType: "number" as const, description: "Gauge pressure.", unitConstraint: { dimension: "pressure", canonicalUnit: "bar", conversions: [{ fromUnit: "bar", scale: 1, offset: 0 }] } },
    { id: "outage", label: "Outage", valueType: "boolean" as const, description: "Whether the rig is unavailable." },
    { id: "efficiency", label: "Efficiency", valueType: "number" as const, description: "Dimensionless efficiency.", unitConstraint: { dimension: "dimensionless", canonicalUnit: "ratio", conversions: [{ fromUnit: "ratio", scale: 1, offset: 0 }] } },
    { id: "reversible", label: "Reversible", valueType: "boolean" as const, description: "Whether the current intervention is reversible." }
  ];
  return {
    id: "thermal-state-anchor",
    version,
    label: "Thermal state-space projection",
    mathematicalDomainId: DOMAIN.id,
    mathematicalDomainVersion: DOMAIN.version,
    structureKind: "state_space",
    formalizationDescription: "Normalize declared measurement units and bind each measurement to one state coordinate.",
    variables,
    relations: variables.map((variable) => ({ id: `relation-${variable.id}`, kind: "coordinate_membership", operandVariableIds: [variable.id], description: `${variable.id} participates in the declared state space.` })),
    observationBindings: variables.map((variable) => ({ id: `binding-${variable.id}`, observationKey: variable.id, formalVariableId: variable.id, required: true, transform: { kind: "identity" as const } })),
    assumptions: [{ id: "calibration", statement: assumption }],
    validityScope: { description: "Applies only to rig TR-7 in its calibrated operating envelope.", appliesWhen: ["rig=TR-7"], excludes: ["sensor maintenance"] },
    projection: {
      version: `projection-${version}`,
      predicates: [
        predicate(1, "temperature", "gte", temperatureThreshold),
        predicate(2, "vibration", "gt", 2),
        predicate(3, "pressure", "gte", 5),
        predicate(4, "outage", "eq", true),
        predicate(5, "efficiency", "lt", 0.8),
        predicate(6, "reversible", "eq", true)
      ]
    },
    evidenceProvenance: { minimumReferencesPerObservation: 1, requireContentHash: false }
  };
}

const OBSERVATIONS: readonly MathematicalAnchorObservation[] = [
  { key: "temperature", value: 358.15, unit: "K", evidenceReferences: [{ id: "e-temperature", source: "sensor.temperature" }] },
  { key: "vibration", value: 1, unit: "mm/s", evidenceReferences: [{ id: "e-vibration", source: "sensor.vibration" }] },
  { key: "pressure", value: 6, unit: "bar", evidenceReferences: [{ id: "e-pressure", source: "sensor.pressure" }] },
  { key: "outage", value: false, evidenceReferences: [{ id: "e-outage", source: "controller.status" }] },
  { key: "efficiency", value: 0.75, unit: "ratio", evidenceReferences: [{ id: "e-efficiency", source: "derived.efficiency" }] },
  { key: "reversible", value: true, evidenceReferences: [{ id: "e-reversible", source: "maintenance.plan" }] }
];

function registryWithVersions(): MathematicalAnchorRegistry {
  const registry = new MathematicalAnchorRegistry();
  registry.registerDomain(DOMAIN);
  registry.registerAnchor(createCandidateAnchor(anchor("1.0.0", 80, "Sensors are calibrated under procedure C1."), "human"), "review-board");
  registry.registerAnchor(createCandidateAnchor(anchor("2.0.0", 90, "Sensors are calibrated under procedure C2."), "human"), "review-board");
  return registry;
}

describe("@semagraph/math-anchors", () => {
  it("formalizes identical evidence identically under one registered version", () => {
    const registry = registryWithVersions();
    const left = applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS);
    const right = applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS);
    expect(left).toEqual(right);
    expect(left.formalVariables.temperature).toBeCloseTo(85);
    expect(JSON.parse(JSON.stringify(left))).toEqual(left);
  });

  it("projects the same formal object deterministically to the same six bits", () => {
    const registry = registryWithVersions();
    const snapshot = applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS);
    expect(evaluateRegisteredProjection(registry, snapshot)).toEqual(evaluateRegisteredProjection(registry, snapshot));
    expect(evaluateRegisteredProjection(registry, snapshot).bits).toEqual([1, 0, 1, 0, 1, 1]);
  });

  it("replays historical versions without rewriting them", () => {
    const registry = registryWithVersions();
    const historical = applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS);
    const current = applyMathematicalAnchor(registry, "thermal-state-anchor", "2.0.0", OBSERVATIONS);
    expect(evaluateRegisteredProjection(registry, historical).bits[0]).toBe(1);
    expect(evaluateRegisteredProjection(registry, current).bits[0]).toBe(0);
    expect(applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS)).toEqual(historical);
    expect(historical.assumptions).not.toEqual(current.assumptions);
  });

  it("prevents an unregistered candidate from producing an authoritative projection", () => {
    const registry = new MathematicalAnchorRegistry();
    registry.registerDomain(DOMAIN);
    createCandidateAnchor(anchor("1.0.0", 80, "Candidate assumption."), "llm");
    expect(() => applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS)).toThrow(/Unregistered mathematical anchor/);
  });

  it("rejects version identity collisions with changed content", () => {
    const registry = registryWithVersions();
    const collision = anchor("1.0.0", 99, "Changed under a reused identity.");
    expect(() => registry.registerAnchor(createCandidateAnchor(collision, "human"), "review-board")).toThrow(/identity collision/);
  });

  it("rejects unit mismatches, missing evidence, and missing observations", () => {
    const registry = registryWithVersions();
    const wrongUnit = OBSERVATIONS.map((observation) => observation.key === "temperature" ? { ...observation, unit: "seconds" } : observation);
    const noEvidence = OBSERVATIONS.map((observation) => observation.key === "temperature" ? { ...observation, evidenceReferences: [] } : observation);
    expect(() => applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", wrongUnit)).toThrow(/Unit mismatch/);
    expect(() => applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", noEvidence)).toThrow(/requires at least 1 evidence/);
    expect(() => applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", OBSERVATIONS.slice(1))).toThrow(/Missing required observation: temperature/);
  });

  it("rejects conflicting evidence records that reuse one identity", () => {
    const registry = registryWithVersions();
    const collision = OBSERVATIONS.map((observation, index) => ({
      ...observation,
      evidenceReferences: [{ id: "shared-evidence", source: `source-${index}` }]
    }));
    expect(() => applyMathematicalAnchor(registry, "thermal-state-anchor", "1.0.0", collision)).toThrow(/Evidence reference identity collision/);
  });

  it("keeps lexical equality separate from mathematical equality", () => {
    const metric: MathematicalDomainDefinition = {
      ...DOMAIN,
      id: "metric-distance",
      label: "distance",
      structure: { kind: "metric", family: "metric_geometric", description: "A non-negative metric satisfying the declared metric axioms.", declaredAxioms: ["identity", "symmetry", "triangle inequality"] }
    };
    const cost: MathematicalDomainDefinition = {
      ...metric,
      id: "decision-cost",
      structure: { kind: "cost", family: "decision_value", description: "An application-specific decision cost.", declaredAxioms: ["lower cost is preferred"] }
    };
    const comparison = compareMathematicalStructures(metric, cost);
    expect(comparison.sameLexicalLabel).toBe(true);
    expect(comparison.sameStructureKind).toBe(false);
    expect(comparison.semanticIdentityAsserted).toBe(false);
  });

  it("recognizes shared declared structure without asserting semantic identity", () => {
    const left: MathematicalDomainDefinition = { ...DOMAIN, id: "network-latency", label: "latency separation", structure: { kind: "metric", family: "metric_geometric", description: "Declared metric over points.", declaredAxioms: ["metric axioms"] } };
    const right: MathematicalDomainDefinition = {
      ...left,
      id: "geometric-separation",
      label: "geometric separation",
      structure: { ...left.structure, description: "Different domain prose over the same declared kind and axioms." }
    };
    const comparison = compareMathematicalStructures(left, right);
    expect(comparison.sameDeclaredStructure).toBe(true);
    expect(comparison.sameDefinition).toBe(false);
    expect(comparison.semanticIdentityAsserted).toBe(false);
  });
});
