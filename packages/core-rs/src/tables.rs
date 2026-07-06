//! Branchless, cache-resident classification tables.
//!
//! Every scalar the regime classifier needs is a pure function of the six-bit
//! mutation mask `source ^ target`, so the entire decision surface fits in a
//! handful of tiny lookup tables. They are built once at compile time as `const`
//! data (no runtime initializer, no `lazy_static`) and indexed with no
//! data-dependent branches in the hot loop. The same `const fn` classifiers that
//! `lib.rs` exposes are reused to fill the tables, so the table contents cannot
//! drift from the scalar path; the equality test at the bottom of this file
//! proves that for all 4096 transitions.
//!
//! ## Memory footprint (the hot-path working set)
//!
//! | table                    | entries | bytes |
//! |--------------------------|---------|-------|
//! | `DISTANCE_BY_MASK`       |      64 |    64 |
//! | `LOWER_DISTANCE_BY_MASK` |      64 |    64 |
//! | `UPPER_DISTANCE_BY_MASK` |      64 |    64 |
//! | `MODULE_SCOPE_BY_MASK`   |      64 |    64 |
//! | `REGIME_BY_MASK`         |      64 |    64 |
//! | `REGIME_BY_TRANSITION`   |    4096 |  4096 |
//! | **total**                |         |  **4416** |
//!
//! 4416 bytes is roughly 14% of a typical 32 KiB L1 data cache, so once warm the
//! tables stay resident and classification is a sequence of L1-latency loads.
//! Even `REGIME_BY_TRANSITION` (the largest table, indexed directly by
//! `source * 64 + target` as required by the design spec) is only 4 KiB. The
//! mask-indexed tables are the ones the hot path actually touches; `source`,
//! `target`, `mutation_mask` and `index` are recomputed inline by XOR and a
//! multiply-add, which are cheaper than a memory load.

use crate::{
    module_scope_from_distances, pack_transition64, regime_class_from_distances, PackedTransition,
    Transition64Entry, STATE64_MASK, TRANSITION64_COUNT,
};

const MASK_COUNT: usize = 64;

#[inline]
const fn popcount6(mask: u8) -> u8 {
    (mask & STATE64_MASK).count_ones() as u8
}

#[inline]
const fn lower3(mask: u8) -> u8 {
    (mask >> 3) & 0b0000_0111
}

#[inline]
const fn upper3(mask: u8) -> u8 {
    mask & 0b0000_0111
}

const fn build_distance_by_mask() -> [u8; MASK_COUNT] {
    let mut table = [0u8; MASK_COUNT];
    let mut mask = 0;
    while mask < MASK_COUNT {
        table[mask] = popcount6(mask as u8);
        mask += 1;
    }
    table
}

const fn build_lower_distance_by_mask() -> [u8; MASK_COUNT] {
    let mut table = [0u8; MASK_COUNT];
    let mut mask = 0;
    while mask < MASK_COUNT {
        table[mask] = popcount6(lower3(mask as u8));
        mask += 1;
    }
    table
}

const fn build_upper_distance_by_mask() -> [u8; MASK_COUNT] {
    let mut table = [0u8; MASK_COUNT];
    let mut mask = 0;
    while mask < MASK_COUNT {
        table[mask] = popcount6(upper3(mask as u8));
        mask += 1;
    }
    table
}

const fn build_module_scope_by_mask() -> [u8; MASK_COUNT] {
    let mut table = [0u8; MASK_COUNT];
    let mut mask = 0;
    while mask < MASK_COUNT {
        let m = mask as u8;
        table[mask] = module_scope_from_distances(popcount6(lower3(m)), popcount6(upper3(m))) as u8;
        mask += 1;
    }
    table
}

const fn build_regime_by_mask() -> [u8; MASK_COUNT] {
    let mut table = [0u8; MASK_COUNT];
    let mut mask = 0;
    while mask < MASK_COUNT {
        let m = mask as u8;
        let distance = popcount6(m);
        let lower = popcount6(lower3(m));
        let upper = popcount6(upper3(m));
        table[mask] = regime_class_from_distances(distance, lower, upper) as u8;
        mask += 1;
    }
    table
}

