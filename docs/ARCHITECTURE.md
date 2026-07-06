# SemaGraph computational architecture

> A deterministic compression layer for state-transition trajectories in complex
> stochastic systems, where sampling cost is the bottleneck and path-dependence
> is structural.

This document gives the engineering vocabulary for the SemaGraph core: what it
is, why it is built the way it is, and where the deterministic kernel ends and a
language model begins. Plain language first in each section, precise terms after.

## 1. Origin and motivation

This tool was built to solve a specific problem: a simulation kernel whose
rollout cost made it non-portable on consumer hardware. Achieving statistical
robustness required more samples than available resources could produce.

The insight was a change of representation: instead of reducing the number of
rollouts needed (a statistical problem), compress the trajectories already
available into canonical forms, and measure the distribution over forms instead
of raw path convergence. Deterministic classification of stochastic output.

The state alphabet is derived from the I Ching hexagram system — not for symbolic
reasons, but because it is the oldest known combinatorial system that is natively
binary: six positions, two values each, modular 3+3 structure. The cosmology was
removed; the combinatorial structure was kept. What remained is Q6: 64 states,
4096 transitions, a complete basis for a six-dimensional boolean space.

## 2. What this is, in one paragraph

SemaGraph records how a system moves between states over time and then groups
many such recordings by their shape. It works over a tiny fixed alphabet of
states, so every state fits in a few bits and every move from one state to the
next is a small integer. Because the pieces are so small, the entire table of
possible moves fits inside the processor's fast on-chip memory, and the work of
sorting thousands of recordings into "same shape" or "different shape" becomes a
stream of simple integer operations rather than anything that needs interpretation.

## 3. The one-line technical description

The core is a branchless, cache-resident classifier over a six-bit state space:
per-transition metadata is read from compile-time lookup tables indexed by the
mutation mask `source ^ target`, batches are processed through a struct-of-arrays
layout that the compiler can auto-vectorize, and an optional explicit-SIMD path
mirrors the scalar one bit-for-bit.

## 4. Why a six-bit alphabet

The alphabet is deliberately small. A six-bit composite state (Q6) is two
three-bit modules (Q3 x Q3); the elementary alphabet Q3 has eight states. The
expressivity cost is real and acknowledged: only 8 elementary and 64 composite
states exist, so anything richer must be encoded into, or layered above, this
space. The architectural payoff is what justifies the choice.

The byte math:

- A state is `0..63`: it occupies the low six bits of one `u8` (half a byte).
- A transition is an ordered pair of states, indexed `source * 64 + target`, so
  there are exactly `64 * 64 = 4096` transitions — a 12-bit index.
- The mutation between two states is `source ^ target`, again a six-bit value, so
  every derived scalar (Hamming distance via popcount, per-module distance, module
  scope, regime class) is a pure function of one of 64 possible masks.
- Therefore the whole classification surface collapses to a handful of 64-entry
  byte tables plus, where a direct `(source, target)` index is convenient, one
  4096-entry byte table. The total is 4416 bytes (see section 4).

Small states mean half-byte storage; small transitions mean byte-or-12-bit
indices; a small mask domain means the classifier is a table lookup, which is
branchless and trivially vectorizable across many items at once. The smallness is
the point.

## 5. Where it sits in the memory hierarchy

The hot-path working set is the set of lookup tables in `packages/core-rs/src/tables.rs`:

| table | entries | bytes |
|---|---|---|
| `DISTANCE_BY_MASK` | 64 | 64 |
| `LOWER_DISTANCE_BY_MASK` | 64 | 64 |
| `UPPER_DISTANCE_BY_MASK` | 64 | 64 |
| `MODULE_SCOPE_BY_MASK` | 64 | 64 |
| `REGIME_BY_MASK` | 64 | 64 |
| `REGIME_BY_TRANSITION` | 4096 | 4096 |
| total | | 4416 |

A typical L1 data cache is 32 KiB, so 4416 bytes is roughly 14% of L1. Once the
tables are warm they stay resident, and classifying a transition is a small number
of L1-latency loads with no data-dependent branch to mispredict. This is what
"cache-resident" means here, and it is the concrete content of "mechanical
sympathy": the data structures are sized and shaped to match how the hardware
actually fetches and predicts, so the common path costs what the hardware charges
for a few cache hits and an XOR, and no more.

