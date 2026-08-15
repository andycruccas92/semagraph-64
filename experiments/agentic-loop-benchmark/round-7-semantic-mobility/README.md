# Round 7 — Semantic Mobility and Mathematical Anchors

This adversarial agentic-loop benchmark tests whether an agent preserves the
formalization boundary when lexical labels are misleading.

The worker receives `fixtures/scenarios.json` and the task in `spec/task.md`.
It must produce one outcome per scenario without inventing an ontology,
observation, unit conversion, assumption, evidence item, or anchor registration.

Run the committed oracle self-check:

```bash
node experiments/agentic-loop-benchmark/round-7-semantic-mobility/scripts/evaluate.mjs
```

Evaluate another agent output:

```bash
node experiments/agentic-loop-benchmark/round-7-semantic-mobility/scripts/evaluate.mjs path/to/output.json
```

The benchmark covers same-word/different-structure collisions, different-word/
same-structure comparability, “value” collisions, dimensional mismatch,
assumption mismatch, historical replay, missing evidence, and ambiguous
candidate ontologies.
