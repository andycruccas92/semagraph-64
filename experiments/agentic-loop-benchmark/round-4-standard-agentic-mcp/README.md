# Round 4: Standard Agentic Work, No MCP vs Rust MCP

This benchmark compares two operational modes on the same ordinary agentic task:

- `no-mcp`: the worker derives deterministic State64/Q6 facts with local
  JavaScript logic and does not call SemaGraph.
- `rust-mcp`: the worker launches the Rust MCP server once, calls
  `semagraph_lookup_transition64` for each transition, and then assembles the
  same report artifact.

The task is intentionally report-shaped rather than microbenchmark-shaped. Each
run produces a transition review packet with:

- per-transition deterministic facts;
- group and aggregate metrics;
- pairwise comparisons;
- action queue entries;
- concise narrative notes.

This is still not a live LLM-token benchmark. It measures the deterministic
tool boundary inside a standard agent-like workflow. Token usage and model
reasoning quality remain out of scope unless a host exports those data.

## Run

```bash
node experiments/agentic-loop-benchmark/round-4-standard-agentic-mcp/scripts/evaluate.mjs
```

Optional environment variables:

- `ROUND4_REPEATS` default `25`
- `ROUND4_WARMUPS` default `5`
- `SEMAGRAPH_MCP_BIN` optional explicit `semagraph-mcp` binary path

Outputs:

- `reports/latest-results.json`
- `reports/standard-agentic-comparison.md`
