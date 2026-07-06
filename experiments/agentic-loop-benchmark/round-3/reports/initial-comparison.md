# Round 3 Initial Comparison

Generated from:

```bash
SEMAGRAPH_RS_BIN=<semagraph.exe> node experiments/agentic-loop-benchmark/round-3/scripts/evaluate.mjs --strict
```

Fixture: `fixtures/transitions.json`

## Setup

Three parallel worker loops built the same TypeScript CLI,
`transition-matrix-profiler`.

- `baseline`: no SemaGraph oracle.
- `semagraph-ts`: TypeScript SemaGraph tool oracle via
  `semagraph_lookup_transition64`.
- `semagraph-rs`: Rust `semagraph` CLI oracle via
  `semagraph classify <sourceNumber> <targetNumber> --json`.

The task is direct Q6 / State64 transition classification because both the TS
tool and the current Rust CLI expose that surface cleanly.

## Agentic Results

| Metric | baseline | semagraph-ts | semagraph-rs |
| --- | ---: | ---: | ---: |
| Delivered | yes | yes | yes |
| Correct against fixture | yes | yes | yes |
| Quality score | 1.00 | 1.00 | 1.00 |
| Quality checks passed | 5 / 5 | 5 / 5 | 5 / 5 |
| Loop count | 1 | 1 | 1 |
| Rework events | 2 | 0 | 0 |
| SemaGraph oracle calls | 0 | 16 | 16 |
| Token usage | unavailable | unavailable | unavailable |

Worker `agent-log.json` files include raw start/end durations, but those values
are not used as comparative delivery-speed evidence in this report. In this run
the baseline log includes time outside the isolated experimental task, so using
that value as a headline latency metric would be misleading.

Raw, non-normalized worker-log durations were:

| Variant | Raw worker-log duration |
| --- | ---: |
| baseline | 294.293 s |
| semagraph-ts | 2.527 s |
| semagraph-rs | 0.238 s |

These values are retained as provenance only. The current sub-agent runtime does
not expose authoritative host-level wall-clock or token usage.

## Oracle Runtime Benchmark

The evaluator also ran the TS and RS oracle surfaces directly over the same 16
transitions, repeated 3 times.

| Runtime | Calls | Total duration | Average per call | Correct |
| --- | ---: | ---: | ---: | --- |
| semagraph-ts | 48 | 3869.242 ms | 80.609 ms | yes |
| semagraph-rs | 48 | 384.674 ms | 8.014 ms | yes |

On this run the Rust CLI surface was about 10.06x faster per oracle call than the
TypeScript CLI surface, a 90.1% lower average per-call time.

This measures published tool surfaces, not pure in-process kernel time:

- TS surface: `node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_lookup_transition64 <args.json>`.
- RS surface: `semagraph classify <sourceNumber> <targetNumber> --json`.

## Interpretation

Round 3 removes the quality gap seen in Round 2: all three implementations
matched the deterministic expected output.

The useful latency signal is the isolated oracle microbenchmark, not the raw
worker-log duration. When the task is aligned to direct Q6 transition
classification, the Rust oracle is materially cheaper than the TS oracle in
per-call latency. That supports the hypothesis that TS process/tool overhead was
a large part of the Round 2 latency story, while still keeping the TypeScript
layer as the reference API/schema/integration surface.

Token consumption remains unavailable. The benchmark keeps `tokenUsage` fields
in every `agent-log.json` so real usage can be attached later when the host
runtime exposes it.
