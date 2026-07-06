# transition-workbench

`transition-workbench` is a deterministic TypeScript CLI for SemaGraph State64 scenario datasets.

It accepts a JSON file with this shape:

```json
{
  "scenarios": [{ "id": "example", "states": ["S64-000000", "S64-100000"] }],
  "comparePairs": [{ "left": "example", "right": "example" }]
}
```

It writes JSON to stdout with `scenarios`, `aggregate`, and `comparisons`.

## Deterministic Rules

- State ids must match `S64-[01]{6}` exactly.
- Scenario chains must contain at least two states.
- Scenario output includes the original canonical `states` chain.
- Adjacent mutation masks are XORs of adjacent state bits and are emitted as `M64-[01]{6}`.
- Net mutation masks are XORs of first and last state bits.
- `cumulativeDistance` is the sum of adjacent mask distances.
- `netDistance` is the number of set bits in the net mutation mask.
- Volatility is `calm` for cumulative distance `<= 3`, `active` for `<= 7`, and `volatile` otherwise.
- Comparison distance deltas are absolute differences.
- Unknown comparison ids, duplicate scenario ids, malformed states, and short chains are rejected.

No observations are inferred or repaired.

## Usage

```bash
npm run build
node dist/transition-workbench.js fixtures/smoke-scenarios.json
```

After package linking or installation, the binary name is:

```bash
transition-workbench fixtures/smoke-scenarios.json
```

## Smoke Test

```bash
npm run smoke
```

The shared fixture is `experiments/agentic-loop-benchmark/round-2/fixtures/scenarios.json`. `output.json` records the CLI output for that dataset. The included smoke fixture remains under `fixtures/smoke-scenarios.json`.

During the loop, SemaGraph deterministic oracle calls were made for each common scenario:

```bash
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 experiments/agentic-loop-benchmark/round-2/runs/semagraph/semagraph-oracle/alpha.args.json
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 experiments/agentic-loop-benchmark/round-2/runs/semagraph/semagraph-oracle/beta.args.json
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 experiments/agentic-loop-benchmark/round-2/runs/semagraph/semagraph-oracle/gamma.args.json
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 experiments/agentic-loop-benchmark/round-2/runs/semagraph/semagraph-oracle/delta.args.json
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 experiments/agentic-loop-benchmark/round-2/runs/semagraph/semagraph-oracle/zeta.args.json
```
