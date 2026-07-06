# transition-matrix-profiler

Deterministic TypeScript CLI for the SemaGraph Round 3 agentic-loop benchmark.

## Build

```sh
node ../../../../../node_modules/typescript/bin/tsc -p tsconfig.json
```

## Run

```sh
node dist/transition-matrix-profiler.js ../../fixtures/transitions.json
```

The CLI validates the dataset, profiles each direct State64 transition, emits group and aggregate histograms, and computes requested pairwise comparisons. It does not infer, repair, or invent states.

## Smoke Validation

```sh
node scripts/smoke-test.mjs
```

The smoke script calls the TypeScript SemaGraph oracle for every fixture transition:

```sh
node ../../../../../ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_lookup_transition64 <args.json>
```

It writes oracle argument/result files to `semagraph-oracle/`, writes fixture output to `output.json`, and records the run in `agent-log.json`.
