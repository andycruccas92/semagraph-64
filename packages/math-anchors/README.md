# @semagraph/math-anchors

Typed, versioned contracts for the deterministic formalization layer upstream of
State64.

This package models the partial formalization `φ_d : D_d → M_d`, where
`D_d = dom(φ_d) ⊆ X_d`; inputs outside the registered admissibility contract are
rejected. It validates the declared structure used as `M_d`, registers immutable
anchor versions, formalizes supplied observations, and evaluates the SemaGraph
specialization `P_R : M_d → B^6`. It does not choose a mathematical ontology,
infer observations, or create State64 identifiers.

This package is an implementation of the contract required to register a
mathematical representation and project it deterministically toward State64. It
is not the mathematical-anchoring theory and is intentionally not a universal
ontology or general-purpose mathematics engine.

The authoritative flow is:

```text
register domain
  → propose candidate anchor
  → validate and register candidate
  → applyMathematicalAnchor
  → evaluateRegisteredProjection
  → state64-adapter creates S64-[01]{6}
```

The initial structure vocabulary is intentionally extensible and non-exhaustive.
Its labels describe mathematical contracts; lexical similarity never grants
authority or semantic identity.

The package remains a single package because its internal `vocabulary`,
`validation`, `registry`, and formalization modules share one small dependency-
free contract surface. No independent package boundary is currently justified.
