import { describe, expect, it } from "vitest";
import { createBinaryState64, getModule3ByBinary } from "@semagraph/state64-adapter";
import { renderBinaryState64, renderBitModule3 } from "../src/index.js";

describe("SVG adapter renderer", () => {
  it("renders a neutral three-bit module as SVG", () => {
    const module = getModule3ByBinary("111");
    const svg = renderBitModule3({ label: module.id, bits: module.bits });
    expect(svg).toContain("<svg");
    expect(svg).toContain("B3-111");
  });

  it("renders a neutral binary State64", () => {
    const svg = renderBinaryState64(createBinaryState64("101010"));
    expect(svg).toContain("S64-101010");
    expect(svg.match(/<line/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
