# ADR 12 — Transition Chain Compression

## Status

Accepted.

## Decision

SemaGraph distinguishes raw chains, ordered mutation signatures and net mutation masks.

```text
raw chain: S0 → S1 → S2
ordered signature: [M0, M1]
net mutation: M0 XOR M1
```

The ordered signature preserves path structure. The net mutation compresses only initial-to-final effect.

## Consequence

The system can support fast lookup and comparison while preserving enough provenance to prevent the compressed signature from replacing the raw chain.
