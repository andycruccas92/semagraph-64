---
name: semagraph-core
description: Work on the SemaGraph-64 formal model, renderer, symbolic memory, and documentation while preserving non-divinatory framing and deterministic outputs.
---

# SemaGraph Core Skill

Use this skill when modifying the SemaGraph-64 language core, renderer, symbolic memory layer, or related documentation.

## Rules

- Read `AGENTS.md` first.
- Preserve the project framing: formal visual-symbolic language, not divination.
- Keep the core package pure TypeScript.
- Keep rendering in the renderer package.
- Add tests for every public function.
- Maintain bottom-up line ordering.
- Do not introduce heavy ML dependencies.
- Do not make network calls.

## Verification

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If a command cannot run, explain why and provide the exact error.
