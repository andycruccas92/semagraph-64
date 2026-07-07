# Round 5: Complex Feature Rework Benchmark

Round 5 is designed to measure rework on a feature-sized agentic task, not raw
tool latency.

The feature task asks an agent to build a TypeScript CLI named
`policy-transition-workbench`. The CLI consumes multiple canonical State64
chains, computes deterministic transition and chain facts, compares scenarios,
and emits a policy-readiness workbench.

Two independent agent runs should be placed under:

```text
runs/no-mcp/
runs/rust-mcp/
```

The `no-mcp` run must not call SemaGraph packages, CLI, or MCP. The `rust-mcp`
run may use the Rust MCP server registered as `semagraph`.

## Why This Is Hard Enough

The task includes common failure points for LLM agents:

- ordered mutation masks vs net mutation mask;
- cumulative distance vs net distance;
- repeated states and zero-distance transitions;
- pairwise comparison of chains;
- canonical `S64-[01]{6}` and `M64-[01]{6}` formatting;
- policy output allowed only after deterministic compression;
- invalid-input rejection without inference.

## Run

```bash
node experiments/agentic-loop-benchmark/round-5-complex-feature-rework/scripts/evaluate.mjs
```

The evaluator writes:

- `fixtures/expected-output.json`
- `reports/latest-results.json`
- each run's `output.json` when executable

True token usage and rework are read from each run's `agent-log.json`. The
evaluator does not infer them.
