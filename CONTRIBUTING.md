# Contributing to SemaGraph

Thanks for your interest in contributing. SemaGraph is a deterministic kernel, so
the bar for changes is correctness and reproducibility, not features.

## Ground rules

- The kernel computes structural facts; it does not infer, interpret, or predict.
  Keep that boundary.
- TypeScript (`packages/kernel`) is the reference implementation. The Rust core
  (`packages/core-rs`) must stay at parity with it — enforced by golden fixtures.
- No runtime dependencies, no network access, no persistence in the kernel.
- No lossy projection may be used as a form-identity key (see `packages/kernel/src/shapes.ts`).

## Development setup

TypeScript (requires Node 22 and pnpm 9):

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

Rust (optional, requires a stable toolchain):

```bash
cd packages
cargo test --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

## If you change trajectory or transition semantics

Regenerate the parity fixtures from the TypeScript reference and commit them:

```bash
node packages/state64-adapter/scripts/generate-parity-fixture.mjs
node packages/state64-adapter/scripts/generate-shape-parity-fixture.mjs
```

CI regenerates these and fails if the committed fixtures differ, so the Rust core
can never silently diverge from the reference.

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused; add or update tests for any behavioural change.
3. Ensure `pnpm -r typecheck`, `pnpm -r test`, and (if Rust is touched)
   `cargo test --workspace` all pass locally.
4. Describe the change and its parity implications in the PR body.

## Reporting bugs

Open an issue at https://github.com/andycruccas92/semagraph/issues with a minimal
reproduction (the input trajectory or parameters, expected vs actual output).

## License

By contributing you agree that your contributions are licensed under the
[Apache-2.0](./LICENSE) license.
