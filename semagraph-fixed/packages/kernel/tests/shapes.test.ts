import { describe, expect, it } from "vitest";
import {
  compareTrajectories,
  compositePointStateQ6,
  dwellSignature,
  endpointCompression,
  endpointSource,
  endpointTarget,
  elementaryStateQ3,
  endpointTransitionT64,
  exactPathKey,
  groupByShape,
  mutationPathQ3,
  netMutationQ3,
  normalizePathRunCollapse,
  pathQ3,
  shapeKey
} from "../src/shapes.js";

describe("path and shape hierarchy", () => {
  it("treats T64 as an oriented edge, recoverable to its endpoints", () => {
    // 0..7 source/target. 5*8+2 = 42, but as an EDGE not a Q6 point.
    const edge = endpointTransitionT64(elementaryStateQ3(5), elementaryStateQ3(2));
    expect(endpointSource(edge)).toBe(5);
    expect(endpointTarget(edge)).toBe(2);
    // Orientation matters: the reverse edge is a different code.
    const reverse = endpointTransitionT64(elementaryStateQ3(2), elementaryStateQ3(5));
    expect(edge).not.toBe(reverse);
  });

  it("keeps Q6 points and T64 edges as distinct constructs despite equal cardinality", () => {
    // Both accept 0..63 but are different brands; this test documents intent.
    expect(compositePointStateQ6(42)).toBe(42);
    expect(endpointTransitionT64(elementaryStateQ3(5), elementaryStateQ3(2))).toBe(42);
    // Same number, different meaning: one is a point, one is an edge.
  });

  it("collapses adjacent runs but preserves non-adjacent repeats", () => {
    // [A,B,B,D] run-collapses to [A,B,D]; [A,B,A,D] does NOT collapse.
    const padded = pathQ3([0, 1, 1, 3]);
    const tight = pathQ3([0, 1, 3]);
    const returning = pathQ3([0, 1, 0, 3]);

    expect(shapeKey(padded)).toBe(shapeKey(tight));
    expect(shapeKey(returning)).not.toBe(shapeKey(tight));

    expect(normalizePathRunCollapse(padded).shape).toEqual([0, 1, 3]);
    expect(normalizePathRunCollapse(padded).dwell).toEqual([1, 2, 1]);
    expect(normalizePathRunCollapse(returning).shape).toEqual([0, 1, 0, 3]);
  });

  it("classifies same shape, different duration as a distinct relation", () => {
    const padded = pathQ3([0, 1, 1, 3]);
    const tight = pathQ3([0, 1, 3]);
    const comparison = compareTrajectories(padded, tight);
    expect(comparison.relation).toBe("same_form_different_duration");
    expect(comparison.sameShape).toBe(true);
    expect(comparison.sameDwell).toBe(false);
  });

  it("treats identical paths as equivalent", () => {
    const comparison = compareTrajectories(pathQ3([0, 1, 3]), pathQ3([0, 1, 3]));
    expect(comparison.relation).toBe("equivalent");
  });

  it("separates same-endpoint different-shape as different_pattern", () => {
    // [A,B,D] vs [A,C,D]: same endpoint A->D, different shape.
    const left = pathQ3([0, 1, 3]);
    const right = pathQ3([0, 2, 3]);
    expect(endpointCompression(left)).toBe(endpointCompression(right));
    const comparison = compareTrajectories(left, right);
    expect(comparison.relation).toBe("different_pattern");
  });

  it("short-circuits on differing endpoints without claiming form identity", () => {
    const comparison = compareTrajectories(pathQ3([0, 1, 3]), pathQ3([0, 1, 4]));
    expect(comparison.relation).toBe("different_trajectory");
    expect(comparison.sameShape).toBe(false);
  });

  it("computes net mutation as XOR of steps equal to endpoint XOR", () => {
    const path = pathQ3([0, 4, 6, 2]); // 000 -> 100 -> 110 -> 010
    expect(netMutationQ3(path)).toBe(0 ^ 2); // source XOR target = 000 XOR 010
    expect(mutationPathQ3(path).masks).toEqual([4, 2, 4]); // 100, 010, 100
  });

  it("never lets a lossy projection decide form: groupByShape keys on shape only", () => {
    const paths = [pathQ3([0, 1, 1, 3]), pathQ3([0, 1, 3]), pathQ3([0, 2, 3])];
    const groups = groupByShape(paths);
    // [0,1,1,3] and [0,1,3] share a shape; [0,2,3] is its own group.
    expect(groups.size).toBe(2);
    expect(groups.get(shapeKey(pathQ3([0, 1, 3])))).toHaveLength(2);
  });

  it("exact path key is injective where shape key is not", () => {
    const padded = pathQ3([0, 1, 1, 3]);
    const tight = pathQ3([0, 1, 3]);
    expect(shapeKey(padded)).toBe(shapeKey(tight));
    expect(exactPathKey(padded)).not.toBe(exactPathKey(tight));
    expect(dwellSignature(padded)).not.toBe(dwellSignature(tight));
  });
});
