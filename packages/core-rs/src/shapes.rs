//! Q3 trajectory projections: the Rust port of the TypeScript `shapes.ts`.
//!
//! A trajectory is an ordered word over the eight-state Q3 alphabet (0..7). This
//! module mirrors the reference semantics exactly:
//!
//! * **run-collapse shape** — adjacent duplicate states collapse to one entry;
//!   NON-adjacent repeats are preserved (so `[A,B,A,D]` stays distinct from
//!   `[A,B,D]`). The dwell vector is aligned to runs (not to distinct states) and
//!   records how many path steps were spent in each collapsed run, so shape and
//!   dwell together losslessly reconstruct the original path.
//! * **declared lossy projections**, each a coarse filter only and NEVER a form
//!   key: `net_mutation` (XOR-fold of step masks = first ^ last, 8 buckets),
//!   `endpoint` (oriented first/last pair `first*8 + last`, 64 buckets), and
//!   `endpoint_hamming` (a scalar magnitude). The run-collapsed shape is the only
//!   thing that decides form equality.
//! * **cumulative_distance** — the sum of step popcounts (total traversal
//!   effort), the Q3 counterpart of `compress_chain64`'s cumulative distance.
//!
//! Parity is enforced against the TypeScript reference by
//! `tests/shape_parity.rs`, which reads a fixture generated from `shapes.ts`.
//!
//! Note the deliberate type distinction carried over from the reference: the
//! endpoint code shares the cardinality (64) of a Q6 composite point but is an
//! oriented Q3 x Q3 EDGE, not a point; the two never interconvert.

/// Low three bits: the Q3 state/mask width.
pub const Q3_MASK: u8 = 0b0000_0111;
/// Number of Q3 elementary states.
pub const Q3_COUNT: u8 = 8;

#[inline]
const fn popcount3(value: u8) -> u8 {
    (value & Q3_MASK).count_ones() as u8
}

/// The full set of projections for one trajectory. `shape`/`dwell` are
/// variable-length; the rest are scalars. Equality is structural.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrajectoryProjection {
    /// Run-collapsed shape (the form key material).
    pub shape: Vec<u8>,
    /// Dwell per run, aligned to `shape`.
    pub dwell: Vec<u32>,
    /// XOR-fold of step masks; equals `first ^ last`. Lossy, never a form key.
    pub net_mutation: u8,
    /// Oriented endpoint code `first * 8 + last` (a T64 edge). Lossy filter only.
    pub endpoint: u8,
    /// Hamming distance between first and last state. Scalar magnitude.
    pub endpoint_hamming: u8,
    /// Sum of step popcounts: total traversal distance. Scalar magnitude.
    pub cumulative_distance: u32,
}

/// Run-collapse a path into caller-provided buffers, returning the number of
/// runs. `shape` and `dwell` must be at least `path.len()` long (the worst case,
/// when no two adjacent states are equal). Inputs are masked to three bits.
///
/// Adjacent-only collapse: a state equal to the immediately preceding kept state
/// extends the current run; otherwise it opens a new run. This preserves
/// non-adjacent returns, matching `normalizePathRunCollapse` in `shapes.ts`.
pub fn run_collapse_into(path: &[u8], shape: &mut [u8], dwell: &mut [u32]) -> usize {
    debug_assert!(
        shape.len() >= path.len() && dwell.len() >= path.len(),
        "run_collapse_into buffers must be at least path.len() long"
    );
    let capacity = shape.len().min(dwell.len());
    let mut runs = 0usize;
    for &state in path {
        let s = state & Q3_MASK;
        if runs > 0 && shape[runs - 1] == s {
            dwell[runs - 1] += 1;
            continue;
        }
        if runs >= capacity {
            break;
        }
        shape[runs] = s;
        dwell[runs] = 1;
        runs += 1;
    }
    runs
}

/// Compute every projection for a single trajectory. Allocates the variable-length
/// `shape`/`dwell` vectors; for allocation-free run-collapse use `run_collapse_into`
/// and the scalar batch below.
pub fn project_trajectory(path: &[u8]) -> TrajectoryProjection {
    let mut shape: Vec<u8> = Vec::with_capacity(path.len());
    let mut dwell: Vec<u32> = Vec::with_capacity(path.len());
    for &state in path {
        let s = state & Q3_MASK;
        if let Some(&last) = shape.last() {
            if last == s {
                *dwell.last_mut().expect("shape and dwell grow together") += 1;
                continue;
            }
        }
        shape.push(s);
        dwell.push(1);
    }

    let (net_mutation, cumulative_distance) = fold_steps(path);
    let (endpoint, endpoint_hamming) = endpoints(path);

    TrajectoryProjection {
        shape,
        dwell,
        net_mutation,
        endpoint,
        endpoint_hamming,
        cumulative_distance,
    }
}

