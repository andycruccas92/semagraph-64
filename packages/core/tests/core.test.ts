import { describe, expect, it } from "vitest";
import {
  STATE64_CATALOG,
  TRIGRAMS,
  getState64ByBinary,
  getState64ById,
  getState64ByNumber,
  linesToBinaryString,
  sharedTrigramScore,
  simpleStateSimilarity,
  transformState64
} from "../src/index.js";

describe("SemaGraph core", () => {
  it("defines exactly 8 trigrams", () => {
    expect(TRIGRAMS).toHaveLength(8);
    expect(new Set(TRIGRAMS.map((trigram) => trigram.binary)).size).toBe(8);
  });

  it("generates exactly 64 states", () => {
    expect(STATE64_CATALOG).toHaveLength(64);
    expect(new Set(STATE64_CATALOG.map((state) => state.id)).size).toBe(64);
    expect(new Set(STATE64_CATALOG.map((state) => state.binary)).size).toBe(64);
  });

  it("stores lines bottom-up and generates stable binary IDs", () => {
    const state = getState64ByBinary("111000");
    expect(state.id).toBe("S64-111000");
    expect(linesToBinaryString(state.lines)).toBe("111000");
  });

  it("transforms moving lines deterministically", () => {
    const result = transformState64("S64-000000", [1, 6]);
    expect(result.targetStateId).toBe("S64-100001");
  });

  it("looks up canonical Wilhelm/King Wen metadata", () => {
    const creative = getState64ByNumber(1);
    expect(creative.id).toBe("S64-111111");
    expect(creative.wilhelmTitle).toBe("The Creative");

    const peace = getState64ByBinary("111000");
    expect(peace.number).toBe(11);
    expect(peace.wilhelmTitle).toBe("Peace");

    expect(getState64ById("S64-101010").binary).toBe("101010");
  });

  it("computes similarity", () => {
    expect(sharedTrigramScore("S64-111000", "S64-111101")).toBe(1);
    expect(simpleStateSimilarity("S64-000000", "S64-000000")).toBe(1);
  });
});
