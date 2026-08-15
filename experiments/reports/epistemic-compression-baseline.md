# Epistemic-compression synthetic baseline

Command:

```bash
pnpm test:epistemic-compression
```

Fixture version: `1.0.0`. All eight metrology self-checks passed. This run is a
deterministic synthetic baseline and provides no empirical confirmation of the
paper's H1-H5 hypotheses.

## Semantic contracts

| metric | result |
|---|---:|
| same-label/different-structure pairs | 3 |
| different-label/shared-structure pairs | 1 |
| asserted semantic identities | 0 |

## Registered-anchor comparison

| metric | result |
|---|---:|
| records | 16 |
| identical State64 under both anchors | 7 (43.75%) |
| average cross-anchor Hamming disagreement | 1.5625 bits |

Distinct registered projections can therefore be indistinguishable for some
evidence and materially different for other evidence.

## Projection distortion and provenance

| anchor | occupied states | state entropy | rich-input collision rate | largest bucket | trace completeness |
|---|---:|---:|---:|---:|---:|
| `balanced-projection` | 8 | 2.774397 bits | 11.6667% | 5 records | 100% |
| `selective-projection` | 9 | 3.030639 bits | 7.5% | 3 records | 100% |

Complete provenance does not reverse a collision. It does preserve the
predicate, formal relation, observation binding and evidence path that explains
how every compressed bit was produced.

## Declared task preservation

| anchor | binary decision preservation | pairwise ranking preservation |
|---|---:|---:|
| `balanced-projection` | 81.25% | 69.7479% |
| `selective-projection` | 68.75% | 70.5882% |

The fixture exposes a real trade-off: the projection with fewer rich-input
collisions and slightly higher state entropy is not the one that best preserves
the declared binary decision.

## Trajectory identity collapse

Across 36 unordered path-record pairs, the number of distinct exact paths made
indistinguishable by each identity level was:

| projection/identity | false-equivalence pairs relative to exact path |
|---|---:|
| endpoint | 15 |
| net mutation | 15 |
| run-collapsed shape | 3 |
| exact path | 0 |

The comparison cascade also found three same-form/different-duration pairs,
confirming that shape and dwell remain separate identities.
