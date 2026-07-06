# Baseline vs Rust Metrology Comparison

Generated from:

```bash
SEMAGRAPH_RS_BIN=<semagraph.exe> node experiments/agentic-loop-benchmark/metrology-baseline-vs-rust/scripts/benchmark.mjs
```

## Method

This report does not use agent-loop wall-clock durations. It measures direct Q6
transition classification with warmups and repeated samples.

Primary comparison: `baseline-node-cli` vs `semagraph-rs-cli`.
Both spawn one CLI process per transition and emit JSON for the same
classification operation.

`baseline-js-inprocess` is retained only as a lower-bound computation baseline;
it is not an integration-surface equivalent to Rust CLI.

## Configuration

| Field | Value |
| --- | ---: |
| Sample size | 128 |
| Repeats | 7 |
| Warmups | 2 |
| In-process iterations/repeat | 10000 |
| Node version | v24.13.0 |
| Platform | win32 x64 |

## Results

| Measurement | Boundary | Median per call | p95 per call | MAD per call | Valid |
| --- | --- | ---: | ---: | ---: | --- |
| baseline-js-inprocess | in-process-lower-bound | 0.000028 ms | 0.000031 ms | 0.000001 ms | yes |
| baseline-node-cli | cli-per-transition | 58.784613 ms | 64.986551 ms | 2.031493 ms | yes |
| semagraph-rs-cli | cli-per-transition | 12.50499 ms | 14.087407 ms | 0.289972 ms | yes |

## Interpretation

At the comparable CLI boundary, Rust was 4.70x faster than the Node baseline by
median per-call latency, a 78.7% lower median per-call time.

The in-process JavaScript baseline is much faster than either CLI surface, which
confirms that process startup and JSON command boundaries dominate small single
transition calls. A future Rust batch or embedded binding would be the right
surface for measuring Rust kernel cost without per-call process overhead.

## Validity

- Baseline CLI and Rust CLI outputs were validated against the same deterministic
  reference for every measured transition.
- Rust `verify --json` result: {"available":true,"verified":4096,"total":4096,"ok":true}.
- Sample is stratified across mutation distances 0..6.
- Token usage is not part of this benchmark.
