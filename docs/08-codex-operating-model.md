# Codex operating model

## Principle

Codex should work in small, bounded pull requests. Each task must include a clear scope, commands to run, and files that should not be changed.

## Recommended workflow

1. Open a GitHub issue from one prompt in `codex-prompts/`.
2. Assign Codex to implement only that issue.
3. Require tests and typecheck.
4. Review the diff.
5. Merge only if the public API and docs remain coherent.
6. Update AGENTS.md when Codex repeats a mistake.

## First Codex tasks

Use these in order:

1. `codex-prompts/01-stabilize-core.md`
2. `codex-prompts/02-complete-renderer.md`
3. `codex-prompts/03-add-state-catalog-snapshots.md`
4. `codex-prompts/04-build-memory-layer.md`
5. `codex-prompts/05-create-cli-demo.md`
6. `codex-prompts/06-create-static-gallery.md`
7. `codex-prompts/07-llm-encoder-contract.md`

## Review checklist

For each Codex PR:

- did it preserve the non-divinatory framing?
- did it keep core logic pure?
- did it add tests?
- did it update docs/examples when needed?
- did it avoid unnecessary dependencies?
- did it keep deterministic outputs?
- did it avoid inventing semantic claims?

## Branch naming

Use:

```text
feat/core-transformations
feat/svg-renderer
feat/symbolic-memory
feat/cli-demo
docs/formal-model
chore/ci-hardening
```

## PR template

```md
## Summary

## Validation

- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm build

## Semantic review

- [ ] no divinatory framing introduced
- [ ] no uncontrolled semantic expansion
- [ ] public API documented

## Risks
```
