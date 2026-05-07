# Codex task 07 — Define LLM encoder contract

## Goal

Define a strict contract for using an LLM to propose symbolic states from text.

## Scope

- Add `docs/10-llm-encoder-contract.md`.
- Add JSON schema for encoder output.
- Add TypeScript validator function.
- Add examples of valid and invalid outputs.

## Required output shape

```json
{
  "candidateStateId": "S64-101010",
  "confidence": 0.74,
  "tensions": ["uncertainty", "beginning"],
  "reason": "The context describes an early, unstructured situation with friction."
}
```

## Constraints

- The LLM cannot invent state IDs.
- The validator must reject unknown states.
- Do not make API calls.
- Do not add provider-specific SDKs.

## Validation

```bash
pnpm test
pnpm typecheck
```
