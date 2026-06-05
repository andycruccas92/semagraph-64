# ADR 15 — v0.6 Paper and Research Positioning

Status: accepted as draft-positioning artifact.

## Context

The project needs a clear theoretical and practical explanation that presents SemaGraph without symbolic lineage claims and treats it as pure computation over a finite boolean state space.

## Decision

Add `paper/overleaf/main.tex` as an Italian technical paper for Overleaf.

The paper frames SemaGraph as:

- deterministic observed-state anchoring;
- Q6 / State64 finite transition space;
- 4096 direct transitions;
- transition-chain compression;
- Rust/WASM-oriented machine-near kernel;
- LLM-limited policy synthesis layer.

## Non-claims

The paper does not claim that SemaGraph is a physics engine, a general programming language, a universal simulator, a replacement for statistical models, or an LLM-internal CPU accelerator. It claims a narrower transition-compression role.
