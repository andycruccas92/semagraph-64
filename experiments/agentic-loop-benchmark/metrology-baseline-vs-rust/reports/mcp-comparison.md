# Rust MCP Metrology Comparison

Generated from:

```bash
node experiments/agentic-loop-benchmark/metrology-baseline-vs-rust/scripts/benchmark-mcp.mjs
```

## Method

This report measures direct Q6 / State64 transition classification through a
persistent Rust MCP stdio server. The server is initialized once, then every
measured call uses `tools/call -> semagraph_lookup_transition64`.

`baseline-node-cli` is a process-per-transition Node baseline. It is the
closest existing integration-surface baseline. `baseline-js-inprocess` is a
lower-bound compute baseline, not an agent integration surface.

## Configuration

| Field | Value |
| --- | ---: |
| Sample size | 128 |
| Repeats | 9 |
| Warmups | 3 |
| In-process iterations/repeat | 10000 |
| Node version | v24.13.0 |
| Platform | win32 x64 |
| MCP binary | C:\Dev\semagraph-64\packages\target\release\semagraph-mcp.exe |

## Results

| Measurement | Boundary | Median per call | p95 per call | MAD per call | Valid |
| --- | --- | ---: | ---: | ---: | --- |
| baseline-js-inprocess | in-process-lower-bound | 0.001088 ms | 0.001183 ms | 0.000054 ms | yes |
| baseline-node-cli | cli-per-transition | 56.708499 ms | 62.877597 ms | 2.978275 ms | yes |
| semagraph-rs-mcp | persistent-mcp-stdio-tools-call | 0.166265 ms | 0.197617 ms | 0.020963 ms | yes |

## KPI

| KPI | Value |
| --- | ---: |
| Rust MCP startup to initialize response | 4.8894 ms |
| Baseline Node CLI / Rust MCP median latency ratio | 341.07298x |
| Rust MCP median latency reduction vs Node CLI | 99.706808% |
| Rust MCP overhead vs JS in-process lower bound | 152.817096x |

## Validity

- Every measured call was checked against the deterministic reference fields.
- The MCP server was initialized once and reused across warmup and measured calls.
- Sample is stratified across mutation distances 0..6.
- Token usage is not part of this benchmark.
