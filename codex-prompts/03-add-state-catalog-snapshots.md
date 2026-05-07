# Codex task 03 — Add state catalog snapshots

## Goal

Add snapshot-like tests or fixture exports for all generated SemaGraph-64 states.

## Scope

- Export a stable generated catalog JSON from core.
- Add tests that assert exactly 64 states.
- Assert every state has 6 lines.
- Assert every state has lower and upper trigram IDs.
- Assert state IDs are unique.
- Assert binary codes are unique.

## Constraints

- Do not introduce traditional ordering as canonical.
- Do not manually maintain duplicated catalogs if generation is enough.

## Validation

```bash
pnpm test
pnpm typecheck
```
