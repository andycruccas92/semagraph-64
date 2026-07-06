# Transition Matrix Profiler Task

Build a deterministic TypeScript CLI named `transition-matrix-profiler`.

## Input

A JSON dataset:

```ts
{
  transitions: Array<{
    id: string;
    sourceStateId: string;
    targetStateId: string;
    groupId: string;
  }>;
  groups: Array<{ id: string; transitionIds: string[] }>;
  comparePairs: Array<{ left: string; right: string }>;
}
```

## Validation

- Every state id must match `S64-[01]{6}` exactly.
- Transition ids and group ids must be unique non-empty strings.
- Every transition `groupId` must point to a known group.
- Every group transition id and comparison reference must point to a known transition.
- Do not infer, repair or invent states.

## Per-Transition Output

For each transition:

- `id`
- `sourceStateId`
- `targetStateId`
- `groupId`
- `mutationMask`
- `changedPositions`
- `distance`
- `lowerDistance`
- `upperDistance`
- `moduleScope`
- `regimeClass`
- `transitionIndex`
- `summary`

## Group Output

For each group:

- `id`
- `transitionCount`
- `totalDistance`
- `averageDistance`
- `maxDistance`
- `maxDistanceTransitionIds`
- `regimeHistogram`
- `moduleScopeHistogram`

## Aggregate Output

- `transitionCount`
- `totalDistance`
- `averageDistance`
- `maxDistance`
- `maxDistanceTransitionIds`
- `regimeHistogram`
- `moduleScopeHistogram`
- `mutationMaskHistogram`

## Pairwise Comparison Output

For each requested pair:

- `left`
- `right`
- `sameMutationMask`
- `sameRegimeClass`
- `sameModuleScope`
- `distanceDelta`
- `sharedChangedPositionCount`

## Deterministic Rules

- `mutationMask` = XOR of source and target, emitted as `M64-[01]{6}`.
- `changedPositions` = one-based positions of `1` bits in mutation-mask order.
- `distance` = number of changed positions.
- `lowerDistance` = number of changed bits in positions 1..3.
- `upperDistance` = number of changed bits in positions 4..6.
- `moduleScope`:
  - `none` when both distances are zero.
  - `lower_only` when only `lowerDistance` is nonzero.
  - `upper_only` when only `upperDistance` is nonzero.
  - `both_modules` when both are nonzero.
- `regimeClass`:
  - `no_change` when distance is 0.
  - `bit_adjustment` when distance is 1.
  - `module_reconfiguration` when distance <= 2 and `moduleScope` is not `both_modules`.
  - `full_bit_reversal` when distance is 6.
  - `near_total_inversion` when distance >= 4.
  - `cross_module_regime_shift` otherwise.
- `transitionIndex` = `sourceNumber * 64 + targetNumber`, where numbers are the six-bit binary values.
- `distanceDelta` = `left.distance - right.distance` for each requested comparison.
- Averages are numbers rounded to three decimal places.
