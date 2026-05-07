# AGENTS.md

This file defines how coding agents should work in this repository.

## Project identity

SemaGraph-64 is a compact visual-symbolic language for representing context, transformation, and memory states. It uses the binary structure of line/trigram/hexagram-like glyphs as a formal matrix. Do not frame the project as divination, mysticism, or prediction.

## Current objective

The repository is at pre-alpha scaffold stage. Prioritize correctness, determinism, explicit data structures, tests, and documentation. Do not introduce heavy ML dependencies unless a task explicitly requests it.

## Repository layout

```text
packages/core/          Formal model: lines, trigrams, states, transformations, similarity
packages/renderer-svg/  Deterministic SVG rendering
schemas/                JSON schemas for external interoperability
examples/               Curated examples of symbolic expressions and memory records
docs/                   Formal specification, roadmap, architecture, governance
codex-prompts/          Ready-made development prompts
```

## Commands

Use these commands for validation:

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Package-level commands:

```bash
pnpm --filter @semagraph/core build
pnpm --filter @semagraph/core test
pnpm --filter @semagraph/renderer-svg build
pnpm --filter @semagraph/renderer-svg test
```

## Engineering conventions

- TypeScript only for the first implementation.
- Keep `packages/core` free from DOM, browser, SVG, React, or Node-only assumptions.
- Keep renderer logic in `packages/renderer-svg`.
- Avoid adding dependencies unless justified in the PR description.
- Use explicit types. Avoid `any` except in schema boundary code.
- Prefer pure functions.
- Keep generated glyphs deterministic.
- Do not rename the conceptual model casually.
- Preserve bottom-up line ordering for all six-line states.
- Do not import esoteric interpretations as canonical truth.

## Semantic constraints

Use this vocabulary:

- line: binary primitive;
- trigram: three-line primitive state;
- state64: six-line composite state;
- moving line: a mutable line that flips during transformation;
- transformation: deterministic transition caused by moving lines;
- symbolic memory record: stored context state with source and confidence.

Avoid this vocabulary in code and docs unless explicitly discussing non-goals:

- prophecy;
- oracle engine;
- divination;
- spiritual AI;
- prediction of future events.

## Pull request expectations

Every PR should include:

1. What changed.
2. Why it changed.
3. Validation performed.
4. Risks or open questions.
5. Any schema or public API changes.

## Definition of done

A task is done only when:

- relevant tests pass;
- typecheck passes;
- public exports are intentional;
- docs or examples are updated if behavior changed;
- no generated build artifacts are committed unless explicitly required.

## Development sequence

Follow the staged roadmap in `docs/07-development-program.md`. Do not jump to ML/model training before the language, schema, renderer, and examples are stable.
