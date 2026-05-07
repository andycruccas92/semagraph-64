# Codex prompt 08 — Stabilize canonical symbol layer

Goal: Review and harden the Wilhelm/Baynes-derived canonical symbol layer.

Scope:
- Inspect `packages/core/src/trigrams.ts`, `packages/core/src/hexagrams.ts`, and `docs/10-canonical-symbols-wilhelm.md`.
- Verify that each hexagram has a unique bottom-up six-bit code.
- Verify that `getState64ByNumber`, `getState64ByBinary`, and `getStatesByTrigramPair` are deterministic.
- Do not add divinatory behavior.
- Do not paste long source passages.
- Keep source reference identity (`wilhelmName`, `wilhelmTitle`) separate from computational interpretation (`kernel`, `family`, `keywords`).

Acceptance criteria:
- `pnpm typecheck` passes.
- `pnpm test` passes.
- Add tests for at least five canonical lookup examples from the reference table.
- Update docs only if inconsistencies are found.
