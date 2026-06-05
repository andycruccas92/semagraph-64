# Formal Model

## State space

State64 defines a finite state space:

```text
S = {0,1}^6
|S| = 64
```

Each state is a six-bit vector:

```text
s = (b1,b2,b3,b4,b5,b6), bi ∈ {0,1}
```

The lower module is `(b1,b2,b3)`. The upper module is `(b4,b5,b6)`.

## Mutation mask

A mutation mask is also a six-bit vector:

```text
m ∈ {0,1}^6
```

A transition is computed by XOR:

```text
s_next = s_current XOR m
```

The direct mutation mask between two states is:

```text
m = s_a XOR s_b
```

The transition distance is the Hamming weight of the mask:

```text
distance = popcount(m)
```

## Transition basis

The complete direct transition basis is:

```text
64 x 64 = 4096 state pairs
```

Including identity transitions, every source-target pair is precomputable and replayable.

## Chain compression

A chain is an ordered sequence:

```text
S0 → S1 → ... → Sn
```

Each segment produces one mutation mask:

```text
Mi = Si XOR Si+1
```

The ordered signature preserves the path:

```text
[M0, M1, ..., Mn-1]
```

The net mutation compresses only the initial-to-final effect:

```text
M_net = M0 XOR M1 XOR ... XOR Mn-1
```

The ordered signature and net mutation must remain distinct because the net mutation loses sequence information.

## Deterministic anchoring

Observed values are mapped to bits by declared anchor rules. Given the same measurements and anchor-rule version, the same State64 code must be produced.
