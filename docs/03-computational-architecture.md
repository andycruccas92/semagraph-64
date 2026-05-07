# Computational architecture

## Core architecture

```text
[Language Core]
      ↓
[Symbol Catalog]
      ↓
[Expression Schema]
      ↓
[SVG Renderer]
      ↓
[Symbolic Memory Records]
      ↓
[Retrieval and Similarity]
      ↓
[LLM-assisted Encoding]
      ↓
[Agent Orchestration]
```

## Packages

### `@semagraph/core`

Responsibilities:

- line types;
- trigram catalog;
- generated 64-state catalog;
- transformation engine;
- similarity utilities;
- symbolic memory data types;
- no rendering dependencies.

### `@semagraph/renderer-svg`

Responsibilities:

- render line;
- render trigram;
- render State64;
- render moving line markers;
- deterministic SVG output.

## Data flow

```text
context text
  -> LLM-assisted classifier
  -> candidate State64
  -> validator
  -> symbolic memory record
  -> retrieval by state / similarity / transformation
  -> orchestrator route
```

## First storage model

Use JSON files in examples for now. Later add SQLite/Postgres.

Proposed DB tables for a future version:

```sql
symbolic_states
symbolic_memory_records
symbolic_transformations
symbolic_state_links
interpretation_layers
```

## Why no ML first

The first bottleneck is not compute. The bottleneck is semantic control. The language must become stable before a model can learn it.

Recommended order:

1. stable symbols;
2. stable schema;
3. renderer;
4. examples;
5. retrieval;
6. LLM-assisted encoder;
7. small trained model.
