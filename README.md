# SemaGraph-64

SemaGraph-64 is a reference implementation for moving from semantically mobile
domain language to explicit mathematical structure and then to deterministic,
auditable computation.

Its central boundary is simple: a human or language model may propose how a
phenomenon should be represented, but only an explicit, versioned and registered
mathematical contract may produce an authoritative computational state.

```text
phenomenon
  -> observation and evidence
  -> semantic hypotheses
  -> mathematical anchor (X_d -> M_d)
  -> registered projection (M_d -> B^6)
  -> State64 / Q6
  -> transition and trajectory compression
  -> downstream inference or decision
```

The mathematical model is an operational representation under declared
assumptions. It is not asserted to be the true ontology of the phenomenon.

## Mathematical anchoring

For a domain `d`, an anchor declares an admissible observation domain `X_d`, a
mathematical structure `M_d`, and a deterministic formalization map:

```text
phi_d : X_d -> M_d
```

A registered projection version `R` evaluates six declared predicates:

```text
P_R : M_d -> B^6
A_(d,R) = P_R o phi_d : X_d -> B^6
```

The contract retains its assumptions, validity scope, variables, relations,
units, observation bindings, evidence requirements and provenance. Natural-
language labels are descriptive metadata only: two relations called
"distance" need not share a mathematical structure, while differently named
relations may still be structurally comparable.

Candidate anchors remain non-authoritative. Registration is explicit and
immutable, historical versions remain replayable, and missing observations or
evidence are rejected rather than inferred.

## State64 terminal

The registered projection produces an element of `Q6 = {0,1}^6`, represented by
the canonical identifier `S64-[01]{6}`. The finite kernel then operates only on
that six-bit state:

- mutation mask: `m(s,t) = s XOR t`, canonically `M64-[01]{6}`;
- Hamming distance: `d(s,t) = popcount(s XOR t)`;
- complete direct transition basis: `64 x 64 = 4096` ordered pairs;
- ordered chain signatures and run-collapsed trajectory shapes;
- explicit lossy projections such as endpoints and net mutation.

Six bits are a deliberately small experimental terminal, not a universality
claim. State64 does not contain the phenomenon, the evidence or the full
mathematical model; it contains six declared binary distinctions produced under
one registered contract.

## What the repository implements

| Paper layer | Repository surface | Authority boundary |
|---|---|---|
| Candidate and registered mathematical anchors | [`packages/math-anchors`](packages/math-anchors/) | TypeScript validates structure, immutable versions, evidence and replay; it never chooses an ontology. |
| `M_d -> B^6` projection | [`packages/state64-adapter`](packages/state64-adapter/) | Only registered anchors may create authoritative State64 records. |
| State64 transitions and trajectories | [`packages/kernel`](packages/kernel/) | TypeScript is the reference specification. |
| Machine-near finite kernel and CLI | [`packages/core-rs`](packages/core-rs/) and [`packages/cli`](packages/cli/) | Rust receives validated states only and is parity-checked against TypeScript. |
| Deterministic AI integration | [`ai-tools/semagraph-kernel-tool`](ai-tools/semagraph-kernel-tool/) | Models may propose candidates and consume results; they cannot register anchors, invent evidence or mutate structural outputs. |
| Research evaluation | [`experiments/agentic-loop-benchmark`](experiments/agentic-loop-benchmark/) | Benchmarks test declared hypotheses; they do not turn them into established general results. |

The legacy `deterministic_observed_parameters` path remains available for direct
predicate anchoring. It is kept distinct from
`deterministic_mathematical_anchor` and is never silently promoted to it.

## Quick start

TypeScript requires Node.js 22 and pnpm 9:

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

Build and test the Rust workspace with a stable toolchain:

```bash
cargo build --manifest-path packages/Cargo.toml --release -p semagraph
cargo test --manifest-path packages/Cargo.toml --workspace
```

The CLI binary is written to `packages/target/release/semagraph`. Its stable JSON
contract and examples are documented in
[`TOOL_DESCRIPTION.md`](TOOL_DESCRIPTION.md).

## Paper and technical documentation

The conceptual framework, intellectual lineage, limits and research hypotheses
are developed in the canonical paper source:

- [*From Semantic Mobility to Formal Representation: Mathematical Anchoring and Epistemic Provenance in Computational Knowledge Systems*](paper/overleaf/from_semantic_mobility_to_formal_representation_en.tex)

The live technical documentation is split by concern:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - engineering rationale and
  layer boundaries;
- [`docs/FORMAL-MODEL.md`](docs/FORMAL-MODEL.md) - formal specification and
  invariants;
- [`docs/DECISIONS.md`](docs/DECISIONS.md) - consolidated architecture decisions;
- [`VALIDATION.md`](VALIDATION.md) - executed checks and parity evidence.

Worked cross-domain examples are under [`examples/`](examples/), including a
three-domain proof that unrelated domains can share the same finite terminal
without sharing an ontology.

## Explicit non-claims

SemaGraph-64 is not a universal ontology, an inference engine, a mechanism for
automatically selecting among ambiguous candidate anchors, a replacement for
domain measurement or statistical modeling, or a proof that arbitrary phenomena
can be represented adequately in six bits. Kernel determinism establishes
replayable computation under a contract; it does not establish that the contract
is true or adequate for every task. The mathematical-anchor package validates
contracts, bindings and finite predicate projections; it is not a general solver
for every mathematical structure named by its vocabulary.

## License

Apache 2.0. See [`LICENSE`](LICENSE).
