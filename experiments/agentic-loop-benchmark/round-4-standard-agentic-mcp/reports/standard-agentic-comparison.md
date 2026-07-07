# Round 4 Standard Agentic Work Comparison

Generated from:

```bash
node experiments/agentic-loop-benchmark/round-4-standard-agentic-mcp/scripts/evaluate.mjs
```

## Task

Build a transition review packet from the same State64 work items: deterministic
facts, group aggregates, pairwise comparisons, action queue, and narrative notes.

## Results

| Variant | Boundary | Authority | Median full task | Median fact phase | Valid |
| --- | --- | --- | ---: | ---: | --- |
| no-mcp | scripted-worker-no-mcp | local-js-rules | 0.0583 ms | 0.0143 ms | yes |
| rust-mcp | persistent-mcp-tools-call | semagraph-rs-mcp | 3.0276 ms | 2.9667 ms | yes |

## KPI

| KPI | Value |
| --- | ---: |
| Rust MCP startup to initialize response | 7.6899 ms |
| Rust MCP tool calls per task | 16 |
| Median overhead vs no-MCP scripted worker | 2.9693 ms |
| Median full-task latency ratio | 51.931389x |

## Interpretation

The no-MCP worker is faster because it computes the known math in-process. That
is expected and is not an agent-realistic authority boundary. The Rust MCP worker
adds a small absolute overhead while externalizing deterministic facts through a
replayable MCP tool surface that an LLM agent can use without modifying states,
observations, masks, or signatures.

This benchmark does not infer token usage or live LLM reasoning quality.
