# Validation

Validation performed in the execution container after adding the canonical Wilhelm/Baynes symbol layer.

Passed:

```bash
tsc -p packages/core/tsconfig.json --noEmit
tsc -p packages/renderer-svg/tsconfig.json --noEmit
```

Not executed in this container:

```bash
pnpm install
pnpm test
pnpm build
```

Reason: the execution environment has no network access for dependency installation. The repository includes Vitest tests and CI configuration; run the full commands after pushing to GitHub or after installing dependencies locally.
