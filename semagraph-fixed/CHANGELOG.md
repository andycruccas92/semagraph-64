# Changelog

## v0.6.2

- Added `packages/kernel/src/shapes.ts`: a four-level path/shape hierarchy over the Q3 alphabet.
  - Level 0 `ElementaryStateQ3` (8 states), Level 1 `EndpointTransitionT64` (oriented Q3xQ3 edge), Level 2 `PathQ3` / `MutationPathQ3` / `NormalizedPathQ3`, Level 3 declared lossy projections.
  - `CompositePointStateQ6` and `EndpointTransitionT64` are typed as distinct brands: equal cardinality (64) but opposite semantics (point vs oriented edge); they never interconvert.
  - Run-collapse normalization collapses adjacent repeats only; non-adjacent returns (e.g. `[A,B,A,D]`) stay distinct from `[A,B,D]`. A dwell vector records permanence per run so shape and dwell together reconstruct the path losslessly.
  - Lossy projections (`netMutationQ3` 8 buckets, `endpointCompression` 64 buckets, `endpointHammingDistance`) are declared with their collapse factors and used only as pre-filters; the run-collapsed shape decides form equality.
  - `compareTrajectories` cascade: differing endpoints short-circuit (equal shape forces equal endpoint, not conversely), then shape decides pattern, then dwell distinguishes duration.

## v0.6.1

- Fixed the Rust `RegimeClassCode` taxonomy to match the TypeScript reference exactly; the previous core disagreed with the reference on 1472 of 4096 transitions and lacked the `near_total_inversion` class.
- Corrected the Rust parity test, which asserted a transition index of `2730` where the arithmetic (`42 * 64 + 21`) yields `2709`.
- Added `STATE64_MODULE_SCOPE_CODE` and `STATE64_REGIME_CLASS_CODE` canonical integer encodings shared between the TypeScript reference and the Rust enum discriminants.
- Added an exhaustive parity fixture generator (`generate-parity-fixture.mjs`) emitting all 4096 transitions, and rewrote `parity.rs` as a zero-dependency, fixture-driven test that verifies every transition including the packed FFI word.
- Updated CI to compile and test the Rust crate (`cargo fmt`, `clippy`, `cargo test`) and to fail if the committed parity fixture drifts from the reference.

## v0.6.0

- Added `packages/core-rs` Rust feasibility crate for machine-near Q6 / State64 processing.
- Added zero-dependency Rust implementations for six-bit validation, XOR mutation, Hamming distance, transition indexing, transition metadata and chain compression.
- Added compact C ABI helper functions for future WASM/C/Python/Postgres integrations.
- Added TypeScript numeric parity helpers in `@semagraph/state64-adapter`.
- Added GPT/Claude-compatible AI kernel tool package under `ai-tools/semagraph-kernel-tool`.
- Added OpenAI function-tool schemas for deterministic anchoring, transition lookup, chain compression and policy context creation.
- Added Claude skill instructions that explicitly forbid LLM inference of observations or mutation of deterministic signatures.
- Added Italian Overleaf LaTeX paper explaining the theory and practice of SemaGraph v0.6.
- Added ADRs for Rust core feasibility, AI tool boundary and paper/research positioning.
- Updated workspace configuration to include `ai-tools/*` packages.

## v0.5.0

- Removed active references to inherited symbolic systems.
- Reframed State64 as pure Q6 boolean mathematics.
- Added deterministic observed-state anchoring.
- Added complete 64 × 64 transition matrix support.
- Added transition-chain compression and policy-only LLM boundary.
