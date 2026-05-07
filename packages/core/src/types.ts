export type LineValue = "yin" | "yang";

export type BinaryLineValue = 0 | 1;

export type Line = {
  value: LineValue;
  moving?: boolean;
};

export type TrigramId =
  | "qian"
  | "zhen"
  | "kan"
  | "gen"
  | "kun"
  | "xun"
  | "li"
  | "dui";

export type Trigram = {
  id: TrigramId;
  /** Modern normalized label used by SemaGraph. */
  label: string;
  /** Wilhelm/Baynes romanized name, kept as a canonical reference label. */
  wilhelmName: string;
  /** Wilhelm/Baynes English title for the trigram. */
  wilhelmTitle: string;
  /** Traditional natural image associated with the trigram. */
  image: string;
  /** Unicode trigram glyph, useful for compact displays. */
  unicode: string;
  binary: string;
  /** Lines are stored bottom-up, matching I Ching construction. */
  lines: readonly [LineValue, LineValue, LineValue];
  /** Minimal computational interpretation; not a divinatory statement. */
  kernel: string;
  /** Stable tags for retrieval, routing, and symbolic interpretation. */
  keywords: readonly string[];
};

export type HexagramNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
  | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32
  | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48
  | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63 | 64;

export type State64Id = `S64-${string}`;

export type State64 = {
  id: State64Id;
  /** Zero-based index in the canonical King Wen / Wilhelm sequence. */
  index: number;
  /** Canonical I Ching hexagram number. */
  number: HexagramNumber;
  /** Stable display code, for example H01 or H64. */
  code: `H${string}`;
  /** Six-bit bottom-up code, 1 = yang, 0 = yin. */
  binary: string;
  lines: readonly [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  lowerTrigramId: TrigramId;
  upperTrigramId: TrigramId;
  /** Wilhelm/Baynes romanized name. */
  wilhelmName: string;
  /** Wilhelm/Baynes English title. */
  wilhelmTitle: string;
  /** Compressed modern semantic kernel for computational use. */
  kernel: string;
  /** Primary state family for symbolic memory and routing. */
  family: string;
  keywords: readonly string[];
};

export type MovingLinePosition = 1 | 2 | 3 | 4 | 5 | 6;

export type Transformation = {
  sourceStateId: State64Id;
  movingLinePositions: readonly MovingLinePosition[];
  targetStateId: State64Id;
};

export type SymbolicMemoryRecord = {
  id: string;
  source: "conversation" | "document" | "event" | "task";
  sourceRef?: string;
  stateId: State64Id;
  tensions: readonly string[];
  confidence: number;
  createdAt: string;
  note?: string;
};

export type SymbolicTrajectory = {
  id: string;
  records: readonly SymbolicMemoryRecord[];
};
