# SemaGraph Kernel Tool Skill

Use this skill when the task requires deterministic processing of registered mathematical anchors, observed State64/Q6 states, transitions, chains or policy contexts.

## Boundary

The model must not infer observed values, fabricate missing parameters, choose among candidate ontologies, register its own candidate, change State64 states, change mutation masks or modify deterministic signatures. It may propose a candidate anchor only as explicitly non-authoritative. The model may synthesize explanatory policy after registered anchoring and deterministic compression.

## Available tool calls

Use the local adapter in `ai-tools/semagraph-kernel-tool` or expose the schemas in `openai-tools.json` as function tools.

Canonical operations:

1. `semagraph_anchor_state64`: historical direct-parameter mode; maps exactly six known observations to one six-bit state.
2. `semagraph_validate_math_anchor`: validates a candidate but does not register it.
3. `semagraph_formalize_observations`: applies an explicitly selected registered anchor version.
4. `semagraph_anchor_formalized_state64`: replay-checks and projects a formalized snapshot.
5. `semagraph_inspect_anchor_trace`: retrieves deterministic lineage for one bit.
6. `semagraph_lookup_transition64`: computes transition metadata for `sourceStateId -> targetStateId`.
7. `semagraph_compress_chain64`: compresses an ordered State64 chain into mutation masks and a deterministic signature.
8. `semagraph_policy_context64`: creates a policy-synthesis request from a deterministic chain.

## Required behavior

- Reject incomplete observations.
- Preserve raw evidence references.
- Treat semantic labels as descriptive metadata, not mathematical authority.
- Preserve ambiguous candidates upstream until an external authority registers one.
- Treat output as deterministic only relative to declared anchor rules and supplied observations.
- Mark uncertainty outside the kernel instead of changing kernel output.
- Policy text must cite the deterministic signature it responds to.

## Example

Input chain:

```json
{"states":["S64-000000","S64-100000","S64-101000","S64-101010"]}
```

The kernel returns ordered mutation masks and net mutation. The model may then write a policy for that signature, but it must not alter the chain.
