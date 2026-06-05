# Computational Architecture

## Canonical v0.5 pipeline

```text
observed measurements
→ measurement envelope
→ deterministic anchor rules
→ State64
→ transition matrix lookup
→ chain compression
→ signature
→ policy lookup or policy drafting
```

## Package responsibilities

`@semagraph/kernel` defines the general parametric transition kernel: parameters, predicates, states, guarded transitions, trajectories, regime classification and policies.

`@semagraph/state64-adapter` defines a finite six-bit adapter over `Q6`: states, modules, mutation masks, deterministic anchoring, complete transition matrix lookup and chain compression.

`@semagraph/renderer-svg` renders neutral binary state diagrams.

## LLM boundary

The canonical v0.5 State64 path does not use LLMs to infer observations, assign states or alter transitions. LLM usage is downstream and policy-oriented:

```text
computed signature → policy explanation / policy draft → human or rule validation
```
