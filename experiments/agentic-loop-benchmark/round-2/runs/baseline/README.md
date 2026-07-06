# transition-workbench

Deterministic TypeScript CLI for Round 2 baseline transition workbench evaluation.

## Usage

```sh
npm run build
node src/transition-workbench.ts <dataset.json>
node src/transition-workbench.ts <dataset.json> --output output.json
```

`npm run build` performs no-emit TypeScript validation for this benchmark run. The package bin is named `transition-workbench` and points at the TypeScript CLI source, which runs directly on the Node 24 runtime available in this workspace.

The CLI accepts a dataset with this shape:

```json
{
  "scenarios": [{ "id": "scenario-id", "states": ["S64-000000", "S64-100000"] }],
  "comparePairs": [{ "left": "scenario-id", "right": "scenario-id" }]
}
```

## Deterministic Rules

- State ids must match `S64-[01]{6}`.
- Each scenario must contain at least 2 states.
- Adjacent mutation masks are six-bit XORs of adjacent states and are emitted as `M64-[01]{6}`.
- `netMutationMask` is the XOR of the first and last state.
- `netDistance` is the number of `1` bits in `netMutationMask`.
- `cumulativeDistance` is the sum of adjacent mutation-mask distances.
- `volatilityClass` is `calm` for cumulative distance `<= 3`, `active` for `<= 7`, and `volatile` otherwise.
- `cumulativeDistanceDelta` is `left - right`.
- `sharedChangedMaskCount` counts distinct masks shared by both compared scenarios.
- Duplicate scenario ids and unknown comparison references are rejected.

Scenario output order follows input order. Comparison output order follows `comparePairs` input order. Histogram keys are sorted lexicographically for stable JSON output. The aggregate max cumulative distance uses the first scenario in input order when distances tie.

## Smoke Test

```sh
npm run smoke
```

The smoke test typechecks the CLI, runs it, validates the output shape, and compares the common fixture stdout against `output.json`.

If `experiments/agentic-loop-benchmark/round-2/fixtures/scenarios.json` exists, the smoke test uses that common fixture. If that path is missing, the smoke test falls back to `fixtures/scenarios.local.json` and checks an exact expected result. The CLI supports `--output`, but the smoke test does not depend on subprocess artifact writes because this benchmark sandbox can reject command-created files.
