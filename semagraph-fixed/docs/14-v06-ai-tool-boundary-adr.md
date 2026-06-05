# ADR 14 — v0.6 AI Tool Boundary

Status: accepted.

## Context

SemaGraph uses deterministic anchoring and transition compression. A model may be useful to explain signatures or synthesize policy, but it must not infer observed states or mutate transition evidence.

## Decision

Add `ai-tools/semagraph-kernel-tool` with:

- OpenAI/GPT-compatible function schemas;
- Claude-style skill instructions;
- local TypeScript dispatch handler;
- CLI adapter examples.

The tool exposes four operations:

1. `semagraph_anchor_state64`;
2. `semagraph_lookup_transition64`;
3. `semagraph_compress_chain64`;
4. `semagraph_policy_context64`.

## Boundary

LLM may:

- request deterministic kernel processing;
- explain kernel results;
- synthesize policy based on compressed signatures.

LLM must not:

- fabricate missing observations;
- change states;
- change masks;
- change signatures;
- treat policy text as observed evidence.
