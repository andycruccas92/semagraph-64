# Changelog

## Unreleased

- Repositioned SemaGraph-64 as a controlled experimental platform for studying
  formally anchored knowledge under a fixed six-bit representational budget,
  while keeping the paper, general architecture and Q6 implementation distinct.
- Added a deterministic epistemic-compression benchmark covering semantic
  collisions, anchor comparison, projection distortion, decision/ranking
  preservation, provenance completeness and trajectory equivalence.
- Made the revised mathematical-anchoring paper the canonical source and aligned
  the root README and live architecture documentation with its evidence-to-
  authority pipeline, limits and research status.
- Removed remaining historical-origin language so State64/Q6 is described only
  as stipulated finite Boolean mathematics.
- Replaced the stale compiled paper artifact with the current 22-page revision
  and verified its textual and visual correspondence to the canonical source.
- Aligned the documentation with the paper's partial formalization map and its
  general computational codomain, while keeping `C_R = B^6` explicit as the
  implemented SemaGraph specialization.

## v0.8.0

- Added dependency-free `@semagraph/math-anchors` with typed mathematical-domain
  and anchor contracts, an extensible structure-kind vocabulary, structural
  validation, deterministic unit normalization, evidence requirements, immutable
  versioned registration, replay keys, and projection lineage.
- Added the authoritative `deterministic_mathematical_anchor` path upstream of
  the unchanged State64 adapter and preserved
  `deterministic_observed_parameters` as the historical compatibility mode.
- Added candidate-versus-registered authority: candidates proposed by humans,
  LLMs, or discovery processes cannot produce authoritative State64 until an
  external authority accepts an immutable validated definition.
- Added mathematical domain, anchor, registry, and anchored-state JSON schemas,
  plus deterministic TypeScript MCP tools for candidate validation,
  formalization, projection, and bit-trace inspection.
- Added property/adversarial tests for deterministic formalization/projection,
  version replay, unit/evidence/missing-data rejection, identity collisions,
  lexical collisions, and structural comparability without semantic identity.
- Added the round-7 semantic-mobility agentic benchmark and a three-domain proof
  of concept spanning an engineering state space, organizational feasibility,
  and probabilistic/information monitoring.
- Added ADRs D14–D17 and updated the formal model, architecture, tool contract,
  README, and paper with `φ_d : X_d → M_d`, `P_R : M_d → B^6`, and
  `A_{d,R} = P_R ∘ φ_d` without ontological or universality claims.
- Kept the Rust transition kernel, 64×64 basis, packed transition word, stable CLI
  JSON, and TypeScript/Rust parity fixtures unchanged.

## v0.7.0

- Added `packages/core-rs/src/tables.rs`: branchless, cache-resident classification.
  - Compile-time `const` lookup tables (`DISTANCE_BY_MASK`, `LOWER_DISTANCE_BY_MASK`, `UPPER_DISTANCE_BY_MASK`, `MODULE_SCOPE_BY_MASK`, `REGIME_BY_MASK`, and the spec-required `REGIME_BY_TRANSITION: [u8; 4096]`) built from the same `const fn` classifiers as the scalar path, so they cannot drift. Total working set 4416 bytes (L1-resident).
  - `classify_branchless` / `classify_branchless_packed`: index -> table reads -> pack, with no data-dependent branching in the hot loop. A test asserts equality with `lookup_transition64` / `pack_transition64` for all 4096 transitions.
- Added a batch / vectorizable API.
  - `classify_batch` (regime per item) and `classify_batch_full` (full struct-of-arrays metadata) over caller-provided buffers, written as flat counted loops the compiler can auto-vectorize.
  - Optional `simd` cargo feature: `classify_batch_simd` (x86_64 SSE2) with an always-correct scalar fallback and a test asserting identical output to the scalar path.
