import type { BinaryState64, State64CatalogEntry, State64Id } from "./types.js";
import { getState64ById } from "./catalog.js";
import { hammingDistance64 } from "./hypercube.js";

function resolveState(input: BinaryState64 | State64CatalogEntry | State64Id): BinaryState64 | State64CatalogEntry {
  return typeof input === "string" ? getState64ById(input) : input;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`Cannot compare strings with different lengths: ${a.length} and ${b.length}`);
  }

  return [...a].reduce((distance, char, index) => distance + (char === b[index] ? 0 : 1), 0);
}

export function state64BitDistance(a: BinaryState64 | State64CatalogEntry | State64Id, b: BinaryState64 | State64CatalogEntry | State64Id): number {
  const stateA = resolveState(a);
  const stateB = resolveState(b);
  return hammingDistance64(stateA, stateB);
}

export function sharedModuleScore(a: BinaryState64 | State64CatalogEntry | State64Id, b: BinaryState64 | State64CatalogEntry | State64Id): number {
  const stateA = resolveState(a);
  const stateB = resolveState(b);

  let score = 0;
  if (stateA.lowerModule.join("") === stateB.lowerModule.join("")) score += 1;
  if (stateA.upperModule.join("") === stateB.upperModule.join("")) score += 1;
  return score;
}

export function simpleStateSimilarity(a: BinaryState64 | State64CatalogEntry | State64Id, b: BinaryState64 | State64CatalogEntry | State64Id): number {
  const distance = state64BitDistance(a, b);
  const moduleScore = sharedModuleScore(a, b);
  const bitScore = 1 - distance / 6;
  return Number((0.75 * bitScore + 0.25 * (moduleScore / 2)).toFixed(4));
}
