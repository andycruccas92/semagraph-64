# SemaGraph — architecture decision record (consolidated)

This is the single, authoritative decision log for SemaGraph. It **replaces** the
former per-file ADRs (`docs/10`–`docs/15`) and the historical narrative notes
(`docs/00`–`docs/09`), which have been removed; their still-relevant content is
summarized here or has moved into [`FORMAL-MODEL.md`](FORMAL-MODEL.md) and
[`ARCHITECTURE.md`](ARCHITECTURE.md).

Each entry records **Status / Context / Decision / Consequences**. Status is one
of *Accepted*, *Accepted (active)*, or *Superseded*.

---

## D1 — State64 is pure finite mathematics
**Status:** Accepted. *(was ADR 10)*

**Context.** Earlier iterations retained optional inherited symbolic references.
The project requires State64 to be defensible as mathematics, not lineage.

**Decision.** State64 is defined only as: a six-bit Boolean space `Q6`; two
three-bit modules; XOR mutation masks; Hamming distance; the complete 64×64 direct
transition matrix; ordered chain compression; and deterministic anchoring. No
symbolic catalogue is authoritative.

**Consequences.** Domain meaning must come from declared anchor rules, validated
data and policy mappings. The six-bit alphabet and its 3+3 decomposition are
stipulated finite Boolean design choices and carry no inherited semantics.

## D2 — Deterministic observed-state anchoring
**Status:** Accepted. *(was ADR 11)*

**Context.** State must not be inferred by a language model.

**Decision.** States are produced by an explicit anchoring map `A_R: X → Q6` from
observed/parametric inputs `X` under a versioned rule set `R = (r_1,…,r_6)`. The
anchor record retains measurement key, value, optional unit/source/timestamp/
tolerance, rule version, the resulting state, and a per-bit decision trace.

**Consequences.** Inference is pushed out of the transition chain; given the same
inputs and rule version, the chain is replayable. Measurement uncertainty lives at
the measurement layer, not in the kernel.

## D3 — Three distinct compression levels
**Status:** Accepted. *(was ADR 12)*

**Decision.** Keep raw chains, ordered mutation signatures, and net mutation as
*separate* objects. The ordered signature preserves path structure; the net
mutation (`= s_0 ⊕ s_n`, Proposition 1) preserves only the endpoint effect.

**Consequences.** Fast lookup/comparison without letting a compressed signature
replace the raw chain. Raw-chain retention is mandatory to prevent
false-equivalence (distinct chains sharing a net mutation).

## D4 — Rust core as the machine-near kernel
**Status:** Accepted (active). *(was ADR 13; parity now achieved)*

**Context.** TypeScript is ideal for specification but not for a high-throughput,
WASM/C-ABI compression kernel.

**Decision.** `packages/core-rs` is a zero-runtime-dependency Rust crate
implementing validated six-bit states/masks, XOR mutation, popcount distance,
64×64 indexing, transition metadata, ordered chain compression, and compact C-ABI
helpers.

**Consequences.** TypeScript remains the reference/specification layer; the Rust
core is verified against it by an exhaustive 4096-transition parity fixture
(including the packed FFI word) and is now the candidate computational authority.
WASM/C/Python/Postgres bindings remain viable future directions. No domain
semantics or model inference live in Rust.

## D5 — Kernel / language-model boundary
**Status:** Accepted. *(was ADR 14)*

**Decision.** A language model may request kernel processing, explain results, and
synthesize policy from compressed signatures. It must **not** fabricate
observations, or change states, masks, or signatures. The AI tool
(`ai-tools/semagraph-kernel-tool`) exposes only deterministic operations
(`anchor`, `lookup`, `compress`, `policy_context`).

**Consequences.** Inference cannot propagate into the deterministic chain; all
structural outputs are reproducible and independently checkable.

## D6 — Branchless, cache-resident classification
**Status:** Accepted (v0.7).

**Context.** The real workload is classifying/grouping large ensembles of
trajectories, not one transition at a time.

**Decision.** Per-transition metadata is read from compile-time `const` lookup
tables indexed by the mutation mask, with no data-dependent branch in the hot
loop. The tables (≈4.4 KiB total, including the spec-required
`REGIME_BY_TRANSITION: [u8;4096]`) are built from the same `const fn` classifiers
as the scalar path and are L1-resident.

**Consequences.** Classification is a sequence of L1-latency loads. An exhaustive
test asserts the branchless path equals the validated path on all 4096
transitions.

## D7 — Struct-of-arrays batch API; optional SIMD
**Status:** Accepted (v0.7).

