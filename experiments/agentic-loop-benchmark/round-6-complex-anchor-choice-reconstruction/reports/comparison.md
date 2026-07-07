# Round 6 Complex Anchor Choice Reconstruction

Generated from:

```bash
node experiments/agentic-loop-benchmark/round-6-complex-anchor-choice-reconstruction/scripts/evaluate.mjs
```

## Result

| Variant | Correct | Quality | Invalid Input | Duration | MCP Calls |
| --- | --- | ---: | --- | ---: | ---: |
| `baseline-js-local` | yes | 4/4 | passed | 0.938 ms | 0 |
| `rust-mcp-updated` | yes | 4/4 | passed | 9.797 ms | 6 |

## What Is Being Tested

- Complex deterministic anchoring from six observed values per snapshot.
- Mixed value types and operators, including inverted true/false bit mappings.
- Reconstruction of the per-bit choices used to form each State64 id.
- Reconstruction of transition choices and final output action from the
  deterministic transition packet.

## Interpretation

The updated Rust MCP path uses `semagraph_anchor_state64` for every snapshot,
`semagraph_analyze_scenarios64` for the anchored chain, and
`semagraph_validate_policy_packet64` before output reconstruction. The useful
signal is whether the MCP path preserves the same anchor decisions and output
basis as the local baseline while making those choices auditable through tool
results.
