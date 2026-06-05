# ADR 13 — v0.6 Rust Core Feasibility Layer

Status: accepted as feasibility layer, not yet computational authority.

## Context

SemaGraph v0.5 established State64/Q6 as a pure mathematical six-bit transition space with deterministic observed-state anchoring and chain compression. The core operations are machine-near: XOR, Hamming distance, bit splitting, lookup indexing and chain signature construction.

TypeScript remains useful for specification and integration, but it is not the ideal final substrate for a deterministic compression kernel intended for high-throughput or WASM/C ABI integration.

## Decision

Introduce `packages/core-rs` as a zero-dependency Rust feasibility crate.

The Rust core implements:

- validated six-bit states and mutation masks;
- XOR mutation;
- Hamming distance via native bit counting;
- 64 × 64 transition indexing;
- transition metadata computation;
- ordered chain compression;
- compact C ABI helpers.

Rust is not yet the authoritative runtime. It becomes eligible only after parity tests against the TypeScript reference implementation.

## Consequences

- TypeScript remains the reference/specification layer.
- Rust becomes the candidate computational layer.
- WASM/C/Python/Postgres bindings become viable future directions.
- No domain semantics or LLM inference are moved into Rust.
