# ADR 10 — Pure Mathematical State64 Boundary

## Status

Accepted.

## Context

The previous repository retained optional inherited symbolic references for continuity. The current direction requires State64 to be treated as pure mathematics and machine-near transition compression.

## Decision

State64 is defined only as:

- a six-bit Boolean state space;
- two three-bit modules;
- mutation masks;
- Hamming distance;
- complete direct transition matrix;
- ordered chain compression;
- deterministic observed-measurement anchoring.

No inherited symbolic catalogue is authoritative or retained in the active v0.5 repository.

## Consequences

The project becomes easier to defend technically. Domain meaning must now be supplied by declared anchor rules, validated datasets and policy mappings rather than by symbolic inheritance.
