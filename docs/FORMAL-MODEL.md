# SemaGraph — formal model

This document is the precise mathematical specification of the SemaGraph kernel.
It is self-contained and supersedes the earlier `01-formal-model.md`. The prose
companion is [`ARCHITECTURE.md`](ARCHITECTURE.md); the decision history is
[`DECISIONS.md`](DECISIONS.md).

Notation: `B = {0,1}`, `⊕` is bitwise XOR, `popcount(x)` is the Hamming weight
(number of set bits) of `x`, and `[a..b)` is the half-open integer interval.

## 1. The composite state space Q6

The composite state space is

```
Q6 = B^6,   |Q6| = 2^6 = 64.
```

A state `s ∈ Q6` is a six-bit word. In the implementation it is the low six bits
of a `u8`; the canonical string form is `S64-` followed by six binary digits.
Every public operation validates that the two unused high bits are zero
(`s ≤ 0b00111111`).

### 1.1 The 3+3 module decomposition

Each state splits into two three-bit modules. Writing the bits as `b5 b4 b3 b2 b1 b0`
(MSB first), define

```
L(s) = (s >> 3) & 0b111      (the "lower" module: high three bits)
U(s) =  s       & 0b111      (the "upper" module: low three bits)
```

The split is a purely combinatorial property — it carries no inherited meaning —
but it is what lets a transition be classified as internal to one module or
crossing both.

## 2. Elementary transitions

For source `s` and target `t` in `Q6`, the **mutation mask** is

```
m(s,t) = s ⊕ t ∈ Q6.
```

Bit `i` of `m` is 1 iff the two states differ in coordinate `i`. The mutation is
its own inverse on the target: `t = s ⊕ m`.

The **Hamming distance** is

```
d(s,t) = popcount(s ⊕ t) ∈ {0,…,6}.
```

The **per-module distances** are

```
d_L = popcount(L(s) ⊕ L(t)) ∈ {0,…,3},
d_U = popcount(U(s) ⊕ U(t)) ∈ {0,…,3},   with   d = d_L + d_U.
```

### 2.1 Module scope

```
scope(d_L,d_U) = none          if d_L = 0 ∧ d_U = 0
                 lower_only     if d_L > 0 ∧ d_U = 0
                 upper_only     if d_L = 0 ∧ d_U > 0
                 both_modules   if d_L > 0 ∧ d_U > 0
```

### 2.2 Regime classification

The regime class is a total function of `(d, d_L, d_U)`. Let `both = (d_L>0 ∧ d_U>0)`.
Evaluated in this order (the first matching clause wins):

```
no_change                if d = 0
bit_adjustment           if d = 1
module_reconfiguration   if d ≤ 2 ∧ ¬both
full_bit_reversal        if d = 6
near_total_inversion     if d ≥ 4
cross_module_regime_shift otherwise
```

Equivalently, by distance: `d=0` → `no_change`; `d=1` → `bit_adjustment`;
`d=2` → `module_reconfiguration` if confined to one module, else
`cross_module_regime_shift`; `d=3` → `cross_module_regime_shift`; `d∈{4,5}` →
`near_total_inversion`; `d=6` → `full_bit_reversal`. The six classes carry the
integer codes `0..5` in that order, shared with the TypeScript reference.

### 2.3 Transition index and packed word

The 64×64 = 4096 ordered pairs form the complete direct transition basis
(including the 64 identities; 64×63 = 4032 are non-identity). The canonical index
is

```
I(s,t) = 64·s + t ∈ [0..4096).
```

For low-overhead FFI the full per-transition record is packed into a 64-bit word
(`PackedTransition`), least-significant field first:

```
source:6 | target:6 | mutation:6 | distance:3 | d_L:2 | d_U:2 | scope:2 | regime:3 | index:12
```

This word is part of the cross-implementation contract and is checked bit-for-bit
against the TypeScript reference for all 4096 transitions.

## 3. Chains over Q6 and their compression

A chain is an ordered sequence `C = (s_0,…,s_n)` with each `s_i ∈ Q6`. Each step
yields a mask `m_i = s_{i-1} ⊕ s_i`, giving the ordered signature
`(m_1,…,m_n)`.

**Net mutation.**
```
M_net = m_1 ⊕ … ⊕ m_n.
```

> **Proposition 1.** `M_net = s_0 ⊕ s_n`.
> *Proof.* The XOR sum telescopes: `⊕_i (s_{i-1} ⊕ s_i) = s_0 ⊕ s_n`, since every
> interior `s_i` appears exactly twice and cancels. ∎