#[inline]
fn fold_steps(path: &[u8]) -> (u8, u32) {
    let mut net_mutation = 0u8;
    let mut cumulative_distance = 0u32;
    for window in path.windows(2) {
        let mask = (window[0] ^ window[1]) & Q3_MASK;
        net_mutation ^= mask;
        cumulative_distance += popcount3(mask) as u32;
    }
    (net_mutation, cumulative_distance)
}

#[inline]
fn endpoints(path: &[u8]) -> (u8, u8) {
    if path.is_empty() {
        return (0, 0);
    }
    let first = path[0] & Q3_MASK;
    let last = path[path.len() - 1] & Q3_MASK;
    (first * Q3_COUNT + last, popcount3(first ^ last))
}

/// Compute the scalar projections for many trajectories into preallocated
/// struct-of-arrays output buffers (no per-trajectory allocation). The
/// variable-length shape/dwell are intentionally excluded here; use
/// `project_trajectory` or `run_collapse_into` for those.
///
/// The outer loop over trajectories is a counted `for i in 0..n` with independent
/// iterations and no allocation; the inner fold over each path's steps is a flat
/// reduction. This is the layout the design calls for: classify/compress an
/// ensemble of trajectories in one call, writing each column contiguously.
pub fn compress_trajectory_batch(
    paths: &[&[u8]],
    net_mutation: &mut [u8],
    cumulative_distance: &mut [u32],
    endpoint: &mut [u8],
    endpoint_hamming: &mut [u8],
) {
    let n = paths
        .len()
        .min(net_mutation.len())
        .min(cumulative_distance.len())
        .min(endpoint.len())
        .min(endpoint_hamming.len());
    // Indexed loop kept deliberately: a flat counted loop over SoA slices is
    // the most autovectorization-friendly shape (see fn docs). clippy would
    // prefer iterators here, but that obscures the SoA intent.
    #[allow(clippy::needless_range_loop)]
    for i in 0..n {
        let (net, cumulative) = fold_steps(paths[i]);
        let (ep, eph) = endpoints(paths[i]);
        net_mutation[i] = net;
        cumulative_distance[i] = cumulative;
        endpoint[i] = ep;
        endpoint_hamming[i] = eph;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapses_adjacent_runs_but_keeps_non_adjacent_returns() {
        let padded = project_trajectory(&[0, 1, 1, 3]);
        assert_eq!(padded.shape, vec![0, 1, 3]);
        assert_eq!(padded.dwell, vec![1, 2, 1]);

        let returning = project_trajectory(&[0, 1, 0, 3]);
        assert_eq!(returning.shape, vec![0, 1, 0, 3]);
        assert_eq!(returning.dwell, vec![1, 1, 1, 1]);
    }

    #[test]
    fn projections_match_reference_examples() {
        // 000 -> 100 -> 110 -> 010: step popcounts 1+1+1=3, net XOR = 010.
        let p = project_trajectory(&[0, 4, 6, 2]);
        assert_eq!(p.net_mutation, 2);
        assert_eq!(p.cumulative_distance, 3);
        assert_eq!(p.endpoint, 0 * 8 + 2);
        assert_eq!(p.endpoint_hamming, 1);

        // Out-and-back cancels net mutation but not cumulative distance.
        let oab = project_trajectory(&[0, 7, 0]);
        assert_eq!(oab.net_mutation, 0);
        assert_eq!(oab.cumulative_distance, 6);
        assert_eq!(oab.endpoint, 0);

        // Single state: no steps.
        let single = project_trajectory(&[3]);
        assert_eq!(single.shape, vec![3]);
        assert_eq!(single.dwell, vec![1]);
        assert_eq!(single.net_mutation, 0);
        assert_eq!(single.cumulative_distance, 0);
        assert_eq!(single.endpoint, 3 * 8 + 3);
    }

    #[test]
    fn batch_matches_per_trajectory() {
        let paths: Vec<&[u8]> = vec![&[0, 1, 1, 3], &[0, 7, 0], &[3], &[5, 2, 2, 5]];
        let mut net = vec![0u8; paths.len()];
        let mut cum = vec![0u32; paths.len()];
        let mut ep = vec![0u8; paths.len()];
        let mut eph = vec![0u8; paths.len()];
        compress_trajectory_batch(&paths, &mut net, &mut cum, &mut ep, &mut eph);
        for (i, path) in paths.iter().enumerate() {
            let single = project_trajectory(path);
            assert_eq!(net[i], single.net_mutation);
            assert_eq!(cum[i], single.cumulative_distance);
            assert_eq!(ep[i], single.endpoint);
            assert_eq!(eph[i], single.endpoint_hamming);
        }
    }

    #[test]
    fn run_collapse_into_matches_allocating_version() {
        let path = [2u8, 2, 5, 5, 5, 2];
        let mut shape = vec![0u8; path.len()];
        let mut dwell = vec![0u32; path.len()];
        let runs = run_collapse_into(&path, &mut shape, &mut dwell);
        let reference = project_trajectory(&path);
        assert_eq!(&shape[..runs], reference.shape.as_slice());
        assert_eq!(&dwell[..runs], reference.dwell.as_slice());
    }
}
