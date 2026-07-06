# Round 3 Initial Comparison

Generated from:

```bash
SEMAGRAPH_RS_BIN=<semagraph.exe> node experiments/agentic-loop-benchmark/round-3/scripts/evaluate.mjs
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
| Agent-log duration | 294.293 s | 2.527 s | 0.284 s |
| Loop count | 1 | 1 | 1 |
| Rework events | 2 | 0 | 0 |
| SemaGraph oracle calls | 0 | 16 | 16 |
| Token usage | unavailable | unavailable | unavailable |

Agent-log durations are reported from each worker's own `agent-log.json`. The
current sub-agent runtime does not expose authoritative host-level wall-clock or
token usage, so these timings are useful but not billing-grade telemetry.

## Oracle Runtime Benchmark

The evaluator also ran the TS and RS oracle surfaces directly over the same 16
transitions, repeated 3 times.

| Runtime | Calls | Total duration | Average per call | Correct |
| --- | ---: | ---: | ---: | --- |
| semagraph-ts | 48 | 4750.422 ms | 98.967 ms | yes |
| semagraph-rs | 48 | 490.063 ms | 10.210 ms | yes |

On this run the Rust CLI surface was about 9.69x faster per oracle call than the
TypeScript CLI surface, an 89.7% lower average per-call time.

This measures published tool surfaces, not pure in-process kernel time:

- TS surface: `node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_lookup_transition64 <args.json>`.
- RS surface: `semagraph classify <sourceNumber> <targetNumber> --json`.

## Interpretation

Round 3 removes the quality gap seen in Round 2: all three implementations
matched the deterministic expected output.

The useful signal is runtime cost. When the task is aligned to direct Q6
transition classification, the Rust oracle is materially cheaper than the TS
oracle in per-call latency. That supports the hypothesis that TS process/tool
overhead was a large part of the Round 2 latency story, while still keeping the
TypeScript layer as the reference API/schema/integration surface.

Token consumption remains unavailable. The benchmark keeps `tokenUsage` fields
in every `agent-log.json` so real usage can be attached later when the host
runtime exposes it.
