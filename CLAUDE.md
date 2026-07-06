# CLAUDE.md

Guidance for Claude Code (and compatible agents) working in this repository.
The canonical project rules live in [`AGENTS.md`](./AGENTS.md); this file adds the
concrete commands and layout. When the two overlap, `AGENTS.md` wins.

## What this project is

SemaGraph is a deterministic, dependency-free kernel for anchoring observed
states and compressing state-transition trajectories over a six-bit state
alphabet (64 states, 4096 transitions). It computes structural facts; it does
**not** infer, interpret, or predict.

- **TypeScript is the reference layer** for API, schema, and integration.
- **Rust is the feasibility/performance core**, held at parity with the TS
  reference by golden fixtures checked in CI.

## Repository layout

```
packages/kernel           TypeScript reference kernel  (@semagraph/kernel, published to npm)
packages/state64-adapter  State64/Q6 adapter + parity-fixture generators
packages/renderer-svg      SVG renderer
packages/core-rs          Rust core            (semagraph-core-rs, crates.io)
packages/cli              Rust CLI             (semagraph, crates.io)
schemas/                  JSON Schemas for models, policies, trajectories
examples/                 Worked examples
docs/                     Architecture, decisions, formal model
ai-tools/                 Agent-facing tool wrapper (Claude skill + OpenAI tools)
```

## Commands

TypeScript workspace (pnpm 9):

```bash
pnpm install
pnpm -r build        # build all packages
pnpm -r typecheck    # type-only check
pnpm -r test         # vitest across the workspace
```

Rust core + CLI (run from `packages/`):

```bash
cd packages
cargo build --release -p semagraph        # binary: packages/target/release/semagraph
cargo test --workspace                    # unit + TS<->Rust parity tests
cargo test -p semagraph-core-rs --features simd
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

Parity fixtures are generated from the TypeScript reference and must not drift:

```bash
node packages/state64-adapter/scripts/generate-parity-fixture.mjs
node packages/state64-adapter/scripts/generate-shape-parity-fixture.mjs
# CI fails if the committed fixtures differ from the regenerated output.
```

## Hard rules for agents

- Do not infer or assign observed State64 values through a language model on the
  canonical path. Anchors come from declared parameters or observed measurements.
- Do not modify states, observations, masks, or signatures. Policy may only be
  synthesized *after* deterministic transition compression.
- No lossy projection (net mutation, endpoint code, Hamming distance) may serve
  as a form-identity key; only the run-collapsed shape decides form equality.
- Keep State64 ids canonical (`S64-[01]{6}`) and mutation masks canonical
  (`M64-[01]{6}`). Keep the 64×64 transition basis complete and deterministic.
- No network access, persistence, or provider runtimes in the kernel.

## Before handing off

Run TypeScript typechecks and tests. If Rust is installed, run `cargo test` and
`cargo clippy`. Never commit `node_modules/`, `dist/`, or `target/` (all
git-ignored).
