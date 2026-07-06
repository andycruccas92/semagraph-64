# SemaGraph for stochastic simulation

> A deterministic compression layer for state-transition trajectories in complex
> stochastic systems, where sampling cost is the bottleneck and path-dependence
> is structural.

## The problem

A stochastic simulation kernel produces trajectories: ordered sequences of
discrete states sampled from some transition process. To characterize the
system you run an ensemble — many rollouts — and look at how the trajectories
distribute. The cost is the rollout. On consumer hardware, getting enough
samples for a stable estimate can be infeasible: the kernel was non-portable
precisely because robustness demanded more rollouts than the hardware could
produce in reasonable time.

The usual response is "run more samples". That attacks the statistics. It does
not change what you do with the samples you already have.

## The change of representation

Instead of comparing raw trajectories (which almost never repeat exactly),
collapse each trajectory to a canonical form and measure the distribution over
forms. Two rollouts that visit the same ordered set of distinct states — ignoring
how long they dwelled in each — share a `shape_key`. The empirical distribution
over `shape_key` buckets stabilizes with far fewer rollouts than the distribution
over raw paths, because the form space is coarser than the path space while still
preserving the structure that matters: the order of regimes visited.

This is deterministic classification of stochastic output. The randomness stays
in the kernel; the classification adds none.

## Concrete example

Take an ensemble of N rollouts over the eight-state Q3 alphabet. Pipe them
through `batch` and tally `shape_key`:

```bash
# rollouts.ndjson: one trajectory (JSON array of states 0..7) per line
semagraph batch < rollouts.ndjson \
  | python3 -c 'import sys,json,collections; \
c=collections.Counter(json.loads(l)["shape_key"] for l in sys.stdin); \
[print(f"{k}\t{n}") for k,n in c.most_common()]'
```

Output is a frequency distribution over canonical shapes:

```
S3:0.1.3      412
S3:0.2.3      318
S3:0.1.0.3    109
...
```

Each bucket is a set of rollouts that share a trajectory form. You now measure
convergence of the histogram over shapes rather than convergence of a raw path
statistic, and you can distinguish two rollouts that reach the same endpoint via
different shapes — a distinction endpoint-only summaries destroy.

`shape_key` decides form. If you also care about how long the system dwelled in
each regime, `dwell_signature` separates same-shape rollouts by duration;
`exact_key` recovers full path identity when you need it.
