# transition-matrix-profiler

Deterministic TypeScript CLI for the SemaGraph Round 3 baseline agentic-loop benchmark.

The profiler reads a JSON dataset, validates the written task constraints, and computes finite six-bit transition profiles directly from the state strings. It does not use any SemaGraph tool, package, CLI, MCP server, or Rust binary.

## Build

```sh
node ../../../../../node_modules/typescript/bin/tsc -p tsconfig.json
```

## Run

```sh
node dist/transition-matrix-profiler.js ../../fixtures/transitions.json
```

The CLI prints JSON to stdout. Invalid input prints an error to stderr and exits with a non-zero status.

## Smoke Validation

```sh
npm run smoke
```

The smoke script runs the compiled CLI against the shared fixture, checks key deterministic totals, and writes `output.json`.
