# Codex task 01 — Harden the parametric kernel

Read `AGENTS.md`, `docs/01-formal-model.md`, `docs/11-state64-adapter-boundary-adr.md` and `packages/kernel/`.

## Goal

Harden only `@semagraph/kernel` definition validation and tests.

## Scope

- validate duplicate parameter and state identifiers;
- detect invalid predicate references;
- detect transition rules referencing unknown parameters or states;
- add deterministic tests for rejected definitions and transition chains.

## Constraints

- Do not import or mention State64 in kernel source.
- Do not add persistence, LLM, application-domain or ML logic.
- Do not stage, commit or create a PR.

## Verification

Run relevant typecheck/tests and report changed files, `git diff --stat`, `git diff --name-only` and `git status --short`.
