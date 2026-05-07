# Codex task 04 — Build symbolic memory layer

## Goal

Add a symbolic memory module to `packages/core`.

## Scope

Create types and pure functions for:

- `SymbolicMemoryRecord`;
- `SymbolicTrajectory`;
- add record to trajectory;
- retrieve by exact state;
- retrieve by maximum line distance;
- retrieve by shared trigram;
- sort by timestamp.

Add examples under `examples/context-memory-events.json` if needed.

## Constraints

- No database yet.
- No LLM API calls.
- No external dependencies.

## Validation

```bash
pnpm --filter @semagraph/core test
pnpm --filter @semagraph/core typecheck
```
