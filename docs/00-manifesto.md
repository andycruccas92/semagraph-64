# SemaGraph-64 manifesto

SemaGraph-64 is a visual-symbolic experiment.

The aim is to represent simple concepts and contextual transformations with a compact set of computable glyphs. The project takes inspiration from the formal binary structure of the I Ching, but it does not adopt the I Ching as divination, authority, belief system, or predictive engine.

The project begins from a pragmatic observation: language models are strong at processing text, but persistent context often becomes noisy when represented only as prose, summaries, embeddings, and chat history. A compact symbolic layer may help preserve the state of a context over time.

SemaGraph-64 proposes that a context can be encoded as a symbolic state, that a symbolic state can transform into another state, and that a chain of states can function as a lightweight memory trajectory.

## Working thesis

A symbolic state language can help LLM agents by making context more stable, inspectable, and transformable.

The goal is not to replace natural language. The goal is to create a second layer that compresses context into a controlled symbolic form.

## Minimal form

```text
line -> trigram -> state64 -> moving line -> transformation
```

This gives a small formal grammar:

- 2 binary line values;
- 8 three-line primitive states;
- 64 six-line composite states;
- deterministic transformations through moving lines;
- interpretable symbolic memory records.

## Design posture

The project must stay small before becoming ambitious.

Phase one is language engineering, not AI training.
Phase two is symbolic memory and retrieval.
Phase three is LLM-assisted encoding and orchestration.
Phase four may introduce small models trained on curated symbolic datasets.

## Non-mystical framing

The project should not be described as an oracle or spiritual AI. The I Ching provides a historical formal matrix of binary change. SemaGraph-64 reuses that matrix as a computational design constraint.

## Core sentence

SemaGraph-64 is a compact visual-symbolic state language for representing context, transformation, and memory in AI agent systems.
