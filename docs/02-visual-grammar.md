# Visual grammar

## Purpose

The visual grammar defines how symbols become meaning-bearing structures.

The first implementation is deliberately minimal:

```text
line -> trigram -> state64 -> transformation
```

A richer grammar can later add explicit operators such as containment, opposition, amplification, delay, release, and recursion.

## Primitive glyphs

### Yin line

A broken horizontal line.

Operational meaning:

- discontinuity;
- receptivity;
- gap;
- openness;
- potential.

### Yang line

A continuous horizontal line.

Operational meaning:

- continuity;
- action;
- direction;
- presence;
- force.

## Trigram glyphs

A trigram is a stack of three lines. It is rendered bottom-up. In SVG, the top visual row corresponds to line 3, while the bottom visual row corresponds to line 1.

## State64 glyphs

A State64 glyph is a stack of six lines. The bottom three lines form the lower trigram; the top three lines form the upper trigram.

## Moving lines

A moving line should be rendered with a secondary mark. The first renderer may use one of these simple options:

- small dot at the right edge;
- line opacity change;
- small circle marker;
- dashed overlay.

The marker must not alter the base line value.

## Semantic interpretation levels

Each symbol may carry multiple levels of interpretation:

1. formal structure;
2. visual description;
3. minimal operational meaning;
4. pedagogical examples;
5. optional traditional reference;
6. optional application-specific meaning.

Do not collapse these levels.

## Composition rules

Initial composition is trigrammatic:

```text
lower trigram + upper trigram = composite state
```

Future composition may allow:

```text
state + relation + state
state + transformation + state
state + memory event + timestamp
```

## Interpretation rule

No glyph should have a single forced interpretation. Each state should expose a compact semantic field:

```json
{
  "keywords": ["beginning", "constraint", "release"],
  "tensions": ["potential", "friction"],
  "possibleTransitions": ["ordering", "stabilization"]
}
```

The first product should teach the language; it should not pretend to close meaning.
