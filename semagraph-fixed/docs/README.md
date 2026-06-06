# SemaGraph documentation

Three documents, one concern each:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — prose rationale: origin and motivation,
  why six bits, the memory hierarchy, the kernel/LLM division of labour, the
  four-level hierarchy, non-goals, and future directions.
- [`FORMAL-MODEL.md`](FORMAL-MODEL.md) — the precise mathematics: Q6 state space,
  transitions and regimes, chain compression, the Q3/T64 trajectory hierarchy,
  projections, and the invariants (with short proofs).
- [`DECISIONS.md`](DECISIONS.md) — the consolidated architecture decision record
  (replaces the former numbered ADRs).

See also, at the repository root: [`../README.md`](../README.md),
[`../TOOL_DESCRIPTION.md`](../TOOL_DESCRIPTION.md) (the machine-readable CLI
contract), and [`../paper/overleaf/main.tex`](../paper/overleaf/main.tex) (the
explanatory paper).
