# Transition Audit Task

Build a deterministic TypeScript CLI named `transition-audit`.

## Input

A path to a JSON file containing an ordered State64 chain:

```json
["S64-000000", "S64-100000", "S64-101000", "S64-101010"]
```

## Output

Write JSON to stdout and to `output.json` in the run directory. Required fields:

- `sourceStateId`
- `targetStateId`
- `states`
- `transitionCount`
- `changedMasks`
- `netMutationMask`
- `cumulativeDistance`
- `summary`

## Deterministic Rules

- State ids must match `S64-[01]{6}` exactly.
- Mutation masks must match `M64-[01]{6}` exactly.
- Each transition mask is the bitwise XOR of adjacent state bit strings.
- `netMutationMask` is the XOR of the first and last state.
- `cumulativeDistance` is the sum of changed bits over adjacent transitions.
- Do not infer, repair or invent missing states.

## Common Fixture

Input:

```text
experiments/agentic-loop-benchmark/fixtures/sample-chain.json
```

Expected comparable output:

```text
experiments/agentic-loop-benchmark/fixtures/expected-output.json
```
