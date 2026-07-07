# Round 5 Complex Feature Rework Comparison

Generated after three worker runs:

- `no-mcp`: implemented deterministic State64/Q6 math locally.
- `rust-mcp`: used the Rust MCP server for deterministic compression facts.
- `rust-mcp-upgraded`: used the Rust MCP server for a deterministic workbench
  packet and then validated the produced packet through MCP before handoff.

## Task

Build a TypeScript CLI named `policy-transition-workbench` for multiple State64
chains. Output includes scenario chain compression, aggregate metrics, pairwise
comparisons, and a policy queue. The fixture intentionally includes repeated
states, zero-distance transitions, loopback movement, and the
`netDistance != cumulativeDistance` trap.

## Final Evaluator Result

| Variant | Correct | Quality | Invalid Input | Loop Count | Rework Events | Functional Rework | SemaGraph Calls |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| `no-mcp` | yes | 5/5 | passed | 1 | 0 | 0 | 0 |
| `rust-mcp` | yes | 5/5 | passed | 3 | 3 | 3 | 7 |
| `rust-mcp-upgraded` | yes | 5/5 | passed | 1 | 2 | 0 | 2 |

## First-Pass Observation

The `rust-mcp` variant initially delivered but failed the evaluator with quality
`2/5`. It passed aggregate computation and invalid-input rejection, but failed:

- exact scenario summary formatting;
- pairwise comparison details;
- policy queue literal fields.

The MCP calls correctly supplied deterministic compression facts such as ordered
mutation masks, net mutation masks, cumulative distances, and signatures. The
remaining failures were spec-following errors outside the deterministic kernel.

The upgraded MCP run delivered correctly on the first functional pass. Its two
recorded rework events were sandbox retries for `dist/` writes and Cargo target
access, not evaluator-driven corrections to scenario math, comparisons, or
policy queue shape.

## Rework Needed

The `rust-mcp` worker required evaluator-driven rework to:

- use the exact required `summary` format;
- make `cumulativeDistanceDelta` absolute;
- preserve duplicates on the right side when counting shared ordered masks;
- preserve duplicates on the right side when counting shared states;
- set `allowedActions` exactly to `["monitor", "review", "escalate"]`;
- set `reviewRequired` to `true` for every queued scenario.

The `rust-mcp-upgraded` worker avoided that class of rework by calling:

- `semagraph_analyze_scenarios64` for scenarios, aggregate metrics,
  comparisons, policy queue fields, mutation masks, distances, and signatures;
- `semagraph_validate_policy_packet64` before handoff, which returned
  `valid=true` with no errors.

## Interpretation

The first MCP run did not support the simple claim that MCP automatically
reduces rework for all feature work. The upgraded run shows the sharper
boundary:

- MCP protected the deterministic chain-compression facts.
- The agent still had to read and obey the feature contract around reporting and
  policy queue shape when only low-level compression tools were available.
- When the MCP exposed the deterministic workbench contract directly and
  provided a validator, the upgraded worker finished with no functional
  evaluator rework.

The useful conclusion is that SemaGraph MCP is valuable as an authoritative
deterministic kernel boundary. Rework reduction becomes much more visible when
the MCP surface matches the agent task level: not only `compress this chain`,
but `produce and validate the deterministic packet this feature must preserve`.
