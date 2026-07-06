# Round 3: Baseline vs SemaGraph TS vs SemaGraph RS

Round 3 compares three variants on the same deterministic direct-transition
classification task:

- `baseline`: no SemaGraph oracle.
- `semagraph-ts`: uses the TypeScript SemaGraph tool surface.
- `semagraph-rs`: uses the Rust `semagraph` CLI surface when available.

The task is intentionally aligned to the Rust CLI's current public contract:
classifying direct Q6 / State64 transitions. This avoids comparing TypeScript
chain compression against a different Rust operation.

## Evaluate

```bash
node experiments/agentic-loop-benchmark/round-3/scripts/evaluate.mjs
```

To enable the Rust oracle benchmark locally, point `SEMAGRAPH_RS_BIN` at a
`semagraph` binary:

```bash
SEMAGRAPH_RS_BIN=/path/to/semagraph node experiments/agentic-loop-benchmark/round-3/scripts/evaluate.mjs
```

On Windows PowerShell:

```powershell
$env:SEMAGRAPH_RS_BIN = "C:\path\to\semagraph.exe"
node experiments\agentic-loop-benchmark\round-3\scripts\evaluate.mjs
```

The evaluator writes:

- `fixtures/expected-output.json`
- `reports/initial-comparison.md`
- `reports/latest-results.json`
- `reports/oracle-benchmark.json`

True token usage is only reported when the agent runtime exposes it in
`agent-log.json`. Otherwise the field remains `unavailable`.
