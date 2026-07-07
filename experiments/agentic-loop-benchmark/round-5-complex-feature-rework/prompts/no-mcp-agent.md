# Agent Prompt: Round 5 no-mcp

You are implementing the `no-mcp` variant of Round 5.

Workspace root: `C:\Dev\semagraph-64`

Read:

- `experiments/agentic-loop-benchmark/round-5-complex-feature-rework/spec/task.md`
- `experiments/agentic-loop-benchmark/round-5-complex-feature-rework/fixtures/scenarios.json`
- `experiments/agentic-loop-benchmark/round-5-complex-feature-rework/fixtures/invalid-scenarios.json`

Write only under:

```text
experiments/agentic-loop-benchmark/round-5-complex-feature-rework/runs/no-mcp/
```

Build a TypeScript CLI named `policy-transition-workbench`.

Hard constraints:

- Do not call SemaGraph packages.
- Do not call the SemaGraph CLI.
- Do not call MCP.
- Implement deterministic State64/Q6 math from the task spec.
- Do not infer observations.
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
  "variant": "no-mcp",
  "semagraphRuntime": "none",
  "semagraphCalls": [],
  "loopCount": 0,
  "reworkEvents": [],
  "acceptanceChecks": []
}
```

Fill `loopCount`, `reworkEvents`, and `acceptanceChecks` truthfully. Do not
invent token usage.
