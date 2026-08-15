# Validation

## v0.8 generated validation

Environment:

- Node.js, pnpm, TypeScript, Vitest, and Rust/Cargo were available.
- pdfLaTeX was not installed, so `paper/overleaf/main.tex` was updated and
  cross-checked as source but no v0.8 compiled PDF was generated locally.

Executed checks:

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
npx tsc -p tsconfig.validation.json --noEmit
node experiments/agentic-loop-benchmark/round-7-semantic-mobility/scripts/evaluate.mjs
cd packages
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Results:

- 46 TypeScript tests passed: kernel 19, mathematical anchors 9, State64 adapter
  13, renderer 2, and TypeScript AI tool 3.
- The new semantic-mobility benchmark passed all 8 adversarial cases.
- All 11 JSON schemas parsed, and the AI tool manifest exposed 8 unique tools,
  including all 4 mathematical-anchor operations.
- Rust formatting and Clippy passed. Rust unit, exhaustive 4096-transition parity,
  and trajectory shape-parity tests all passed.
- The Rust transition basis, packed transition contract, and parity fixtures were
  not changed by v0.8.

## v0.6 generated validation

Environment constraints:

- Node.js was available.
- TypeScript compiler was available.
- pdfLaTeX was available and the Overleaf paper compiled successfully.
- Rust/Cargo were not available in the container, so Rust source was not compiled locally.
- `pnpm` was not available in the container.

Executed checks:

```bash
tsc -p packages/kernel/tsconfig.json --noEmit
tsc -p packages/state64-adapter/tsconfig.json --noEmit
tsc -p packages/renderer-svg/tsconfig.json --noEmit
tsc -p tsconfig.validation.json --noEmit
node packages/state64-adapter/scripts/generate-parity-fixture.mjs
cd paper/overleaf && pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

The TypeScript adapter test suite (9 tests) passed and the exhaustive parity
fixture covering all 4096 transitions was generated from the reference
implementation. The corrected Rust classification algorithm was checked against
that fixture and matches on all 4096 transitions, including the packed FFI word.

Expected external checks when Rust and pnpm are available:

```bash
cd packages/core-rs && cargo test
pnpm install
pnpm -r typecheck
pnpm -r test
```

## v0.7 generated validation

Environment constraints (authoring sandbox):

- Node.js and `pnpm` (via Corepack) were available; the full TypeScript suite ran.
- Rust/Cargo were not available, and the package registry needed for the Criterion
  dev-dependency was unreachable, so the Rust crate and benchmarks were not
  compiled or run in this environment. The Rust sources were authored and their
  logic cross-checked against the TypeScript-generated fixtures (see below).

Executed checks:

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
node packages/state64-adapter/scripts/generate-parity-fixture.mjs
node packages/state64-adapter/scripts/generate-shape-parity-fixture.mjs
```

The kernel suite (18 tests, including the new `cumulativeDistanceQ3` test) and the
adapter suite passed. Both parity fixtures regenerate byte-identical to the
committed copies. Because a Rust toolchain was unavailable, the new branchless
table logic and the Q3 shapes port were additionally re-implemented in Node and
checked against the authoritative fixtures: all 4096 transitions matched
(`transition-parity.json`, including the packed FFI word and `REGIME_BY_TRANSITION`)
and all 250 trajectory projections matched (`shape-parity.json`).

Expected external checks when Rust is available:

```bash
cd packages/core-rs
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
cargo test --features simd      # runs the SIMD == scalar equality test
cargo build --benches
cargo bench                     # then record results in BENCHMARKS.md
```

New Rust tests added in v0.7:

- `tables::tests::branchless_matches_naive_for_all_transitions` — branchless path
  equals `lookup_transition64` / `pack_transition64` for all 4096 transitions.
- `tables::tests::batch_matches_per_item` — batch SoA output equals per-item.
- `tables::simd_tests::simd_matches_scalar` (with `--features simd`).
- `shapes::tests::*` — run-collapse, projections, batch, and `run_collapse_into`.
- `shape_parity.rs` — exhaustive shape/projection parity against the TypeScript
  reference fixture.

## Corrected discrepancies (parity hardening)

The following defects were present in the first v0.6 cut and have been fixed:

- The Rust `RegimeClassCode` taxonomy did not match the TypeScript reference.
  The old Rust code lacked a `near_total_inversion` class and routed every
  single-module transition to intra-module reconfiguration regardless of
  distance, disagreeing with the reference on 1472 of 4096 transitions. The Rust
  `regime_class_from_distances` function now mirrors the TypeScript
  `classifyRegimeClass` branch order exactly.
- The Rust parity test asserted `transition_index64(0b101010, 0b010101) == 2730`.
  The correct value is `42 * 64 + 21 = 2709`, matching the TypeScript reference.
  The assertion has been corrected.
- Module-scope and regime-class integer encodings are now defined once in
  `STATE64_MODULE_SCOPE_CODE` / `STATE64_REGIME_CLASS_CODE` (TypeScript) and
  reproduced by the Rust enum discriminants, so parity is checked on integers.

## Rust parity target

Parity is verified exhaustively, not by sampling. The TypeScript reference
generates `packages/core-rs/tests/fixtures/transition-parity.json`, describing
all 4096 transitions with canonical integer codes and the packed FFI word. The
Rust integration test `parity.rs` loads this fixture and asserts the Rust core
reproduces every entry exactly. CI regenerates the fixture from the reference and
fails if the committed copy has drifted. Required parity dimensions:

- state id ↔ numeric conversion;
- mutation mask conversion;
- XOR mutation;
- Hamming distance;
- transition index;
- transition metadata;
- ordered chain compression;
- C ABI packed transition output.

## AI tool boundary validation

The AI tool schemas should be reviewed to ensure:

- exactly six observations are required for deterministic anchoring;
- state ids must match `S64-[01]{6}`;
- chains require at least two states;
- the policy context tool cannot mutate states or signatures;
- LLM use is restricted to policy synthesis and explanation.
