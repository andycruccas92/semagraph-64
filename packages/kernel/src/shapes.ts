// Path and shape typing for SemaGraph.
//
// This module implements the four-level hierarchy agreed in design:
//
//   Level 0  ElementaryStateQ3      8 elementary states (0..7), an ALPHABET.
//   Level 1  EndpointTransitionT64  ordered pair (source, target) in Q3 x Q3,
//                                    an ORIENTED transition. Cardinality 64, but
//                                    semantically a directed edge, NOT a Q6 point.
//   Level 2  PathQ3                 ordered word over Q3: the trajectory itself.
//            MutationPathQ3         ordered word of 3-bit operators (XOR steps).
//            NormalizedPathQ3       run-collapsed shape (Level 2').
//
//   Level 3  Lossy projections, each declared with its collapse factor:
//              netMutationQ3   -> 8 buckets   (coarse filter, NEVER form identity)
//              endpointCode    -> 64 buckets  (medium filter, NEVER form identity)
//              shapeHash       -> form comparison (run-collapsed)
//              exactPathHash   -> trajectory identity
//              dwellSignature  -> permanence / duration
//
// Design invariant: NO lossy projection may serve as a form key. Lossy
// projections may only PRE-FILTER candidate groups for performance; the
// run-collapsed shape DECIDES form equality. This is enforced by the cascade in
// `compareTrajectories`, where steps 1-2 narrow and step 3 decides.
//
// CompositePointStateQ6 is intentionally kept distinct from EndpointTransitionT64:
// both have cardinality 64, but Q6 is a six-bit POINT (a state) while T64 is an
// oriented Q3 x Q3 EDGE (a transition). The shared cardinality does NOT authorize
// shared operations, so the two carry different brands and never interconvert.

const Q3_BITS = 3;
const Q3_COUNT = 8;

// ---------------------------------------------------------------------------
// Level 0: ElementaryStateQ3
// ---------------------------------------------------------------------------

/** A Q3 elementary state: an integer 0..7. Branded to prevent accidental mixing. */
export type ElementaryStateQ3 = number & { readonly __brand: "ElementaryStateQ3" };

export function elementaryStateQ3(value: number): ElementaryStateQ3 {
  if (!Number.isInteger(value) || value < 0 || value >= Q3_COUNT) {
    throw new Error(`ElementaryStateQ3 must be an integer 0..7, received: ${value}`);
  }
  return value as ElementaryStateQ3;
}

function q3ToBinary(value: ElementaryStateQ3): string {
  return value.toString(2).padStart(Q3_BITS, "0");
}

// ---------------------------------------------------------------------------
// Level 1: EndpointTransitionT64 (oriented Q3 x Q3 edge)
// ---------------------------------------------------------------------------

/**
 * An oriented endpoint transition. Encoded as `source * 8 + target` in 0..63.
 * This is a DIRECTED EDGE, not a state. It is recoverable to (source, target),
 * so the encoding is injective and orientation-preserving.
 */
export type EndpointTransitionT64 = number & { readonly __brand: "EndpointTransitionT64" };

export function endpointTransitionT64(
  source: ElementaryStateQ3,
  target: ElementaryStateQ3
): EndpointTransitionT64 {
  return (source * Q3_COUNT + target) as EndpointTransitionT64;
}

export function endpointSource(code: EndpointTransitionT64): ElementaryStateQ3 {
  return elementaryStateQ3(Math.floor(code / Q3_COUNT));
}

export function endpointTarget(code: EndpointTransitionT64): ElementaryStateQ3 {
  return elementaryStateQ3(code % Q3_COUNT);
}

// ---------------------------------------------------------------------------
// Distinct: CompositePointStateQ6 (six-bit POINT, never a transition)
// ---------------------------------------------------------------------------

/**
 * A composite six-bit point state, value 0..63. Deliberately a different brand
 * from EndpointTransitionT64: identical cardinality, opposite semantics. The two
 * never interconvert. Q6 is the concatenation of two Q3 modules read as a single
 * point; T64 is an oriented pair of Q3 states.
 */
export type CompositePointStateQ6 = number & { readonly __brand: "CompositePointStateQ6" };

