# Baseline vs Rust Metrology Benchmark

This benchmark measures deterministic Q6 / State64 direct transition
classification with explicit measurement boundaries.

It does not use agent worker durations. It compares:

- `baseline-js-inprocess`: direct JavaScript computation inside the benchmark
  process. This is a lower-bound baseline, not an integration surface.
- `baseline-node-cli`: a Node.js CLI process spawned once per transition.
- `semagraph-rs-cli`: the Rust `semagraph classify <source> <target> --json`
  CLI process spawned once per transition.

The primary apples-to-apples comparison is `baseline-node-cli` vs
`semagraph-rs-cli`, because both include one process spawn per transition and
emit JSON for the same direct classification operation.

## Run

```powershell
$env:SEMAGRAPH_RS_BIN = "C:\path\to\semagraph.exe"
node experiments\agentic-loop-benchmark\metrology-baseline-vs-rust\scripts\benchmark.mjs
```

Optional environment variables:

- `METROLOGY_SAMPLE_SIZE` default `128`
- `METROLOGY_REPEATS` default `7`
- `METROLOGY_WARMUPS` default `2`
- `METROLOGY_INPROCESS_ITERATIONS` default `10000`

Outputs:

- `reports/latest-results.json`
- `reports/initial-comparison.md`

## Notes

The Rust binary is not committed. Use a published release binary or a local
Cargo build and pass it through `SEMAGRAPH_RS_BIN`.
