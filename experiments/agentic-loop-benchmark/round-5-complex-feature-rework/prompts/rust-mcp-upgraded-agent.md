# Agent Prompt: Round 5 rust-mcp-upgraded

You are implementing the `rust-mcp-upgraded` variant of Round 5.

Workspace root: `C:\Dev\semagraph-64`

Read:

- `experiments/agentic-loop-benchmark/round-5-complex-feature-rework/spec/task.md`
- `experiments/agentic-loop-benchmark/round-5-complex-feature-rework/fixtures/scenarios.json`
- `experiments/agentic-loop-benchmark/round-5-complex-feature-rework/fixtures/invalid-scenarios.json`
- `.mcp.json`

Write only under:

```text
experiments/agentic-loop-benchmark/round-5-complex-feature-rework/runs/rust-mcp-upgraded/
```

Build a TypeScript CLI named `policy-transition-workbench`.

Hard constraints:

- Use the Rust MCP server registered as `semagraph` for deterministic transition
  facts.
- Prefer `semagraph_analyze_scenarios64` to produce scenario reports,
  aggregate metrics, comparisons, policy queue fields, mutation masks,
  distances and signatures.
- Before final handoff, call `semagraph_validate_policy_packet64` with the
  produced packet and fix any reported mismatch.
- Pass `excludePolicyScenarioIds: ["calm-zero"]` when constructing and
  validating the policy-transition workbench packet.
- The model may synthesize policy queue text only after deterministic facts are
  available.
- Do not infer observations.
- Do not mutate states, masks, observations, or deterministic signatures.
- Preserve canonical `S64-[01]{6}` and `M64-[01]{6}` formats.

Expected run command shape:

```bash
node dist/policy-transition-workbench.js <input.json>
```

Add:

- `package.json`
- `tsconfig.json`
- source files
- `README.md`
- `agent-log.json`

The `agent-log.json` must include:

```json
{
  "variant": "rust-mcp-upgraded",
  "semagraphRuntime": "rust-mcp",
  "semagraphCalls": [],
  "loopCount": 0,
  "reworkEvents": [],
  "acceptanceChecks": []
}
```

Record each MCP call in `semagraphCalls` with enough detail to audit the
deterministic boundary. Fill `loopCount`, `reworkEvents`, and
`acceptanceChecks` truthfully. Do not invent token usage.
