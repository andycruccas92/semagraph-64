# Agentic Loop Benchmark

This experiment compares two agentic loops building the same small program:

- `baseline`: builds from the written task only.
- `semagraph`: uses the deterministic SemaGraph tool boundary as a planning/checkpoint oracle.

The benchmark is intentionally small. It is meant to measure whether deterministic transition
compression reduces ambiguity, rework and delivery time in background reasoning loops.

## Task

Build a TypeScript CLI named `transition-audit`.

Input: a JSON file containing an ordered list of canonical State64 ids:

```json
["S64-000000", "S64-100000", "S64-101000", "S64-101010"]
```

Output JSON must include:

- `sourceStateId`
- `targetStateId`
- `states`
- `transitionCount`
- `changedMasks`
- `netMutationMask`
- `cumulativeDistance`
- `summary`

State ids must validate exactly as `S64-[01]{6}`. Mutation masks must use `M64-[01]{6}`.
No observations may be inferred.

## Variants

The baseline loop must not call SemaGraph tools, packages or CLI.

The SemaGraph loop may call the local deterministic tool as an oracle/checkpoint, for example:

```bash
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 <args.json>
```

## Metrics

`scripts/evaluate.mjs` builds each run, executes the shared fixture, writes each
run's `output.json`, and reports:

- delivery status
- output correctness against `fixtures/expected-output.json`
- loop count
- rework events
- declared tool use
- duration from `agent-log.json`

Token usage is not inferred by the script. If the host can export token usage,
add it to each `agent-log.json` as `tokenUsage`.

## Run Layout

Each variant writes only under:

```text
runs/baseline/
runs/semagraph/
```

Each run should include:

- implementation files
- `README.md`
- `agent-log.json`
- `output.json` for the common fixture

## Evaluate

```bash
node experiments/agentic-loop-benchmark/scripts/evaluate.mjs
```

The first captured comparison is in `reports/initial-comparison.md`.
