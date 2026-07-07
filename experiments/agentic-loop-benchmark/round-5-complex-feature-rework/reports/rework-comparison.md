# Round 5 Complex Feature Rework Comparison

Generated after two independent worker runs:

- `no-mcp`: implemented deterministic State64/Q6 math locally.
- `rust-mcp`: used the Rust MCP server for deterministic compression facts.

## Task

Build a TypeScript CLI named `policy-transition-workbench` for multiple State64
chains. Output includes scenario chain compression, aggregate metrics, pairwise
comparisons, and a policy queue. The fixture intentionally includes repeated
states, zero-distance transitions, loopback movement, and the
`netDistance != cumulativeDistance` trap.

## Final Evaluator Result

| Variant | Correct | Quality | Invalid Input | Loop Count | Rework Events | SemaGraph Calls |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| `no-mcp` | yes | 5/5 | passed | 1 | 0 | 0 |
| `rust-mcp` | yes | 5/5 | passed | 3 | 3 | 7 |

## First-Pass Observation

The `rust-mcp` variant initially delivered but failed the evaluator with quality
`2/5`. It passed aggregate computation and invalid-input rejection, but failed:

- exact scenario summary formatting;
- pairwise comparison details;
- policy queue literal fields.

The MCP calls correctly supplied deterministic compression facts such as ordered
mutation masks, net mutation masks, cumulative distances, and signatures. The
remaining failures were spec-following errors outside the deterministic kernel.

## Rework Needed

The `rust-mcp` worker required evaluator-driven rework to:

- use the exact required `summary` format;
- make `cumulativeDistanceDelta` absolute;
- preserve duplicates on the right side when counting shared ordered masks;
- preserve duplicates on the right side when counting shared states;
- set `allowedActions` exactly to `["monitor", "review", "escalate"]`;
- set `reviewRequired` to `true` for every queued scenario.

## Interpretation

This run does not support the simple claim that MCP automatically reduces rework
for all feature work. It shows a sharper boundary:

- MCP protected the deterministic chain-compression facts.
- The agent still had to read and obey the feature contract around reporting and
  policy queue shape.
- In this single paired run, the no-MCP worker finished correctly with fewer
  recorded rework events.

The useful conclusion is that SemaGraph MCP is valuable as an authoritative
deterministic kernel boundary, but rework reduction depends on whether the
dominant failure mode is deterministic math or general spec compliance.
