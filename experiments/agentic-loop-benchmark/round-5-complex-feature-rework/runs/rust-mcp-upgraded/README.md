# policy-transition-workbench rust-mcp-upgraded

This Round 5 variant is a TypeScript CLI wrapper around the Rust MCP server
registered as `semagraph` in the workspace `.mcp.json`.

The CLI reads scenario chains and comparison pairs, calls
`semagraph_analyze_scenarios64` with `excludePolicyScenarioIds: ["calm-zero"]`,
and prints the returned policy-transition workbench packet. It rejects invalid
State64 inputs before any deterministic transition request is made.

Build:

```bash
npm run build
```

Run:

```bash
node dist/policy-transition-workbench.js <input.json>
```

Validate a produced packet:

```bash
node dist/validate-produced-packet.js <input.json> <packet.json>
```

Rust build artifacts are directed to `.cargo-target/` under this run directory
so local acceptance checks stay inside the assigned write scope.
