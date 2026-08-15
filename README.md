# semagraph

The deterministic finite-state and trajectory-compression terminal of an
explicit formalization pipeline:

```text
phenomenon → observation → semantic interpretation
  → mathematical anchoring → predicate projection
  → State64 → trajectory → downstream inference/decision
```

SemaGraph does not interpret reality or discover the correct ontology for a
domain. It records a declared, versioned mathematical representation and then
operates on the resulting six-bit state alphabet (64 states, 4096 direct
transitions). The Rust hot path remains branchless, cache-resident, and free of
domain semantics.

The repository now contains two deliberately separate layers:

- `@semagraph/math-anchors` validates `X_d → M_d` formalization contracts,
  assumptions, scope, units, evidence, immutable registration, and replay;
- `@semagraph/state64-adapter` applies the registered six-predicate projection
  and creates canonical `S64-[01]{6}` states before the unchanged kernel takes
  over.

## Install

```bash
cargo install semagraph        # from crates.io (when published)
```

Or download a prebuilt binary from the releases page and run it directly — it is
statically linked with no runtime dependencies:

```bash
chmod +x semagraph && ./semagraph --help
```

Build from source in this repo:

```bash
cargo build --release -p semagraph   # binary at target/release/semagraph
```

## Examples

Classify one transition (human-readable by default):

```text
$ semagraph classify 5 2
source:       5  (000101)
target:       2  (000010)
mask:         7  (000111)
distance:     3
lower_dist:   0
upper_dist:   3
scope:        upper_only
regime:       cross_module_regime_shift
index:        322
packed:       346240610437
```

Compress a trajectory into its canonical signature:

```text
$ semagraph compress 0 1 1 3
path:           0 → 1 → 1 → 3
length:         4 states, 3 transitions
net_mutation:   3  (011)
cumulative_d:   2
endpoint:       0 → 3  (code 3)
shape:          0 1 3
dwell:          1 2 1
exact_key:      P3:0.1.1.3
shape_key:      S3:0.1.3
dwell_sig:      D3:1.2.1
```

Process an ensemble as NDJSON (one trajectory per input line, one result per
output line):

```text
$ printf '[0,1,3]\n[0,1,1,3]\n[0,2,3]\n' | semagraph batch
{"path":[0,1,3],"length":{"states":3,"transitions":2},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,1,3],"dwell":[1,1,1],"exact_key":"P3:0.1.3","shape_key":"S3:0.1.3","dwell_signature":"D3:1.1.1"}
{"path":[0,1,1,3],"length":{"states":4,"transitions":3},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,1,3],"dwell":[1,2,1],"exact_key":"P3:0.1.1.3","shape_key":"S3:0.1.3","dwell_signature":"D3:1.2.1"}
{"path":[0,2,3],"length":{"states":3,"transitions":2},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,2,3],"dwell":[1,1,1],"exact_key":"P3:0.2.3","shape_key":"S3:0.2.3","dwell_signature":"D3:1.1.1"}
```

Add `--json` to any command for machine-readable output. Data goes to stdout,
errors to stderr, exit code 0 on success.

## What it is / what it is not

It is:

- an explicit boundary between semantic interpretation, declared mathematics,
  and finite State64 processing;
- a deterministic classifier and compressor for trajectories over 64 states;
- branchless and cache-resident in its hot path;
- offline, with no runtime dependencies and no telemetry.

It is not:

- a universal knowledge engine or a universal ontology;
- a mechanism for selecting a mathematical anchor from ambiguous candidates;
- an inference engine — it never interprets what a regime or shape means;
- a statistical solver, a physics engine, or a general programming language;
- a reconstructor of trajectories from endpoints (endpoints are lossy).

## For AI agent use

The primary consumer is an automated agent parsing `--json` output. The exact
input/output contract, the anti-inference boundary, and the collapse-factor
table are in [TOOL_DESCRIPTION.md](TOOL_DESCRIPTION.md). Read that before wiring
the tool into an agent loop.

## Architecture

The design rationale — why six bits, why branchless, where it sits in the memory
hierarchy, and what is delegated to a language model — is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Domain examples

Worked examples translate the tool into the language of specific fields. See the
[`examples/`](examples/) folder:

- [`stochastic-simulation.md`](examples/stochastic-simulation.md) — the origin
  use case: grouping simulation rollouts by canonical shape.
- [`regime-switching-montecarlo.md`](examples/regime-switching-montecarlo.md) —
  path-dependent instruments and non-ergodic Monte Carlo.
- [`quantum-signal-analysis.md`](examples/quantum-signal-analysis.md) — classical
  analysis of measurement-shot sequences from quantum hardware.
- [`decision-making-deep-uncertainty.md`](examples/decision-making-deep-uncertainty.md)
  — quantized organizational decision trajectories.
- [`math-anchors/cross-domain-proof.md`](examples/math-anchors/cross-domain-proof.md)
  — engineering, organizational, and information/probabilistic formalizations
  sharing the same deterministic terminal without sharing an ontology.

## License

Apache 2.0. See [LICENSE](LICENSE).
