# transition-audit

`transition-audit` is a deterministic TypeScript CLI for auditing an ordered State64 transition chain from canonical ids only. It does not call SemaGraph package APIs, MCP tools, AI tools, or external state.

## Input

Provide a JSON file containing an ordered array of canonical State64 ids:

```json
["S64-000000", "S64-100000", "S64-101010"]
```

Each id must match `S64-[01]{6}` exactly.

## Output

The CLI writes JSON with:

- `sourceStateId`: first state in the chain
- `targetStateId`: last state in the chain
- `states`: validated ordered input states
- `transitionCount`: number of adjacent transitions
- `changedMasks`: adjacent XOR masks as canonical `M64-[01]{6}` ids
- `netMutationMask`: source-to-target XOR mask
- `cumulativeDistance`: sum of adjacent Hamming distances
- `summary`: human-readable audit sentence

## Usage

```sh
npm run build
node dist/transition-audit.js fixtures/sample-states.json
```

## Smoke Test

```sh
npm run smoke
```
