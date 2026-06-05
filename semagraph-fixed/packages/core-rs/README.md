# SemaGraph Core RS

Rust feasibility implementation for the deterministic Q6 / State64 computational core.

This crate deliberately has no external dependencies. It models the 64-state boolean space as six-bit `u8` values and exposes direct operations for mutation, distance, transition indexing and chain compression. It is intended to become the computational authority only after parity tests against the TypeScript reference implementation are accepted.

Current scope:

- six-bit state and mutation validation;
- XOR mutation;
- Hamming distance via native bit counting;
- direct 64 × 64 transition indexing;
- transition metadata computation;
- ordered chain compression;
- compact C ABI helpers for future WASM/C/Python/Postgres integration.

Not in scope:

- domain interpretation;
- LLM inference;
- policy synthesis;
- statistical modeling;
- simulation solvers.

Build locally, when Rust is available:

```bash
cargo test
cargo build --release
```
