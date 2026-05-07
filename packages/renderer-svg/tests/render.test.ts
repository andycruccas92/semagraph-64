import { describe, expect, it } from "vitest";
import { getState64ById, getTrigramById } from "@semagraph/core";
import { renderState64, renderTrigram } from "../src/index.js";

describe("SVG renderer", () => {
  it("renders a trigram as SVG", () => {
    const svg = renderTrigram(getTrigramById("qian"));
    expect(svg).toContain("<svg");
    expect(svg).toContain("Qian");
  });

  it("renders a state as SVG", () => {
    const svg = renderState64(getState64ById("S64-101010"));
    expect(svg).toContain("S64-101010");
    expect(svg.match(/<line/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
