# @semagraph/math-anchors

Typed, versioned contracts for the deterministic formalization layer upstream of
State64.

This package models `φ_d : X_d → M_d`, validates the declared structure used as
`M_d`, registers immutable anchor versions, formalizes supplied observations,
and evaluates a registered six-predicate projection. It does not choose a
mathematical ontology, infer observations, or create State64 identifiers.

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
