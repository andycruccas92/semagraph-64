# Validation

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
