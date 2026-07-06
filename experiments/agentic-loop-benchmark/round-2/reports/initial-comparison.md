# Round 2 Initial Comparison

Generated from:

```bash
node experiments/agentic-loop-benchmark/round-2/scripts/evaluate.mjs
```

Fixture: `fixtures/scenarios.json`

## Setup

Two parallel worker loops built the same TypeScript CLI, `transition-workbench`.

- `baseline`: no SemaGraph tool, package, CLI or MCP usage.
- `semagraph`: deterministic SemaGraph checkpoints for the five scenario anchors:
  `alpha`, `beta`, `gamma`, `delta` and `zeta`.

Both submitted programs were built and executed by the same evaluator against the
same fixture. The evaluator computes the expected output independently from the
fixture using finite six-bit XOR and bit counts.

## Results

| Metric | baseline | semagraph |
| --- | ---: | ---: |
| Delivered | yes | yes |
| Correct against fixture | no | yes |
| Quality score | 0.50 | 1.00 |
| Quality checks passed | 2 / 4 | 4 / 4 |
| Delivery duration | 430.722 s | 1314.775 s |
| Loop count | 1 | 5 |
| Rework events | 2 | 5 |
| SemaGraph oracle calls | 0 | 5 |
| Token usage | unavailable | unavailable |

## Quality Checks

| Check | baseline | semagraph |
| --- | --- | --- |
| `scenarios` | fail | pass |
| `aggregate` | pass | pass |
| `comparisons` | fail | pass |
| `scenarioSummaries` | pass | pass |

The baseline failure is a real spec miss, not a harness failure:

- scenario rows omit the required `states` field;
- two pairwise comparisons report signed `cumulativeDistanceDelta` values instead
  of absolute deltas.

The aggregate result is counted as passing after semantic JSON comparison; object
key order is intentionally ignored.

## Interpretation

This round does not show a speed win for SemaGraph. The SemaGraph-assisted loop
took 884.053 s longer than the baseline, about 3.05x the baseline duration.

It does show a quality/correctness win on the more complex multi-anchor task:
the baseline delivered faster but missed two required output surfaces, while the
SemaGraph-assisted run delivered the full expected output and recorded one
deterministic checkpoint per scenario anchor.

Token consumption is not available from the current sub-agent runtime. The
benchmark keeps `tokenUsage` fields in `agent-log.json` and reports
`tokenUsageAvailable: false` until the host exposes real usage data.

## Repro Notes

The default evaluator command exits successfully after producing the comparative
report. Use strict mode when a nonzero exit code is desired if any variant is
incorrect:

```bash
node experiments/agentic-loop-benchmark/round-2/scripts/evaluate.mjs --strict
```
