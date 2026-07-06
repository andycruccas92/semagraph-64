# Round 2: Multi-Anchor Agentic Loop Benchmark

Round 2 increases the task complexity from one transition chain to a multi-scenario
workbench with aggregate and pairwise analysis.

The comparison remains:

- `baseline`: no SemaGraph calls.
- `semagraph`: uses deterministic SemaGraph checkpoints for each scenario anchor.

## Task

Build a TypeScript CLI named `transition-workbench`.

Input dataset:

```json
{
  "scenarios": [
    { "id": "alpha", "states": ["S64-000000", "S64-100000"] }
  ],
  "comparePairs": [
    { "left": "alpha", "right": "beta" }
  ]
}
```

Output JSON must contain:

- `scenarios`
- `aggregate`
- `comparisons`

The deterministic rules are specified in `spec/task.md`.

## Evaluate

```bash
node experiments/agentic-loop-benchmark/round-2/scripts/evaluate.mjs
```

The evaluator builds both submitted programs, executes the same fixture, writes
`output.json` for each variant, and emits a JSON report with delivery, quality,
rework and token-usage fields.

The first captured comparison is in `reports/initial-comparison.md`. The default
evaluator command exits successfully after producing the comparative report; pass
`--strict` to make the command fail when any variant is incorrect.

True token usage is only reported when the agent runtime exposes it in
`agent-log.json`. Otherwise the field remains `unavailable`; the evaluator does
not invent token counts.