**Decision.** Provide `classify_batch` / `classify_batch_full` over struct-of-arrays
input into caller-provided buffers, written as flat counted loops the compiler can
auto-vectorize, plus a trajectory batch. An explicit SSE2 path sits behind a
non-default `simd` feature with an always-correct scalar fallback and a
simd==scalar test.

**Consequences.** The scalar batch is the source of truth; SIMD is a demonstration,
never a divergence.

## D8 — Q3/T64 four-level trajectory hierarchy
**Status:** Accepted (v0.7).

**Decision.** Port the `shapes.ts` four-level hierarchy (Q3 alphabet, T64 oriented
edges distinct from Q6 points, paths + run-collapsed shape + dwell, declared lossy
projections) to Rust, with run-collapse adjacent-only and dwell aligned to runs.
Add the new `cumulativeDistanceQ3` projection to the TypeScript reference so the
port stays parity-checked, and add a seeded shape-parity fixture + test.

**Consequences.** No lossy projection may be a form key; `shape_key` decides form.
Parity is exhaustive on a seeded trajectory fixture.

## D9 — `semagraph` CLI with a stable JSON contract
**Status:** Accepted (v0.7).

**Decision.** Ship a single binary `semagraph` (subcommands `classify`, `compress`,
`compare`, `lookup`, `batch`, `verify`). Human-readable output by default; `--json`
emits a compact JSON contract treated as a public API. Data → stdout, errors →
stderr, exit code 0/1/2. Argument parsing and JSON emission are hand-rolled: the
binary has **no third-party dependencies**. `batch` is NDJSON in/out for streaming.

**Consequences.** The JSON field names/structure are frozen without a major bump;
they are documented exactly in `TOOL_DESCRIPTION.md`. The CLI is a consumer of the
kernel, never a reimplementation.

## D10 — Cargo workspace and release distribution
**Status:** Accepted (v0.7).

**Decision.** A Cargo workspace at `packages/Cargo.toml` (members `core-rs`,
`cli`), with `[profile.release]` at the workspace root. A tag-triggered release
workflow builds static Linux (musl), macOS (x86_64 + aarch64) and Windows binaries
with SHA-256 checksums attached to the GitHub release.

**Consequences.** `cargo install` and direct binary download both work; CI runs
the whole workspace (`clippy --workspace`, `test --workspace`).

## D11 — Explanatory research paper
**Status:** Accepted (v0.8). *(supersedes ADR 15 and the earlier bilingual layout)*

**Decision.**
`paper/overleaf/from_semantic_mobility_to_formal_representation_en.tex` is the
canonical paper source. It presents mathematical anchoring and representational
provenance as the general framework, with SemaGraph-64 explicitly limited to a
six-bit reference architecture and computational appendix.

**Non-claims (binding on all prose).** SemaGraph is not a physics engine, a general
programming language, a universal simulator, a replacement for numerical/statistical
solvers, or a model of quantum evolution; it makes no complexity-theory or P-vs-NP
claim. Performance statements are either measured numbers or are explicitly marked
as architectural expectations.

## D12 — Documentation consolidation
**Status:** Accepted (v0.7).

**Decision.** `docs/` is reduced to [`ARCHITECTURE.md`](ARCHITECTURE.md) (prose
rationale), [`FORMAL-MODEL.md`](FORMAL-MODEL.md) (mathematics), and this
`DECISIONS.md` (decision log). The numbered notes (`00`–`09`) and per-file ADRs
(`10`–`15`) are removed; their content is folded into these three files or the
paper.

**Consequences.** A reader has one place per concern. Historical task prompts under
`codex-prompts/` are left frozen and may reference removed filenames; they are not
part of the live documentation.

## D13 — Governance and IP surface
**Status:** Accepted. *(was the governance note)*

**Decision.** The protectable surface is the *architecture* — deterministic
anchoring, transition-chain compression, signature indexing, policy stabilization
— not a symbolic catalogue. Open components may include the finite State64 algebra,
the renderer, and the generic kernel contracts; reserved components may include
domain anchor rules, validated trajectory datasets, policy mappings and benchmark
results. The code is licensed Apache-2.0.

## D14 — Mathematical anchors are the formalization boundary
**Status:** Accepted (v0.8).

**Context.** D2 records a deterministic map from observations to Q6, but a direct
parameter predicate does not state which mathematical structure licenses that
map. The missing layer makes similarly named domain concepts easy to conflate.

