# policy-transition-workbench rust-mcp

Round 5 `rust-mcp` implementation for SemaGraph. The TypeScript CLI validates
canonical `S64-[01]{6}` input, asks the Rust MCP server registered as
`semagraph` for deterministic transition-basis verification and chain
compression, then builds aggregate, comparison, and policy queue output from
those deterministic facts.

Run:

```bash
npm run build
node dist/policy-transition-workbench.js ../../fixtures/scenarios.json
```

The MCP command matches the workspace `.mcp.json` registration:

```bash
cargo run --quiet --manifest-path packages/Cargo.toml --bin semagraph-mcp
```

The model-authored policy queue is intentionally limited to domain-neutral
allowed action text after the Rust MCP compression has returned canonical
states, mutation masks, distances, regimes, and signatures.
