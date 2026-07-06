# @semagraph-64/kernel

Domain-neutral parametric **state-transition kernel** for SemaGraph.

A small, deterministic, dependency-free TypeScript library for modelling systems
as parameter snapshots, deriving discrete states from those parameters, evaluating
rule-governed transitions between them, classifying how large each transition is
("regime"), and compressing whole trajectories into canonical, comparable
signatures.

It computes structural facts about trajectories. It does **not** interpret them,
guess, call the network, or carry any runtime dependency.

## Install

```bash
npm install @semagraph-64/kernel
```

## What it does

The kernel is organized as a pipeline of pure functions:

- **Parameters** — declare typed parameters (boolean / number / ordinal / categorical) and validate snapshots against them.
- **Predicates** — boolean expressions (`all` / `any` / `none`) over a snapshot.
- **States** — derive the active discrete state from a snapshot by priority-ordered predicate sets.
- **Transitions** — evaluate a rule (guards + effects + allowed authorities) and produce an accepted/rejected result.
- **Regimes** — classify an accepted transition by how many parameters changed (`no_change` → `structural_inversion`).
- **Policies** — resolve which declared policy applies to a classified transition.
- **Shapes** — type and compress trajectories over an 8-symbol alphabet into canonical keys and compare them.

## Quick example

```ts
import { pathQ3, shapeKey, dwellSignature, compareTrajectories } from "@semagraph-64/kernel";

const a = pathQ3([0, 1, 3]);
const b = pathQ3([0, 1, 1, 3]);

shapeKey(b);          // "S3:0.1.3"   (run-collapsed form)
dwellSignature(b);    // "D3:1.2.1"   (steps spent in each run)

compareTrajectories(a, b).relation; // "same_form_different_duration"
```

Classifying a transition's regime:

```ts
import { classifyTransitionRegime } from "@semagraph-64/kernel";

classifyTransitionRegime(transitionResult).regimeClass;
// "no_change" | "local_adjustment" | "partial_reconfiguration"
// | "regime_shift" | "structural_inversion" | "unclassified"
```

## Design invariant

The shape module distinguishes **lossy projections** (net mutation, endpoint
code, Hamming distances) from **form identity** (the run-collapsed shape). No
lossy projection may ever serve as a form key: it may only pre-filter candidates
for performance. The comparison cascade in `compareTrajectories` enforces this —
cheap checks narrow, the shape check decides. Branded types keep a six-bit point
state (`CompositePointStateQ6`) and an oriented transition (`EndpointTransitionT64`)
from ever interconverting despite sharing cardinality 64.

## API

All exports are pure and synchronous. See the shipped type declarations
(`dist/index.d.ts`) for the full surface. Highlights:

- `validateParameterDefinitions`, `validateParameterSnapshot`, `assertValidParameterSnapshot`
- `evaluatePredicate`, `evaluatePredicateSet`
- `evaluateStates`, `requireSelectedState`
- `evaluateTransition`, `applyEffects`
- `classifyTransitionRegime`, `changedParameterKeys`
- `resolvePoliciesForClassification`
- `pathQ3`, `shapeKey`, `dwellSignature`, `exactPathKey`, `netMutationQ3`, `cumulativeDistanceQ3`, `compareTrajectories`, `groupByShape`

## License

Apache-2.0
