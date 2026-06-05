import { describe, expect, it } from "vitest";
import {
  MODULE3_CATALOG,
  STATE64_CATALOG,
  anchorObservedMeasurementsToState64,
  applyMutationMask64,
  compressState64Chain,
  createBinaryState64,
  createMutationMask64,
  createState64TransitionMatrix,
  elementaryNeighbours,
  classifyState64RegimeTransition,
  encodeParameterSnapshotToState64,
  getState64ByBinary,
  getState64ByOrdinal,
  lookupState64Transition,
  state64IdToNumber,
  state64NumberToId,
  transitionIndex64Number,
  transformState64,
  type State64EncodingDefinition
} from "../src/index.js";

const ENCODER: State64EncodingDefinition = {
  id: "demo-direct-anchor",
  label: "Six-parameter deterministic anchor",
  parameterDefinitions: [
    { key: "pressure", label: "Pressure", kind: "number", min: 0, max: 1 },
    { key: "cohesion", label: "Cohesion", kind: "number", min: 0, max: 1 },
    { key: "constraint", label: "Constraint", kind: "boolean" },
    { key: "direction", label: "Direction", kind: "categorical", allowedValues: ["expanding", "stable", "contracting"] },
    { key: "visibility", label: "Visibility", kind: "number", min: 0, max: 1 },
    { key: "reversible", label: "Reversible", kind: "boolean" }
  ],
  bitRules: [
    { position: 1, label: "high pressure", predicate: { parameterKey: "pressure", operator: "gte", value: 0.6 } },
    { position: 2, label: "strong cohesion", predicate: { parameterKey: "cohesion", operator: "gte", value: 0.5 } },
    { position: 3, label: "constraint active", predicate: { parameterKey: "constraint", operator: "eq", value: true } },
    { position: 4, label: "expanding direction", predicate: { parameterKey: "direction", operator: "eq", value: "expanding" } },
    { position: 5, label: "visible signal", predicate: { parameterKey: "visibility", operator: "gte", value: 0.5 } },
    { position: 6, label: "reversible condition", predicate: { parameterKey: "reversible", operator: "eq", value: true } }
  ]
};

describe("@semagraph/state64-adapter", () => {
  it("models State64 as a complete Q6 catalogue", () => {
    expect(MODULE3_CATALOG).toHaveLength(8);
    expect(STATE64_CATALOG).toHaveLength(64);
    expect(new Set(STATE64_CATALOG.map((state) => state.binary)).size).toBe(64);
    expect(getState64ByBinary("111000").id).toBe("S64-111000");
    expect(getState64ByOrdinal(57).id).toBe("S64-111000");
  });

  it("uses deterministic mutation masks", () => {
    const state = createBinaryState64("000000");
    const mask = createMutationMask64([1, 6]);
    expect(mask).toBe("M64-100001");
    expect(applyMutationMask64(state, mask).id).toBe("S64-100001");
    expect(elementaryNeighbours(state)).toHaveLength(6);
  });

  it("transforms a state by changed bit positions", () => {
    const result = transformState64("S64-000000", [1, 6]);
    expect(result.targetStateId).toBe("S64-100001");
    expect(result.mutationMask).toBe("M64-100001");
    expect(result.distance).toBe(2);
  });

  it("anchors domain parameters into a six-bit state through declared rules", () => {
    const result = encodeParameterSnapshotToState64(ENCODER, {
      pressure: 0.7,
      cohesion: 0.4,
      constraint: true,
      direction: "expanding",
      visibility: 0.3,
      reversible: true
    });
    expect(result.state.id).toBe("S64-101101");
    expect(result.decisions).toHaveLength(6);
  });

  it("anchors observed measurements without LLM inference", () => {
    const result = anchorObservedMeasurementsToState64({
      definition: ENCODER,
      anchorRuleVersion: "anchor-v1",
      measurements: [
        { key: "pressure", value: 0.7, unit: "ratio", source: "sensor-A" },
        { key: "cohesion", value: 0.4, unit: "ratio", source: "sensor-A" },
        { key: "constraint", value: true, source: "rule-engine" },
        { key: "direction", value: "expanding", source: "parameter-feed" },
        { key: "visibility", value: 0.3, unit: "ratio", source: "sensor-B" },
        { key: "reversible", value: true, source: "rule-engine" }
      ]
    });
    expect(result.anchorMode).toBe("deterministic_observed_parameters");
    expect(result.anchorRuleVersion).toBe("anchor-v1");
    expect(result.state.id).toBe("S64-101101");
  });

  it("classifies State64 mutations as compact regime changes", () => {
    const transition = transformState64("S64-000000", [1, 2, 4]);
    const classification = classifyState64RegimeTransition(transition);
    expect(classification.distance).toBe(3);
    expect(classification.lowerDistance).toBe(2);
    expect(classification.upperDistance).toBe(1);
    expect(classification.moduleScope).toBe("both_modules");
    expect(classification.regimeClass).toBe("cross_module_regime_shift");
  });

  it("precomputes a complete 64 x 64 transition matrix", () => {
    const matrix = createState64TransitionMatrix();
    expect(matrix).toHaveLength(4096);
    const entry = lookupState64Transition("S64-000000", "S64-111111");
    expect(entry.mutationMask).toBe("M64-111111");
    expect(entry.distance).toBe(6);
    expect(entry.regimeClass).toBe("full_bit_reversal");
  });

  it("provides numeric parity helpers for Rust/WASM integration", () => {
    expect(state64IdToNumber("S64-101010")).toBe(42);
    expect(state64NumberToId(42)).toBe("S64-101010");
    expect(transitionIndex64Number(42, 21)).toBe(2709);
  });

  it("compresses ordered State64 chains into deterministic signatures", () => {
    const chain = compressState64Chain(["S64-000000", "S64-100000", "S64-101000", "S64-101010"]);
    expect(chain.orderedMutationMasks).toEqual(["M64-100000", "M64-001000", "M64-000010"]);
    expect(chain.netMutationMask).toBe("M64-101010");
    expect(chain.cumulativeDistance).toBe(3);
    expect(chain.signature).toContain("C64:S64-000000>S64-101010");
  });
});
