# Formal model

## 1. Binary line

The smallest unit is a line.

```ts
type LineValue = "yin" | "yang";
```

In the SemaGraph model, the names `yin` and `yang` are retained because they are short, historical labels for two binary visual states. They should be interpreted operationally:

- `yin`: open, discontinuous, receptive, latent, containing gap;
- `yang`: continuous, active, directional, present, uninterrupted.

These are semantic hints, not metaphysical claims.

## 2. Moving line

A line may be stable or moving.

```ts
type Line = {
  value: LineValue;
  moving?: boolean;
};
```

A moving line flips during transformation:

```text
yin -> yang
yang -> yin
```

## 3. Trigram

A trigram is an ordered tuple of three lines, counted bottom-up.

```ts
type Trigram = {
  id: string;
  lines: [LineValue, LineValue, LineValue];
  label: string;
  keywords: string[];
};
```

The eight base trigrams are treated as primitive dynamic states.

## 4. State64

A State64 is an ordered tuple of six lines, counted bottom-up.

```ts
type State64 = {
  id: string;
  index: number;
  lines: [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  lowerTrigramId: string;
  upperTrigramId: string;
  keywords: string[];
};
```

The lower trigram may be used to represent internal condition, source dynamics, or lower layer. The upper trigram may be used to represent external condition, manifestation, or upper layer. This interpretation is application-dependent and should not be hard-coded as universal truth.

## 5. Transformation

A transformation is a deterministic state transition produced by flipping moving lines.

```ts
type Transformation = {
  sourceStateId: string;
  movingLinePositions: number[]; // 1..6 bottom-up
  targetStateId: string;
};
```

## 6. Similarity

Initial similarity can be computed with Hamming distance over the six-line code and trigram overlap.

```text
line_distance = number of different line positions
shared_lower = lowerA === lowerB
shared_upper = upperA === upperB
```

This is intentionally simple. Deeper analogy logic can be added later.

## 7. Canonical warning

The initial 64-state catalog in this repository is generated from trigram combinations and does not claim to reproduce a traditional King Wen ordering. Traditional mappings can be added later as a separate reference layer.
