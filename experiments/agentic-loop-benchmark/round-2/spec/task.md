# Transition Workbench Task

Build a deterministic TypeScript CLI named `transition-workbench`.

## Input

A JSON dataset:

```ts
{
  scenarios: Array<{ id: string; states: string[] }>;
  comparePairs: Array<{ left: string; right: string }>;
}
```

## Validation

- Every state id must match `S64-[01]{6}` exactly.
- Every scenario must include at least two states.
- Scenario ids must be unique non-empty strings.
- Pair references must point to known scenario ids.
- Do not infer, repair or invent states.

## Per-Scenario Output

For each scenario:

- `id`
- `sourceStateId`
- `targetStateId`
- `states`
- `transitionCount`
- `changedMasks`
- `netMutationMask`
- `cumulativeDistance`
- `netDistance`
- `volatilityClass`
- `summary`

## Aggregate Output

- `scenarioCount`
- `totalTransitions`
- `totalCumulativeDistance`
- `maxCumulativeDistanceScenarioId`
- `netMutationHistogram`

## Pairwise Comparison Output

For each requested pair:

- `left`
- `right`
- `sameNetMutationMask`
- `cumulativeDistanceDelta`
- `sharedChangedMaskCount`

## Deterministic Rules

- Adjacent mutation mask = XOR of adjacent six-bit states, emitted as `M64-[01]{6}`.
- `netMutationMask` = XOR of first and last state.
- `netDistance` = number of `1` bits in `netMutationMask`.
- `cumulativeDistance` = sum of adjacent mask distances.
- `volatilityClass` = `calm` when cumulative distance <= 3, `active` when <= 7, otherwise `volatile`.
- `sharedChangedMaskCount` = count of distinct masks appearing in both scenarios' `changedMasks`.
