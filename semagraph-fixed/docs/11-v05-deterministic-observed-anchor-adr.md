# ADR 11 — Deterministic Observed-State Anchor Layer

## Status

Accepted.

## Decision

The canonical State64 path anchors states from observed measurements or known parameter feeds. A language model must not assign the observed state.

## Flow

```text
measurements + anchor-rule version → State64
```

The anchor result records:

- measurement key;
- value;
- optional unit/source/timestamp/tolerance;
- anchor-rule version;
- resulting six-bit state;
- per-bit decision trace.

## Consequence

Inference is pushed out of the transition chain. The chain itself becomes replayable given the same measurements and anchor rules.
