import type { ParameterSnapshot, WeightedParameter } from "./types.js";

export function weightedSnapshotSimilarity(
  left: ParameterSnapshot,
  right: ParameterSnapshot,
  parameters: readonly WeightedParameter[]
): number {
  const totalWeight = parameters.reduce((sum, parameter) => sum + parameter.weight, 0);
  if (totalWeight <= 0) throw new Error("Similarity requires a positive total weight.");

  const matchedWeight = parameters.reduce((sum, parameter) => {
    return sum + (left[parameter.parameterKey] === right[parameter.parameterKey] ? parameter.weight : 0);
  }, 0);
  return Number((matchedWeight / totalWeight).toFixed(4));
}
