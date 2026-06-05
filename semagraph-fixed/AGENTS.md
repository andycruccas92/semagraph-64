# AGENTS — SemaGraph v0.6

## Operating boundary

SemaGraph v0.6 is a deterministic observed-state anchoring and transition-chain compression kernel. Do not reintroduce symbolic lineage terminology. Treat State64/Q6 as pure finite boolean mathematics.

## Development rules

- Do not infer observations.
- Do not allow LLMs to assign states unless explicitly working in a non-authoritative experiment.
- Deterministic anchor rules must be versioned and replayable.
- State64 ids must remain canonical: `S64-[01]{6}`.
- Mutation masks must remain canonical: `M64-[01]{6}`.
- The 64 × 64 direct transition basis must remain complete and deterministic.
- Rust core is a feasibility layer until parity with TypeScript is accepted.
- TypeScript remains the reference layer for API, schema and integration.

## Tooling rules

- The AI kernel tool may expose deterministic processing to Claude/GPT.
- The model may synthesize policy only after deterministic transition compression.
- The model must not modify states, observations, masks or signatures.

## Validation

Run TypeScript typechecks before handoff. If Rust is installed, run `cargo test` in `packages/core-rs`. If pnpm is installed, run workspace typechecks and tests.
