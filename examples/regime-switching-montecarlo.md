# SemaGraph for regime-switching Monte Carlo

> A deterministic compression layer for state-transition trajectories in complex
> stochastic systems, where sampling cost is the bottleneck and path-dependence
> is structural.

## The problem

Path-dependent instruments — barrier options, lookback options, Asian options,
and real options under deep uncertainty — are not priced by the terminal value
alone. The trajectory matters: whether and when a barrier was touched, which
regime the path passed through, how long it stayed there. Monte Carlo is the
standard tool, but convergence is slow when the underlying is non-ergodic or
regime-switching (in the sense of Hamilton's Markov-switching models).

## Why the ensemble mean is not enough

In a non-ergodic system the ensemble average does not equal the time average
(this is the central point of ergodicity economics, Peters). Collapsing an
ensemble of paths to a single expected value discards exactly the structure that
a path-dependent payoff is sensitive to. What you want is the distribution over
*typical trajectories* — the shapes the process actually takes — not a point
estimate of the mean.

`shape_key` is a natural representation for this. It preserves the ordered
sequence of regimes a path visits (its run-collapsed shape) while quotienting out
the parts an ensemble average would otherwise smear together. Two paths that end
at the same level via different regime sequences have different option value, and
they receive different `shape_key`s; the endpoint code, by contrast, is a coarse
64-bucket pre-filter and must never be used as the path identity.

## How SemaGraph helps

1. Quantize each simulated path into states (your mapping from price/regime to a
   discrete alphabet).
2. Classify the ensemble with `batch`, bucketing by `shape_key`.
3. Read the empirical distribution over shapes. Estimate payoff conditional on
   shape, then weight by shape frequency — a stratification that converges faster
   than pooling all paths, because variance within a shape bucket is lower than
   variance across the whole ensemble.

```bash
semagraph batch < mc_paths.ndjson \
  | jq -r '.shape_key' | sort | uniq -c | sort -rn
```

Same-endpoint, different-path trajectories — the ones that break endpoint-only
pricing — are exactly the ones `shape_key` keeps apart. `dwell_signature`
additionally separates paths by how long they persisted in each regime, relevant
for time-weighted (Asian-style) payoffs.

SemaGraph does not price the instrument and has no view on the payoff. It supplies
the canonical trajectory classification; the pricing model is yours.
