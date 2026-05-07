import type { State64, State64Id } from "./types.js";
import { getState64ById } from "./hexagrams.js";

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`Cannot compare strings with different lengths: ${a.length} and ${b.length}`);
  }

  return [...a].reduce((distance, char, index) => distance + (char === b[index] ? 0 : 1), 0);
}

export function state64LineDistance(a: State64 | State64Id, b: State64 | State64Id): number {
  const stateA = typeof a === "string" ? getState64ById(a) : a;
  const stateB = typeof b === "string" ? getState64ById(b) : b;
  return hammingDistance(stateA.binary, stateB.binary);
}

export function sharedTrigramScore(a: State64 | State64Id, b: State64 | State64Id): number {
  const stateA = typeof a === "string" ? getState64ById(a) : a;
  const stateB = typeof b === "string" ? getState64ById(b) : b;

  let score = 0;
  if (stateA.lowerTrigramId === stateB.lowerTrigramId) score += 1;
  if (stateA.upperTrigramId === stateB.upperTrigramId) score += 1;
  return score;
}

export function simpleStateSimilarity(a: State64 | State64Id, b: State64 | State64Id): number {
  const distance = state64LineDistance(a, b);
  const trigramScore = sharedTrigramScore(a, b);
  const lineScore = 1 - distance / 6;
  return Number((0.75 * lineScore + 0.25 * (trigramScore / 2)).toFixed(4));
}
