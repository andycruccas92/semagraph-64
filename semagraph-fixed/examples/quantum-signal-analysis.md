# SemaGraph for quantum-hardware signal analysis

> A deterministic compression layer for state-transition trajectories in complex
> stochastic systems, where sampling cost is the bottleneck and path-dependence
> is structural.

## Important distinction — read first

**SemaGraph does not model quantum evolution.** It does not represent continuous
unitary dynamics, complex amplitudes, superposition, or entanglement. It operates
on the *classical* sequences of measurement outcomes produced *after* collapse.
It is a classical signal-analysis layer sitting on top of quantum hardware
output — nothing in it is quantum.

## The problem

Running a circuit on quantum hardware produces shots: each shot is a measurement
that collapses the register to a classical basis state. A run is many shots. The
sequence of measured basis states across shots (or across repeated measurements
within a protocol) is a classical trajectory over the basis-state space. Shot
budget is the bottleneck — hardware time is expensive — so you want robust
pattern characterization from as few shots as possible.

## The mapping

For six qubits there are 2^6 = 64 basis states. Transitions between measured
basis states are exactly the 4096-entry T64 transition space SemaGraph already
enumerates. A sequence of measurement outcomes over the eight-symbol Q3 alphabet
(or, for the full register, over the 64-state space via `classify`/`lookup`) is a
trajectory; its run-collapsed `shape_key` is a canonical label for the measured
pattern.

## How SemaGraph helps

Group shot sequences by `shape_key` before statistical analysis. Sequences that
realize the same ordered pattern of measured states collapse into one bucket
deterministically, so you estimate the distribution over measurement patterns
from the histogram of shapes rather than from raw shot strings. This reduces the
number of shots needed for a stable pattern estimate, and it cleanly separates
sequences that reach the same final measurement via different intermediate
patterns.

```bash
# shots.ndjson: one measured-state sequence per line
semagraph batch < shots.ndjson | jq -r '.shape_key' | sort | uniq -c | sort -rn
```

`endpoint_code` (first/last measured state) is a coarse pre-filter only; the
measured pattern identity is `shape_key`. SemaGraph labels the patterns; it does
not infer anything about the underlying quantum state or process.