export function compositePointStateQ6(value: number): CompositePointStateQ6 {
  if (!Number.isInteger(value) || value < 0 || value >= 64) {
    throw new Error(`CompositePointStateQ6 must be an integer 0..63, received: ${value}`);
  }
  return value as CompositePointStateQ6;
}

// ---------------------------------------------------------------------------
// Level 2: PathQ3, MutationPathQ3, NormalizedPathQ3
// ---------------------------------------------------------------------------

/** An ordered word over Q3: the trajectory. Requires at least one state. */
export type PathQ3 = {
  readonly kind: "PathQ3";
  readonly states: readonly ElementaryStateQ3[];
};

export function pathQ3(states: readonly number[]): PathQ3 {
  if (states.length < 1) throw new Error("A PathQ3 requires at least one state.");
  return { kind: "PathQ3", states: states.map((value) => elementaryStateQ3(value)) };
}

/** A 3-bit mutation operator (XOR step). Branded distinctly from a state. */
export type MutationQ3 = number & { readonly __brand: "MutationQ3" };

function mutationQ3(value: number): MutationQ3 {
  if (!Number.isInteger(value) || value < 0 || value >= Q3_COUNT) {
    throw new Error(`MutationQ3 must be an integer 0..7, received: ${value}`);
  }
  return value as MutationQ3;
}

/** An ordered word of 3-bit operators. Has length one less than its PathQ3. */
export type MutationPathQ3 = {
  readonly kind: "MutationPathQ3";
  readonly masks: readonly MutationQ3[];
};

export function mutationPathQ3(path: PathQ3): MutationPathQ3 {
  const masks: MutationQ3[] = [];
  for (let index = 0; index + 1 < path.states.length; index += 1) {
    masks.push(mutationQ3((path.states[index] as number) ^ (path.states[index + 1] as number)));
  }
  return { kind: "MutationPathQ3", masks };
}

/**
 * The run-collapsed shape (Level 2'). Adjacent duplicate states are collapsed to
 * a single occurrence. Non-adjacent repeats are PRESERVED, so [A,B,A,D] keeps its
 * three distinct regime entries and stays distinct from [A,B,D]. The dwell vector
 * records how many path steps were spent in each collapsed run, in run order, so
 * shape and dwell together losslessly reconstruct the original path.
 */
export type NormalizedPathQ3 = {
  readonly kind: "NormalizedPathQ3";
  readonly shape: readonly ElementaryStateQ3[];
  readonly dwell: readonly number[];
};

export function normalizePathRunCollapse(path: PathQ3): NormalizedPathQ3 {
  const shape: ElementaryStateQ3[] = [];
  const dwell: number[] = [];
  for (const state of path.states) {
    const last = shape.at(-1);
    if (last !== undefined && last === state) {
      dwell[dwell.length - 1] = (dwell[dwell.length - 1] as number) + 1;
    } else {
      shape.push(state);
      dwell.push(1);
    }
  }
  return { kind: "NormalizedPathQ3", shape, dwell };
}

// ---------------------------------------------------------------------------
// Level 3: declared lossy projections (each with its collapse factor)
// ---------------------------------------------------------------------------

/**
 * Net mutation: XOR of all step masks, equal to source XOR target. Lives in M3
 * (8 values). COLLAPSE FACTOR: 8 buckets. Coarse filter only — never a form key.
 */
export function netMutationQ3(path: PathQ3): MutationQ3 {
  const masks = mutationPathQ3(path).masks;
  return mutationQ3(masks.reduce((acc, mask) => acc ^ (mask as number), 0));
}

/**
 * Cumulative Hamming distance along the path: the sum of the popcounts of every
 * step mask. Unlike netMutationQ3 (which XOR-folds the masks and so cancels
 * out-and-back moves), this accumulates every bit flip taken, so it measures
 * total traversal effort rather than net displacement. A scalar magnitude --
 * never a form key. Equals 0 for a single-state path.
 *
 * This is the Q3 counterpart of `compress_chain64`'s `cumulative_distance` in the
 * Rust core; it is exported so the Rust batch port can be checked against it in
 * the shape-parity fixture rather than diverging unchecked.
 */
export function cumulativeDistanceQ3(path: PathQ3): number {
  const masks = mutationPathQ3(path).masks;
  let total = 0;
  for (const mask of masks) {
    let value = mask as number;
    while (value > 0) {
      total += value & 1;
      value >>= 1;
    }
  }
  return total;
}

