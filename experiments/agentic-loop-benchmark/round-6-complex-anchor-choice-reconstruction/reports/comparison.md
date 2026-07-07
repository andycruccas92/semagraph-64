# Round 6 Complex Anchor Choice Reconstruction

Generated from:

```bash
node experiments/agentic-loop-benchmark/round-6-complex-anchor-choice-reconstruction/scripts/evaluate.mjs
```

## Result

| Variant | Correct | Quality | Invalid Input | Duration | MCP Calls | Est. Visible Tokens | MCP Req Tokens | MCP Resp Tokens | MCP Payload Tokens |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline-js-local` | yes | 4/4 | passed | 2.448 ms | 0 | 3752 | 0 | 0 | 0 |
| `rust-mcp-updated` | yes | 4/4 | passed | 35.925 ms | 6 | 12183 | 1375 | 7056 | 8431 |
| `rust-mcp-single-call` | yes | 4/4 | passed | 33.941 ms | 1 | 15634 | 827 | 11047 | 11874 |

## Token Proxy

Token counts are estimates, not provider-reported usage. The estimator is
`ceil(chars / 4)` over serialized benchmark artifacts and MCP JSON-RPC
payloads.

## What Is Being Tested

- Complex deterministic anchoring from six observed values per snapshot.
- Mixed value types and operators, including inverted true/false bit mappings.
- Reconstruction of the per-bit choices used to form each State64 id.
- Reconstruction of transition choices and final output action from the
  deterministic transition packet.

## Interpretation

The multi-call Rust MCP path uses `semagraph_anchor_state64` for every
snapshot, `semagraph_analyze_scenarios64` for the anchored chain, and
`semagraph_validate_policy_packet64` before output reconstruction.

The single-call Rust MCP path uses `semagraph_analyze_observed_timeline64`,
which moves the full deterministic workflow behind one tool boundary. The useful
signal is whether the MCP paths preserve the same anchor decisions and output
basis as the local baseline while making those choices auditable through tool
results.
