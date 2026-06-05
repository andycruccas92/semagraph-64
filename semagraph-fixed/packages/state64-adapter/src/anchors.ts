import type { AnchoredObservedState64, ObservedAnchorInput, ObservedMeasurement } from "./types.js";
import { encodeParameterSnapshotToState64 } from "./encoding.js";

export function measurementsToParameterSnapshot(measurements: readonly ObservedMeasurement[]): Record<string, ObservedMeasurement["value"]> {
  const snapshot: Record<string, ObservedMeasurement["value"]> = {};
  for (const measurement of measurements) {
    if (!measurement.key.trim()) throw new Error("Observed measurement key must not be empty.");
    if (Object.prototype.hasOwnProperty.call(snapshot, measurement.key)) {
      throw new Error(`Duplicate observed measurement key: ${measurement.key}`);
    }
    snapshot[measurement.key] = measurement.value;
  }
  return snapshot;
}

export function anchorObservedMeasurementsToState64(input: ObservedAnchorInput): AnchoredObservedState64 {
  const parameters = measurementsToParameterSnapshot(input.measurements);
  const encoded = encodeParameterSnapshotToState64(input.definition, parameters);
  return {
    ...encoded,
    measurements: input.measurements,
    anchorMode: "deterministic_observed_parameters",
    ...(input.anchorRuleVersion ? { anchorRuleVersion: input.anchorRuleVersion } : {})
  };
}