/**
 * Endpoint code: the oriented (first, last) pair. COLLAPSE FACTOR: 64 buckets.
 * Medium filter only — never a form key. Equal shape implies equal endpoint, but
 * NOT conversely, so this may pre-filter candidates but must never decide form.
 */
export function endpointCompression(path: PathQ3): EndpointTransitionT64 {
  const first = path.states[0] as ElementaryStateQ3;
  const last = path.states[path.states.length - 1] as ElementaryStateQ3;
  return endpointTransitionT64(first, last);
}

/** Hamming distance between endpoints. A scalar magnitude — never a form key. */
export function endpointHammingDistance(path: PathQ3): number {
  const first = q3ToBinary(path.states[0] as ElementaryStateQ3);
  const last = q3ToBinary(path.states[path.states.length - 1] as ElementaryStateQ3);
  let distance = 0;
  for (let index = 0; index < Q3_BITS; index += 1) {
    if (first[index] !== last[index]) distance += 1;
  }
  return distance;
}

/** Exact-path identity key. Injective over PathQ3 — full trajectory identity. */
export function exactPathKey(path: PathQ3): string {
  return `P3:${path.states.join(".")}`;
}

/** Shape key: run-collapsed form identity. Two paths share form iff equal. */
export function shapeKey(path: PathQ3): string {
  return `S3:${normalizePathRunCollapse(path).shape.join(".")}`;
}

/** Dwell signature: permanence per run, in run order. Distinguishes duration. */
export function dwellSignature(path: PathQ3): string {
  return `D3:${normalizePathRunCollapse(path).dwell.join(".")}`;
}

// ---------------------------------------------------------------------------
// Comparison cascade
// ---------------------------------------------------------------------------

export type TrajectoryRelation =
  | "different_trajectory" // endpoints differ; cannot share form
  | "different_pattern" //    same endpoint, different shape
  | "same_form_different_duration" // same shape, different dwell
  | "equivalent"; //          same shape and same dwell

export type TrajectoryComparison = {
  relation: TrajectoryRelation;
  sameEndpoint: boolean;
  sameShape: boolean;
  sameDwell: boolean;
  rationale: string;
};

/**
 * Compare two trajectories through the cascade.
 *
 * The endpoint check is a PERFORMANCE PRE-FILTER, not a decision: because equal
 * shape implies equal endpoint, a difference in endpoints is sufficient to
 * conclude the shapes differ, so we may short-circuit. But equal endpoints prove
 * nothing about form, so the SHAPE comparison is what decides pattern equality.
 * No lossy projection is ever treated as form identity.
 */
export function compareTrajectories(left: PathQ3, right: PathQ3): TrajectoryComparison {
  const sameEndpoint = endpointCompression(left) === endpointCompression(right);
  if (!sameEndpoint) {
    return {
      relation: "different_trajectory",
      sameEndpoint: false,
      sameShape: false,
      sameDwell: false,
      rationale: "Endpoints differ; equal shape would force equal endpoints, so the shapes differ."
    };
  }

  const sameShape = shapeKey(left) === shapeKey(right);
  if (!sameShape) {
    return {
      relation: "different_pattern",
      sameEndpoint: true,
      sameShape: false,
      sameDwell: false,
      rationale: "Same endpoint but different run-collapsed shape; the regime sequence differs."
    };
  }

  const sameDwell = dwellSignature(left) === dwellSignature(right);
  return {
    relation: sameDwell ? "equivalent" : "same_form_different_duration",
    sameEndpoint: true,
    sameShape: true,
    sameDwell,
    rationale: sameDwell
      ? "Identical run-collapsed shape and identical dwell vector."
      : "Identical run-collapsed shape but different dwell; same form, different duration."
  };
}

/**
 * Group paths by run-collapsed shape. Net mutation and endpoint code are used
 * only to bucket candidates cheaply before the exact shape comparison, never as
 * the grouping identity itself. The returned map is keyed by shapeKey.
 */
export function groupByShape(paths: readonly PathQ3[]): Map<string, readonly PathQ3[]> {
  const groups = new Map<string, PathQ3[]>();
  for (const path of paths) {
    const key = shapeKey(path);
    const existing = groups.get(key);
    if (existing) existing.push(path);
    else groups.set(key, [path]);
  }
  return groups;
}