/// Hamming distance of the six-bit mutation mask. Indexed by `source ^ target`.
pub const DISTANCE_BY_MASK: [u8; MASK_COUNT] = build_distance_by_mask();
/// Lower-module (high three bits) distance of the mutation mask.
pub const LOWER_DISTANCE_BY_MASK: [u8; MASK_COUNT] = build_lower_distance_by_mask();
/// Upper-module (low three bits) distance of the mutation mask.
pub const UPPER_DISTANCE_BY_MASK: [u8; MASK_COUNT] = build_upper_distance_by_mask();
/// Module-scope code (`ModuleScopeCode as u8`) for the mutation mask.
pub const MODULE_SCOPE_BY_MASK: [u8; MASK_COUNT] = build_module_scope_by_mask();
/// Regime-class code (`RegimeClassCode as u8`) for the mutation mask.
pub const REGIME_BY_MASK: [u8; MASK_COUNT] = build_regime_by_mask();

const fn build_regime_by_transition() -> [u8; TRANSITION64_COUNT] {
    let mut table = [0u8; TRANSITION64_COUNT];
    let mut source = 0;
    while source < 64 {
        let mut target = 0;
        while target < 64 {
            let mask = (source as u8) ^ (target as u8);
            table[source * 64 + target] = REGIME_BY_MASK[mask as usize];
            target += 1;
        }
        source += 1;
    }
    table
}

/// Regime-class code indexed directly by `source * 64 + target`, as required by
/// the design spec. This is `REGIME_BY_MASK[source ^ target]` materialized for
/// every ordered pair; it lets a caller classify a known transition index with a
/// single load and no XOR.
pub const REGIME_BY_TRANSITION: [u8; TRANSITION64_COUNT] = build_regime_by_transition();

/// Branchless classification of one transition.
///
/// The hot path: mask the inputs to six bits, XOR for the mutation mask, then
/// read every derived scalar from a `const` table indexed by that mask. There is
/// no `if`/`match` on the data being classified — the only "decisions" are the
/// table contents, resolved at compile time. The index is provably in `0..64` (a
/// six-bit mask), so the bounds check is trivially elided by the optimizer and
/// plain safe indexing is used (no `unsafe`).
///
/// Inputs are masked (`& STATE64_MASK`) rather than validated: this is the
/// unchecked kernel for callers that already hold valid six-bit states (the batch
/// path, the benches). For a validating entry point use `lookup_transition64`;
/// for valid inputs the two are identical, asserted for all 4096 transitions in
/// the tests below.
#[inline]
pub fn classify_branchless(source: u8, target: u8) -> Transition64Entry {
    let source = source & STATE64_MASK;
    let target = target & STATE64_MASK;
    let mutation_mask = source ^ target;
    let mi = mutation_mask as usize; // 0..=63 by construction
    Transition64Entry {
        source,
        target,
        mutation_mask,
        distance: DISTANCE_BY_MASK[mi],
        lower_distance: LOWER_DISTANCE_BY_MASK[mi],
        upper_distance: UPPER_DISTANCE_BY_MASK[mi],
        module_scope: MODULE_SCOPE_BY_MASK[mi],
        regime_class: REGIME_BY_MASK[mi],
        index: (source as u16) * 64 + (target as u16),
    }
}

/// Branchless classification packed into the stable 64-bit FFI word. Returns
/// exactly what `pack_transition64(lookup_transition64(..).unwrap())` returns.
#[inline]
pub fn classify_branchless_packed(source: u8, target: u8) -> PackedTransition {
    pack_transition64(classify_branchless(source, target))
}

