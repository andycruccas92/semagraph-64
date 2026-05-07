# Complete development program

## Target

Build SemaGraph-64 from language scaffold to usable symbolic memory layer for LLM agent orchestration.

## Phase 0 — Repository and formal scaffold

Duration: 1 week.

Goal: make the repository stable enough for agent-assisted development.

Deliverables:

- monorepo structure;
- AGENTS.md;
- TypeScript core package;
- SVG renderer package;
- basic tests;
- formal documentation;
- JSON schemas;
- examples;
- CI pipeline.

Exit criteria:

- `pnpm build` passes;
- `pnpm test` passes;
- `pnpm typecheck` passes;
- README explains non-divinatory framing.

## Phase 1 — Language core stabilization

Duration: 2–3 weeks.

Goal: make the formal language internally consistent.

Tasks:

1. finalize line model;
2. finalize trigram catalog;
3. generate 64 state catalog deterministically;
4. add stable IDs;
5. define moving line semantics;
6. define transformation engine;
7. add similarity metrics;
8. add validation tests.

Exit criteria:

- 8 trigrams fully tested;
- 64 states generated and snapshot-tested;
- transformation engine tested for all line positions;
- similarity function deterministic.

## Phase 2 — Renderer and visual identity

Duration: 2–3 weeks.

Goal: make glyphs renderable, stable, and visually coherent.

Tasks:

1. render line;
2. render trigram;
3. render State64;
4. render moving line markers;
5. export SVG string;
6. add size/stroke options;
7. add snapshot tests;
8. generate a static gallery.

Exit criteria:

- all states render to valid SVG;
- renderer has no dependency on browser globals;
- visual output is deterministic.

## Phase 3 — Concept wiki MVP

Duration: 3–5 weeks.

Goal: create a navigable concept layer.

Tasks:

1. create concept entry schema;
2. write 8 trigram concept pages;
3. write 64 minimal state pages;
4. add examples and counterexamples;
5. add optional traditional reference fields;
6. add search by keyword, trigram, and state;
7. create static documentation page or simple web app.

Exit criteria:

- every state has a minimal concept entry;
- state pages distinguish formal, pedagogical, and optional traditional layers;
- search works locally.

## Phase 4 — Symbolic memory layer

Duration: 3–4 weeks.

Goal: encode context events as symbolic memory records.

Tasks:

1. define `SymbolicMemoryRecord`;
2. define `SymbolicTrajectory`;
3. create JSON store adapter;
4. create in-memory retrieval functions;
5. retrieve by exact state;
6. retrieve by similar state;
7. retrieve by transformation path;
8. create sample conversation trajectory.

Exit criteria:

- memory records validate against schema;
- retrieval works without ML;
- sample trajectory is documented.

## Phase 5 — LLM-assisted encoder prototype

Duration: 3–6 weeks.

Goal: use an LLM to propose candidate symbolic states from text, but keep validation deterministic.

Tasks:

1. define encoder prompt contract;
2. define allowed output JSON;
3. add state candidate validator;
4. add confidence field;
5. add reason field;
6. reject unknown states;
7. add test fixtures;
8. add manual review workflow.

Exit criteria:

- the LLM cannot invent states;
- all output validates against schema;
- low-confidence outputs are flagged for review.

## Phase 6 — Agent routing demo

Duration: 3–6 weeks.

Goal: show practical use with a simple orchestrator.

Tasks:

1. create `routeAgent(state)` function;
2. define 5–8 agent roles;
3. map state tags/tensions to routes;
4. add memory retrieval before routing;
5. generate routing explanation;
6. create CLI demo;
7. create minimal web demo.

Exit criteria:

- demo accepts text input;
- outputs state proposal;
- stores symbolic memory;
- retrieves similar records;
- routes to an agent role;
- explains the decision.

## Phase 7 — Dataset and benchmark

Duration: 2–4 months.

Goal: create a curated dataset suitable for future model training.

Tasks:

1. define annotation guide;
2. create 500 simple examples;
3. create 1000 context-state examples;
4. create negative examples;
5. create ambiguous examples;
6. measure inter-annotator consistency if possible;
7. define retrieval benchmarks;
8. define routing benchmarks.

Exit criteria:

- dataset versioned;
- annotation rules documented;
- benchmark scripts reproducible.

## Phase 8 — Small model experiments

Duration: 3–6 months after dataset maturity.

Goal: train or fine-tune small models for symbolic classification and sequence completion.

Candidate tasks:

- text -> candidate state;
- partial state -> completed state;
- source state + moving lines -> target state;
- memory trajectory -> next likely state class;
- state pair -> analogy score.

Exit criteria:

- model improves over rules on benchmark;
- model does not replace deterministic validation;
- model output remains interpretable.

## Budget levels

Prototype using internal work and coding agents: low cost, mostly time.

Serious language + dataset + demo: moderate cost.

Advanced proprietary model: separate funded research program.

Do not invest in heavy model training before Phase 7.
