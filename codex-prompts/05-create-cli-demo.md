# Codex task 05 — Create CLI demo

## Goal

Create a minimal CLI demo that renders a state and shows transformations.

## Scope

- Add `packages/cli` or `apps/cli`.
- Command examples:
  - `semagraph render --state S64-000000`
  - `semagraph transform --state S64-000000 --moving 1,3`
  - `semagraph inspect --state S64-101010`
- Output SVG to stdout or file.

## Constraints

- Keep dependencies minimal.
- CLI should use `@semagraph/core` and `@semagraph/renderer-svg`.
- Do not add interactive prompts in the first version.

## Validation

```bash
pnpm build
pnpm test
```