Consequently `M_net` depends only on the endpoints and discards path order: two
chains with the same endpoints share a net mutation. This is why the ordered
signature and the net mutation are kept as distinct objects.

**Cumulative distance.** `D_C = Σ_{i=1}^{n} popcount(m_i)` — total traversal
effort, which (unlike `M_net`) does not cancel out-and-back moves.

**Operative signature.** `Σ(C) = (s_0, s_n, (m_1,…,m_n), M_net, D_C)`. The
signature indexes the raw chain; it never replaces it (the raw chain remains
required for audit).

## 4. The four-level trajectory hierarchy (Q3)

Trajectories are typed over the eight-symbol alphabet `Q3 = {0,…,7}` (three bits).
The implementation (`packages/kernel/src/shapes.ts`, ported to
`packages/core-rs/src/shapes.rs`) defines four levels.

### Level 0 — Q3 alphabet
Eight elementary states `0..7`. The base symbols.

### Level 1 — T64 oriented edge
An ordered pair encoded as `e(a,b) = 8·a + b ∈ [0..64)`.

> **Proposition 2 (recoverability).** `e` is injective and orientation-preserving:
> `a = ⌊e/8⌋`, `b = e mod 8`, and `e(a,b) = e(b,a)` only when `a=b`.

T64 shares the cardinality 64 with a Q6 composite **point**, but it is an oriented
**edge** over Q3. The two are distinct types and never interconvert; the equal
count grants no shared operations.

### Level 2 — paths and the run-collapsed shape
`PathQ3` is a word over Q3 (the trajectory, length ≥ 1). `MutationPathQ3` is the
word of XOR steps. `NormalizedPathQ3` is the **run-collapse**: adjacent duplicate
states merge into a single run; **non-adjacent repeats are preserved** (so
`[0,1,0,3]` does *not* collapse and stays distinct from `[0,1,3]`). The **dwell**
vector records, in run order, how many path positions each run occupied.

> **Proposition 3 (lossless decomposition).** The map
> `path ↦ (shape, dwell)` is a bijection between Q3 paths and pairs `(shape, dwell)`
> where `shape` has no two adjacent entries equal and `dwell` is a positive-integer
> vector of the same length. *Proof.* Run-length encoding restricted to maximal
> constant runs; the no-adjacent-equal condition makes the run boundaries unique,
> so the encoding inverts by repeating `shape[k]` exactly `dwell[k]` times. ∎

### Level 3 — declared lossy projections
With their collapse factors:

| projection | image size | role |
|---|---|---|
| `net_mutation` (Q3) | 8 | coarse pre-filter only |
| `endpoint` code (T64) | 64 | medium pre-filter only |
| `endpoint_hamming` | scalar | magnitude only |
| `shape_key` | unbounded, injective on the run-collapsed shape | **form identity** |
| `exact_key` | unbounded, injective on the full path | **trajectory identity** |
| `dwell_signature` | unbounded | duration identity |

Here `net_mutation(C) = ⊕ m_i = first ⊕ last` (Proposition 1 over Q3), and
`endpoint(C) = e(first, last)`.

## 5. Comparison cascade and invariants

> **Proposition 4 (endpoint soundness).** Equal run-collapsed shape ⇒ equal
> endpoint. *Proof.* The shape's first and last entries are the path's first and
> last states (run-collapse never removes the extreme positions), and the endpoint
> is a function of those two. ∎

The converse is false: `[0,1,3]` and `[0,2,3]` share the endpoint `e(0,3)` but
have different shapes. Therefore the endpoint is a **sound pre-filter** (a
mismatch proves the shapes differ) but **never a form decision**.

**Design invariant.** No lossy projection (`net_mutation`, `endpoint`) may serve
as a form key. `shape_key` decides form; `exact_key` decides full identity;
`dwell_signature` distinguishes duration.

The comparison of two trajectories returns exactly one relation:

```
different_trajectory            if endpoints differ        (short-circuit, by Prop. 4)
different_pattern               else if shapes differ
equivalent                     else if dwell signatures equal
same_form_different_duration   otherwise
```

## 6. Determinism

Every operation above is a deterministic function of its integer inputs: no
floating point, no randomness, no clock or address dependence. Given the same
inputs, every implementation must produce identical outputs — this is enforced
exhaustively (all 4096 transitions; a seeded trajectory fixture) against the
TypeScript reference.

## 7. Visual grammar (non-normative)

For human inspection only, the renderer draws a `1` as a continuous row and a `0`
as a split row, upper visual row downward, with bit order fixed by the adapter.
The visual layer carries no semantic authority; any domain-specific orientation
must be declared separately.