**Decision.** Introduce a TypeScript mathematical-anchor layer upstream of
`state64-adapter`. For a domain `d`, it declares `X_d`, an admitted subset
`D_d = dom(φ_d)`, an operational mathematical structure `M_d`, a versioned
formalization map `φ_d : D_d → M_d`, and a six-predicate projection
`P_R : M_d → B^6`, so the SemaGraph authoritative map is
`A_{d,R} = P_R ∘ φ_d : D_d → B^6`. This is the `C_R = B^6` specialization of the
paper's general computational codomain. Existing direct observed-parameter
anchoring remains a separate compatibility mode and is not silently
reinterpreted.

**Consequences.** Authoritative mathematical anchoring requires explicit
assumptions, validity scope, variables, relations, bindings, units, projection,
and provenance. This is a representation under declared assumptions, not an
ontological claim about the phenomenon.

## D15 — Semantic labels are non-authoritative
**Status:** Accepted (v0.8).

**Context.** Terms such as “distance”, “value”, “state”, and “uncertainty” are
semantically mobile across domains.

**Decision.** Lexical labels are descriptive metadata only. Mathematical
identity is determined by immutable structure descriptors and operational
contracts. Lexical equality does not establish anchor equality; structural
similarity does not establish semantic identity.

**Consequences.** A metric distance, graph shortest path, and decision cost stay
distinct even when all are labelled “distance”. Comparable structures may be
reported as structurally comparable without claiming their domains mean the same
thing.

## D16 — Candidate and registered anchors are distinct authorities
**Status:** Accepted (v0.8).

**Context.** Humans, language models, and automated discovery may all propose a
plausible mathematical representation, sometimes with unresolved alternatives.

**Decision.** Candidate anchors are non-authoritative hypotheses. Only an
explicit, versioned, structurally validated anchor accepted into an immutable
registry may produce an authoritative State64 record. Registration never selects
among ambiguous candidates automatically.

**Consequences.** Model-generated anchor proposals cannot assign State64. A
registry rejects identifier/version collisions with different definitions, and
historical replay resolves the historical immutable version rather than the
latest one.

## D17 — Domain mathematics stays outside the Rust transition kernel
**Status:** Accepted (v0.8).

**Context.** The Rust hot path derives its value from a complete, tiny, domain-
neutral finite transition basis. Domain formalization has different evolution,
validation, and evidence requirements.

**Decision.** Mathematical-domain metadata, formalization maps, units,
assumptions, evidence, and projection contracts remain in the TypeScript
formalization/integration layers. `packages/core-rs` continues to accept only
validated finite states and trajectories.

**Consequences.** The 64×64 basis, packed word, branchless tables, CLI transition
JSON, and TypeScript/Rust parity fixtures do not change. New AI operations for
mathematical anchoring are deterministic integration tools, not Rust-kernel
semantics.

## D18 — SemaGraph is the Q6 experimental instrument, not the theory
**Status:** Accepted (v0.8).

**Context.** The mathematical-anchoring framework permits general computational
codomains and has substantial antecedents in measurement, semantic anchoring,
ontology governance, provenance and task-relative compression. SemaGraph
implements only the finite `C_R = Q6` terminal and its downstream algebra.

**Decision.** Position SemaGraph-64 as a controlled platform for studying
structural computation over epistemically anchored states under a fixed six-bit
representational budget. Keep `packages/math-anchors` limited to registration,
validation, formalization and provenance contracts. Make executable experiments
first-class repository surfaces without moving experimental metrics into the
authoritative kernel.

**Consequences.** The public question becomes what happens when an explicit
mathematical representation is compressed into a deterministic six-bit
terminal. Collision, entropy, decision/ranking preservation and trajectory
equivalence are measured outside the kernel. Experimental results remain
fixture-relative and cannot establish ontological truth or general adequacy.

---

## Appendix — open research questions and backlog

Carried over from the former research notes and backlog; these are hypotheses and
intentions, not commitments:

1. Does signature/shape processing reduce computation versus full-trajectory
   processing, and by how much (to be measured, not assumed)?
2. Does policy reuse keyed by signature improve consistency?
3. How much decision-relevant information is lost by compression, and which
   false-equivalence cases arise (distinct chains, identical net mutation)?
4. Which domains permit deterministic anchoring directly from measurements, and
   which require an uncertainty envelope first?
5. Should registered anchors encode a separate task and authorized-computation
   scope, plus governance evidence beyond the current `acceptedBy` identity and
   validity scope?
6. Open work items: compression-benchmark fixtures and metrics; uncertainty-
   envelope support; chain-equivalence classes and false-equivalence tests;
   policy/signature matching examples; learned anchoring (deliberately out of
   scope); FPGA/lookup-ROM single-cycle classifier (speculative).