The tables are built as `const` data at compile time from the same classifier
functions the scalar path uses, so they cannot drift from the reference logic; an
exhaustive test asserts the table path equals the scalar path on all 4096
transitions.

## 6. The division of labour

The deterministic kernel does the structural work, and only the structural work:

- encode states and the mutation between them (XOR);
- measure distance (popcount) and per-module distance;
- classify each transition into a regime class by table lookup;
- collapse a trajectory into its run-collapsed shape and dwell vector;
- compute the declared projections (net mutation, endpoint code, endpoint Hamming,
  cumulative distance);
- group and compare trajectories by shape.

All of this is exact, deterministic, and constant-time per item. It uses no
floating point and no randomness in the classification path.

What is left to a language model (LLM) is the semantic work: naming what a regime
or a shape means in a domain, explaining a grouping to a person, proposing a
policy once the kernel has produced an auditable signature. The boundary is firm
and one-directional: the LLM never computes a state, a mutation mask, a distance,
a shape key, or any signature. Those are produced only by the kernel. The LLM
consumes the kernel's outputs; it does not manufacture them. This anti-inference
boundary is what makes the structural results reproducible and checkable
independently of any model.

## 7. The four-level hierarchy

The reference (`packages/kernel/src/shapes.ts`, ported to
`packages/core-rs/src/shapes.rs`) defines four levels:

1. **Q3 alphabet** — eight elementary states (`0..7`). The base symbols.
2. **T64 oriented edges** — an ordered pair `(source, target)` encoded as
   `source * 8 + target` in `0..63`. This is a directed transition. It shares the
   cardinality 64 with a Q6 composite point but is semantically a different thing:
   T64 is an oriented edge, Q6 is a point/state. They are separately typed and
   never interconvert, despite the equal count.
3. **Paths** — `PathQ3` is the trajectory itself (an ordered word over Q3);
   `MutationPathQ3` is the word of XOR steps; `NormalizedPathQ3` is the
   run-collapsed shape plus its dwell vector. Run-collapse merges adjacent
   duplicates only: a non-adjacent return such as `[A,B,A,D]` stays distinct from
   `[A,B,D]`, and the dwell vector is aligned to runs, not to distinct states, so
   shape and dwell together reconstruct the path losslessly.
4. **Declared lossy projections**, each labelled with its collapse factor:
   net mutation → 8 buckets, endpoint code → 64 buckets, Hamming distance → a
   scalar magnitude.

State plainly: no lossy projection may be a form key. The projections are coarse
filters that cheaply narrow candidates; the run-collapsed shape is the only thing
that decides whether two trajectories share a form. The endpoint check in the
comparison cascade is a performance pre-filter, not a decision — equal shape
forces equal endpoints, but equal endpoints prove nothing about shape, so the
shape comparison remains the decider.

## 8. What this is NOT

To prevent overstatement:

- It is not a complexity-theory result, and it makes no P vs NP claim. It is an
  engineering reduction of a narrow, structural task to native CPU primitives.
- It is not a compressor of arbitrary text or arbitrary data. It compresses
  trajectories over a stipulated finite alphabet, nothing more.
- It is not a model of how the pre-linguistic layer is learned. The axes of the
  state space are stipulated by design, not discovered or emergent.
- The performance statements in this repository are either numbers a benchmark
  actually produced or are explicitly marked as architectural expectations.

## 9. Future directions (speculative)

All of the following are speculative and out of present scope:

- **SIMD** — an explicit SSE2 batch path exists behind the `simd` feature as a
  demonstration; portable-SIMD and wider-vector versions are possible follow-ups.
- **FPGA / lookup-ROM** — because the classifier is a fixed table over a 12-bit
  index, it could in principle be realised as a single-cycle hardware lookup. This
  is noted as a direction only; no hardware work is in scope.
- **Learned anchoring** — deciding the axes of the state space from data, rather
  than stipulating them, is the hard problem. It is deliberately left out of scope
  here.
