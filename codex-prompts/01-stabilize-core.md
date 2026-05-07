# Codex task 01 — Stabilize core formal model

You are working in the SemaGraph-64 repository.

Read `AGENTS.md`, `docs/01-formal-model.md`, and `packages/core/src` before editing.

## Goal

Stabilize the core formal model and add missing tests.

## Scope

- Verify line ordering is bottom-up everywhere.
- Ensure all 8 trigrams are correct and tested.
- Ensure 64 generated states are deterministic.
- Add lookup helpers if missing:
  - by state ID;
  - by binary code;
  - by lower/upper trigram.
- Add tests for transformation of moving lines.

## Constraints

- Do not add ML dependencies.
- Do not alter the non-divinatory framing.
- Do not introduce traditional King Wen ordering as canonical.
- Keep `packages/core` renderer-free.

## Validation

Run:

```bash
pnpm --filter @semagraph/core typecheck
pnpm --filter @semagraph/core test
pnpm build
```

## Expected PR summary

Explain what was stabilized, what helpers were added, and which invariants are now tested.
