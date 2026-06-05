# SemaGraph v0.6

SemaGraph is a deterministic observed-state anchoring and transition-chain compression kernel.

It represents observed or known parameter states in a finite six-bit boolean space (`Q6` / State64), computes direct transitions through XOR mutation masks, compresses ordered chains into deterministic signatures, and allows LLMs to synthesize policy only after the kernel has produced an auditable signature.

## Core stance

SemaGraph v0.6 is pure mathematical computation over a finite state space. It does not use symbolic lineage claims and it does not depend on an LLM for state inference.

```text
observed physical/structured parameters
→ deterministic anchor rules
→ State64/Q6 state
→ 64×64 transition matrix lookup
→ transition-chain compression
→ policy context
→ optional LLM policy synthesis
```

## Packages

- `packages/kernel`: domain-neutral parametric transition kernel and policy primitives.
- `packages/state64-adapter`: TypeScript reference implementation for State64/Q6, deterministic anchors, transition matrix and chain compression.
- `packages/renderer-svg`: neutral State64 visual rendering utilities.
- `packages/core-rs`: Rust feasibility core for machine-near State64 transition processing.
- `ai-tools/semagraph-kernel-tool`: GPT/Claude-compatible tool schemas, Claude skill and local TypeScript adapter.
- `paper/overleaf`: Italian LaTeX paper for Overleaf.

## What v0.6 adds

1. Rust feasibility core with zero external dependencies.
2. Numeric parity helpers for TypeScript ↔ Rust/WASM/C integration.
3. AI kernel tool layer for GPT/Claude-style integration.
4. Italian theory/practice paper in LaTeX.
5. Clearer boundary: LLMs may synthesize policy but must not infer states, observations, masks or signatures.

## State64 / Q6 primitives

- `State64`: integer `0..63` or canonical id `S64-010101`.
- `MutationMask64`: integer `0..63` or canonical id `M64-010101`.
- Direct transition: `source XOR target`.
- Distance: `popcount(source XOR target)`.
- Transition index: `source * 64 + target`.
- Complete direct transition basis: `64 × 64 = 4096` entries.

## Validation status

TypeScript static validation is supported with `tsc`. Rust validation requires a local Rust toolchain.

The generated v0.6 package was statically checked for the TypeScript packages available in the container. Rust files were authored as feasibility source but were not compiled in the container because Rust/Cargo were not installed.

## Non-goals

SemaGraph is not:

- a physics engine;
- a general-purpose programming language;
- a statistical model;
- a replacement for scientific solvers;
- an LLM-internal acceleration layer;
- a policy authority without external validation.

It is a transition-compression kernel intended to reduce repeated interpretation and make observed state changes replayable, comparable and policy-addressable.