/// Batch transition classification over struct-of-arrays input into a caller
/// provided output buffer, writing the regime-class code per item.
///
/// Why this shape is vectorizable: the body is a single counted `for i in 0..n`
/// over slices pre-narrowed to the common length `n`, with no early return, no
/// per-iteration allocation, and no branch on the data. Each iteration is
/// `out[i] = REGIME_BY_MASK[(sources[i] ^ targets[i]) & MASK]`. The XOR and mask
/// map directly onto SIMD lanes; the only step the autovectorizer cannot widen is
/// the table gather, which it scalarizes per lane without changing the result.
pub fn classify_batch(sources: &[u8], targets: &[u8], out: &mut [u8]) {
    let n = sources.len().min(targets.len()).min(out.len());
    let sources = &sources[..n];
    let targets = &targets[..n];
    let out = &mut out[..n];
        // Indexed loop kept deliberately: a flat counted loop over SoA slices is
        // the most autovectorization-friendly shape (see fn docs). clippy would
        // prefer iterators here, but that obscures the SoA intent.
        #[allow(clippy::needless_range_loop)]
    for i in 0..n {
        out[i] = REGIME_BY_MASK[((sources[i] ^ targets[i]) & STATE64_MASK) as usize];
    }
}

/// Struct-of-arrays output buffers for full batch classification. Each slice is
/// caller-allocated; nothing here allocates.
pub struct BatchOut<'a> {
    pub mutation_mask: &'a mut [u8],
    pub distance: &'a mut [u8],
    pub lower_distance: &'a mut [u8],
    pub upper_distance: &'a mut [u8],
    pub module_scope: &'a mut [u8],
    pub regime_class: &'a mut [u8],
}

/// Full batch classification: every per-transition scalar written into the
/// matching output column. Same vectorizable loop shape as `classify_batch`; the
/// metadata writes are independent stores into separate arrays (true SoA), which
/// keeps each column contiguous and prefetch-friendly.
pub fn classify_batch_full(sources: &[u8], targets: &[u8], out: &mut BatchOut<'_>) {
    let n = sources
        .len()
        .min(targets.len())
        .min(out.mutation_mask.len())
        .min(out.distance.len())
        .min(out.lower_distance.len())
        .min(out.upper_distance.len())
        .min(out.module_scope.len())
        .min(out.regime_class.len());
        // Indexed loop kept deliberately: a flat counted loop over SoA slices is
        // the most autovectorization-friendly shape (see fn docs). clippy would
        // prefer iterators here, but that obscures the SoA intent.
        #[allow(clippy::needless_range_loop)]
    for i in 0..n {
        let mask = (sources[i] ^ targets[i]) & STATE64_MASK;
        let mi = mask as usize;
        out.mutation_mask[i] = mask;
        out.distance[i] = DISTANCE_BY_MASK[mi];
        out.lower_distance[i] = LOWER_DISTANCE_BY_MASK[mi];
        out.upper_distance[i] = UPPER_DISTANCE_BY_MASK[mi];
        out.module_scope[i] = MODULE_SCOPE_BY_MASK[mi];
        out.regime_class[i] = REGIME_BY_MASK[mi];
    }
}

/// Explicit SIMD batch classification (x86_64 SSE2), behind the `simd` feature.
///
/// Produces output identical to `classify_batch`; it exists to show the SoA
/// layout maps cleanly onto vector registers. SSE2 is baseline on x86_64, so no
/// runtime feature detection is required. The XOR and mask run 16 lanes at a
/// time; the regime gather is scalar (SSE2 has no byte gather), which mirrors what
/// the autovectorizer produces for the scalar version.
#[cfg(all(feature = "simd", target_arch = "x86_64"))]
pub fn classify_batch_simd(sources: &[u8], targets: &[u8], out: &mut [u8]) {
    use core::arch::x86_64::{
        _mm_and_si128, _mm_loadu_si128, _mm_set1_epi8, _mm_storeu_si128, _mm_xor_si128, __m128i,
    };

    let n = sources.len().min(targets.len()).min(out.len());
    // SAFETY: every load/store below is bounded by `i + 16 <= n` and the slices
    // are at least `n` long; the gather indices are six-bit masks, always in
    // range for the 64-entry table.
    let mask_vec = unsafe { _mm_set1_epi8(STATE64_MASK as i8) };
    let mut i = 0usize;
    while i + 16 <= n {
        unsafe {
            let s = _mm_loadu_si128(sources.as_ptr().add(i) as *const __m128i);
            let t = _mm_loadu_si128(targets.as_ptr().add(i) as *const __m128i);
            let m = _mm_and_si128(_mm_xor_si128(s, t), mask_vec);
            let mut buf = [0u8; 16];
            _mm_storeu_si128(buf.as_mut_ptr() as *mut __m128i, m);
            let mut k = 0usize;
            while k < 16 {
                out[i + k] = REGIME_BY_MASK[buf[k] as usize];
                k += 1;
            }
        }
        i += 16;
    }
    while i < n {
        out[i] = REGIME_BY_MASK[((sources[i] ^ targets[i]) & STATE64_MASK) as usize];
        i += 1;
    }
}

