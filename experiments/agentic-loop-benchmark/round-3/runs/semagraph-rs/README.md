# transition-matrix-profiler

Deterministic TypeScript CLI for the SemaGraph v0.7 Round 3 agentic-loop benchmark.

## Build

```sh
npm run build
```

The evaluator can also run:

```sh
node <repo>/node_modules/typescript/bin/tsc -p tsconfig.json
```

## Run

```sh
node dist/transition-matrix-profiler.js ../../fixtures/transitions.json
```

The CLI prints JSON to stdout with profiled transitions, group summaries, aggregate summaries, and requested pairwise comparisons.

## Smoke Validation

```sh
npm run smoke
```

The smoke script runs the shared fixture, writes `output.json`, invokes the Rust SemaGraph oracle as:

```sh
semagraph.exe classify <sourceNumber> <targetNumber> --json
```

and saves the per-transition oracle arguments and results under `semagraph-oracle/`.
