# SemaGraph-64

SemaGraph-64 is an experimental visual-symbolic language for representing simple concepts, contextual states, and transformations through compact binary glyph structures inspired by the formal architecture of the I Ching.

It is not an oracle, divination product, spiritual assistant, or predictive system. The I Ching is used here as a historical example of a minimal, compositional, binary system for representing change: line → trigram → hexagram → transformation.

The project goal is to build a small, computable layer that can be used by humans, software systems, and LLM agents to encode context as symbolic state rather than only as text.

## Core idea

Most LLM memory systems preserve text, summaries, vectors, and documents. SemaGraph-64 adds a different layer:

```text
context -> symbolic state -> transformation path -> memory retrieval -> agent routing
```

The unit is not a word. The unit is:

```text
symbol + position + relation + transformation
```

## What this repository contains

This repository contains the first scaffold for the project:

- a formal model for binary visual states;
- canonical Wilhelm/Baynes-based line, trigram, and 64-state catalog;
- a TypeScript core package;
- an SVG renderer package;
- a JSON schema for visual expressions;
- initial examples for context memory and symbolic transformations;
- documentation for research, governance, and development;
- Codex-oriented operating instructions and development prompts.


## Canonical symbol policy

The core symbolic catalog now uses the Wilhelm/Baynes hexagram sequence as its canonical reference layer: 8 trigrams, 64 hexagrams, bottom-up line storage, and stable six-bit state IDs. The repository stores canonical names/titles and compressed computational kernels, not long interpretive passages. See `docs/10-canonical-symbols-wilhelm.md`.

## Current status

Stage: **pre-alpha / language specification scaffold**.

The repository is intended to be developed iteratively with Codex or another coding agent. The first goal is not machine learning. The first goal is to stabilize the language, schema, renderer, examples, and tests.

## Repository layout

```text
semagraph-64/
  AGENTS.md                         Agent instructions for Codex-style workflows
  docs/                             Design, formal model, roadmap, governance
  packages/core/                    TypeScript formal model and utilities
  packages/renderer-svg/            SVG renderer for lines, trigrams, and states
  schemas/                          JSON schemas for interoperable data
  examples/                         Initial examples and memory records
  codex-prompts/                    Ready-to-use prompts for development sessions
  .codex/skills/semagraph-core/     Optional skill instructions for Codex-compatible agents
```

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

The project is intentionally dependency-light. The core package should stay pure TypeScript and deterministic.

## Design principles

1. Use the I Ching as formal matrix, not as divination.
2. Keep the primitive set small and computable.
3. Store every visual expression as structured data before rendering.
4. Make every symbol reversible: renderable to SVG and serializable to JSON.
5. Separate language specification from applications.
6. Keep advanced mappings, datasets, and domain-specific interpretations modular.
7. Prefer explicit rules over opaque ML until the dataset is mature.

## Initial target use cases

- visual concept language;
- pedagogical representation of simple concepts;
- symbolic state memory for LLM agents;
- context trajectory tracking;
- symbolic routing for multi-agent orchestration;
- retrieval by state, transformation, opposition, or shared structure.

## Non-goals

This repository does not attempt to:

- build a foundation model;
- replace natural language;
- provide mystical, predictive, or divinatory functionality;
- claim universal semantic completeness;
- map complex organizations or business systems in the first phase.

## License

Code is released under Apache-2.0.

Documentation and symbolic specification need a final licensing decision before public launch. A conservative initial recommendation is to keep the formal spec public but require attribution for derivative documentation.