/// Portable fallback so `classify_batch_simd` can be named unconditionally when
/// the `simd` feature is enabled on a non-x86_64 target.
#[cfg(all(feature = "simd", not(target_arch = "x86_64")))]
pub fn classify_batch_simd(sources: &[u8], targets: &[u8], out: &mut [u8]) {
    classify_batch(sources, targets, out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lookup_transition64;

    #[test]
    fn branchless_matches_naive_for_all_transitions() {
        for source in 0..64u8 {
            for target in 0..64u8 {
                let naive = lookup_transition64(source, target)
                    .unwrap_or_else(|_| panic!("naive lookup failed {source}->{target}"));
                let branchless = classify_branchless(source, target);
                assert_eq!(branchless, naive, "entry mismatch {source}->{target}");
                assert_eq!(
                    classify_branchless_packed(source, target),
                    pack_transition64(naive),
                    "packed mismatch {source}->{target}"
                );
                assert_eq!(
                    REGIME_BY_TRANSITION[source as usize * 64 + target as usize],
                    naive.regime_class,
                    "REGIME_BY_TRANSITION mismatch {source}->{target}"
                );
            }
        }
    }

    #[test]
    fn batch_matches_per_item() {
        let mut sources = Vec::new();
        let mut targets = Vec::new();
        for s in 0..64u8 {
            for t in 0..64u8 {
                sources.push(s);
                targets.push(t);
            }
        }
        let mut regime = vec![0u8; sources.len()];
        classify_batch(&sources, &targets, &mut regime);
        #[allow(clippy::needless_range_loop)]
        for i in 0..sources.len() {
            assert_eq!(regime[i], classify_branchless(sources[i], targets[i]).regime_class);
        }

        let mut mutation_mask = vec![0u8; sources.len()];
        let mut distance = vec![0u8; sources.len()];
        let mut lower_distance = vec![0u8; sources.len()];
        let mut upper_distance = vec![0u8; sources.len()];
        let mut module_scope = vec![0u8; sources.len()];
        let mut regime_class = vec![0u8; sources.len()];
        let mut out = BatchOut {
            mutation_mask: &mut mutation_mask,
            distance: &mut distance,
            lower_distance: &mut lower_distance,
            upper_distance: &mut upper_distance,
            module_scope: &mut module_scope,
            regime_class: &mut regime_class,
        };
        classify_batch_full(&sources, &targets, &mut out);
        #[allow(clippy::needless_range_loop)]
        for i in 0..sources.len() {
            let entry = classify_branchless(sources[i], targets[i]);
            assert_eq!(mutation_mask[i], entry.mutation_mask);
            assert_eq!(distance[i], entry.distance);
            assert_eq!(lower_distance[i], entry.lower_distance);
            assert_eq!(upper_distance[i], entry.upper_distance);
            assert_eq!(module_scope[i], entry.module_scope);
            assert_eq!(regime_class[i], entry.regime_class);
        }
    }
}

#[cfg(all(test, feature = "simd"))]
mod simd_tests {
    use super::*;

    #[test]
    fn simd_matches_scalar() {
        let mut sources = Vec::new();
        let mut targets = Vec::new();
        for s in 0..64u8 {
            for t in 0..64u8 {
                sources.push(s);
                targets.push(t);
            }
        }
        // Push one extra element so the length is not a multiple of 16; this
        // exercises the scalar tail of the SIMD path.
        sources.push(5);
        targets.push(40);

        let mut scalar = vec![0u8; sources.len()];
        let mut simd = vec![0u8; sources.len()];
        classify_batch(&sources, &targets, &mut scalar);
        classify_batch_simd(&sources, &targets, &mut simd);
        assert_eq!(scalar, simd);
    }
}
