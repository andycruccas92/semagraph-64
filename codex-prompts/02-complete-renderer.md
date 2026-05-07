# Codex task 02 — Complete SVG renderer

Read `AGENTS.md`, `docs/02-visual-grammar.md`, and `packages/renderer-svg/src` before editing.

## Goal

Complete the deterministic SVG renderer for lines, trigrams, and 64 states.

## Scope

- Render yin lines as broken lines.
- Render yang lines as continuous lines.
- Render trigrams bottom-up.
- Render six-line states bottom-up.
- Add rendering options for width, stroke width, line gap, and moving marker.
- Add tests for SVG output structure.

## Constraints

- Renderer must not depend on browser globals.
- Renderer must not mutate core objects.
- Keep output deterministic.
- Do not add React or canvas yet.

## Validation

```bash
pnpm --filter @semagraph/renderer-svg typecheck
pnpm --filter @semagraph/renderer-svg test
pnpm build
```