- Added `packages/core-rs/src/shapes.rs`: the Rust port of `kernel/shapes.ts` Q3 trajectory projections.
  - `project_trajectory`, `compress_trajectory_batch` (preallocated SoA outputs), and `run_collapse_into`. Run-collapse merges adjacent duplicates only; dwell is aligned to runs.
  - Added `cumulativeDistanceQ3` to `kernel/shapes.ts` as the TypeScript counterpart of the new cumulative-distance projection, so the Rust port stays parity-checked rather than diverging.
- Added the trajectory shape/projection parity fixture (`generate-shape-parity-fixture.mjs` -> `shape-parity.json`, seeded and reproducible) and the Rust integration test `shape_parity.rs` that checks the port against the TypeScript reference exactly.
- Added Criterion throughput benchmarks (`benches/throughput.rs`) for the naive, branchless, batch, SIMD, and trajectory-compression paths, wired under `[[bench]]`, with `BENCHMARKS.md` documenting how to run them and the seeds used.
- Added `docs/ARCHITECTURE.md`: the design-rationale document (six-bit alphabet, branchless/cache-resident hot path, memory hierarchy, kernel-vs-LLM division of labour, the four-level hierarchy, non-goals, future directions).
- Bumped the `semagraph-core-rs` crate to 0.7.0. The core crate has no new runtime dependencies; Criterion is a dev-dependency and SIMD is behind a feature.

- Added `packages/cli`: the `semagraph` command-line binary that consumes the kernel.
  - Subcommands: `classify`, `compress`, `compare`, `lookup`, `batch` (NDJSON in/out), and `verify` (self-test over all 4096 transitions).
  - Global flags `--json` / `--quiet` / `--version` / `--help`. Human-readable output by default; `--json` emits a stable compact-JSON contract. Data goes to stdout, errors to stderr, exit code 0 on success (2 = usage error, 1 = data error).
  - Zero third-party dependencies: argument parsing and JSON emission are hand-rolled; the only dependency is the in-repo kernel, so the release binary has no runtime dependencies.
  - Set up a Cargo workspace at `packages/Cargo.toml` (members `core-rs`, `cli`) and moved `[profile.release]` to the workspace root.
- Added LLM-facing and human-facing documentation: `TOOL_DESCRIPTION.md` (machine-readable tool contract with the collapse-factor table and exact per-subcommand I/O), a rewritten short `README.md`, an "Origin and motivation" section at the top of `docs/ARCHITECTURE.md`, and four domain worked-examples under `examples/`.
- Added `.github/workflows/release.yml`: tag-triggered (`v*`) build of static Linux (musl), macOS (x86_64 + aarch64) and Windows binaries with SHA-256 checksums attached to the GitHub release.
- Updated CI so the Rust job runs against the whole workspace (`cargo clippy --workspace`, `cargo test --workspace`) and builds the CLI release binary.
- DESIGN-NOTE: the CLI brief requested a `v0.6.3` changelog entry, but the kernel work in this delivery already opened an unreleased `v0.7.0`; to keep versions monotonic the CLI ships in the same unreleased `v0.7.0` rather than a backwards `v0.6.3`.

- Consolidated `docs/` into three authoritative files: `ARCHITECTURE.md` (prose rationale), `FORMAL-MODEL.md` (the mathematics, with short proofs of the net-mutation telescoping, run-collapse losslessness, and endpoint-soundness invariants), and `DECISIONS.md` (a single architecture decision record). Added a short `docs/README.md` index.
  - Removed the historical numbered notes (`docs/00`-`docs/09`) and the per-file ADRs (`docs/10`-`docs/15`); their content was folded into the three files above or the paper. `DECISIONS.md` records the status of every prior decision and adds the v0.7 decisions (branchless tables, batch/SIMD, Q3/T64 hierarchy, CLI, workspace, release, docs consolidation).
- Rewrote `paper/overleaf/main.tex` as an explanatory English paper with an extended Italian *sommario*, suitable both for a general overview and for evaluation by mathematicians, engineers and physicists. Recompiled to `paper/compiled/semagraph-v0.7-paper.pdf` (8 pages) and removed the superseded `semagraph-v0.6-paper.pdf`.

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
