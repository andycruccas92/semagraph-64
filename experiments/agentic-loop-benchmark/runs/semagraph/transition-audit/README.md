# transition-audit

`transition-audit` is a small deterministic TypeScript CLI for ordered State64 transition chains.

It accepts a JSON file containing an ordered array of canonical State64 ids:

```json
["S64-000000", "S64-100000", "S64-101010"]
```

It outputs JSON containing:

- `sourceStateId`
- `targetStateId`
- `states`
- `transitionCount`
- `changedMasks`
- `netMutationMask`
- `cumulativeDistance`
- `summary`

State ids are accepted only when they match `S64-[01]{6}`. Mutation masks are emitted canonically as `M64-[01]{6}`.

## Usage

```bash
npm run build
node dist/cli.js sample-chain.json
```

After package linking or installation, the binary name is:

```bash
transition-audit sample-chain.json
```

## Smoke Test

```bash
npm run smoke
```

The implementation is self-contained in this directory. During the benchmark loop, the local SemaGraph AI kernel tool was used as a deterministic oracle for the sample chain:

```bash
node ../../../../../ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 semagraph-sample.args.json
```
