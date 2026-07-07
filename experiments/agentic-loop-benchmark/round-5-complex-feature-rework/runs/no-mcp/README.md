# policy-transition-workbench no-mcp

Standalone TypeScript implementation for the Round 5 `no-mcp` benchmark.

This variant does not call SemaGraph packages, the SemaGraph CLI, or MCP. It
implements the required State64/Q6 transition math locally and treats State64
ids and mutation masks as canonical finite boolean values only.

## Build

```bash
npm run build
```

## Run

```bash
node dist/policy-transition-workbench.js <input.json>
```

The CLI writes the required workbench JSON to stdout. Invalid input, including
non-canonical `S64-[01]{6}` state ids, is rejected with a nonzero exit code.
