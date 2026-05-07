# Codex task 06 — Create static gallery

## Goal

Generate a static gallery of the 8 trigrams and 64 states.

## Scope

- Add script under `scripts/generate-gallery.ts` or a small package.
- Generate HTML or Markdown into `generated/gallery/`.
- Include SVG glyph, state ID, binary code, lower/upper trigram.

## Constraints

- Generated output should not be committed unless explicitly requested.
- Keep script deterministic.
- No web framework yet.

## Validation

```bash
pnpm build
pnpm test
```
