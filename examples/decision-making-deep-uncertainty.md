# SemaGraph for decision-making under deep uncertainty

> A deterministic compression layer for state-transition trajectories in complex
> stochastic systems, where sampling cost is the bottleneck and path-dependence
> is structural.

## The problem

Strategic decisions are made over qualitative parameters — positioning,
execution capability, market regime, organizational slack — that resist direct
measurement. To simulate decision trajectories under deep uncertainty (in the
Knightian sense: the distribution itself is unknown), these qualitative
parameters must first be quantized onto discrete, measurable axes. Only then can
you simulate how an organization moves through state space under different
scenarios.

## Anchoring is the quantization

The anchoring function `A: X → Q6` is exactly that quantization: it maps the
qualitative situation `X` onto a six-bit composite state (two three-bit modules,
e.g. an internal-capability module and an external-regime module). SemaGraph does
not perform the anchoring — that judgment is yours — but it processes its output:
once each scenario step is a Q6 state, a simulated decision path is a trajectory
SemaGraph can classify and compress.

## Path-dependence is structural

Two organizations can arrive at the same state through different histories, and
those histories carry different option value: the one that reached a strong
position through a turnaround holds different real options than the one that was
always there. Endpoint summaries erase this; `exact_key` and `shape_key` preserve
it. The run-collapsed `shape_key` captures the ordered sequence of regimes the
organization passed through, which is the strategically meaningful structure.

## How SemaGraph helps

1. Anchor each scenario step to a state (your `A: X → Q6`).
2. For pairwise scenario comparison, use `compare` to get the structural relation
   (equivalent, same form different duration, different pattern, different
   trajectory).
3. For a scenario ensemble, use `batch` and tally `shape_key` to see which regime
   sequences dominate the simulation, and to separate same-destination scenarios
   that imply different strategic options.

```bash
semagraph compare 0 1 1 3 -- 0 1 3
# relation: same_form_different_duration  (same regime sequence, different dwell)
```

SemaGraph classifies the decision trajectories; it does not recommend a decision
or interpret what a given regime sequence implies for your organization. The
labels are structural; the strategy is yours.
