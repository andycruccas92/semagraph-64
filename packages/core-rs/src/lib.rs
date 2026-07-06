//! SemaGraph Core RS.
//!
//! Deterministic Q6 / State64 transition-compression primitives.
//! The crate treats a State64 state as the lower six bits of a `u8`.
//! All public safe functions validate that unused high bits are zero.

pub const STATE64_MASK: u8 = 0b0011_1111;
pub const STATE64_COUNT: usize = 64;
pub const TRANSITION64_COUNT: usize = 4096;

/// The stable 64-bit word produced by `pack_transition64`. Named so the
/// branchless path can advertise it as its return type.
pub type PackedTransition = u64;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SemagraphErrorCode {
    Ok = 0,
    InvalidState = 1,
    InvalidMask = 2,
    EmptyChain = 3,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModuleScopeCode {
    NoChange = 0,
    LowerOnly = 1,
    UpperOnly = 2,
    BothModules = 3,
}

/// State64 regime classification.
///
/// These variants and their discriminants are the normative encoding of the
/// TypeScript `State64RegimeClass` taxonomy in
/// `packages/state64-adapter/src/regimes.ts`. The Rust core MUST classify every
/// transition identically to the TypeScript reference; see `regime_class_from_distances`.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegimeClassCode {
    NoChange = 0,
    BitAdjustment = 1,
    ModuleReconfiguration = 2,
    CrossModuleRegimeShift = 3,
    NearTotalInversion = 4,
    FullBitReversal = 5,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Transition64Entry {
    pub source: u8,
    pub target: u8,
    pub mutation_mask: u8,
    pub distance: u8,
    pub lower_distance: u8,
    pub upper_distance: u8,
    pub module_scope: u8,
    pub regime_class: u8,
    pub index: u16,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Chain64Compression {
    pub source: u8,
    pub target: u8,
    pub net_mutation_mask: u8,
    pub cumulative_distance: u32,
    pub transition_count: u32,
    pub status: u8,
}

#[inline]
pub const fn is_valid_state64(value: u8) -> bool {
    value <= STATE64_MASK
}

#[inline]
pub const fn is_valid_mask64(value: u8) -> bool {
    value <= STATE64_MASK
}

#[inline]
pub fn validate_state64(value: u8) -> Result<u8, SemagraphErrorCode> {
    if is_valid_state64(value) {
        Ok(value)
    } else {
        Err(SemagraphErrorCode::InvalidState)
    }
}

#[inline]
pub fn validate_mask64(value: u8) -> Result<u8, SemagraphErrorCode> {
    if is_valid_mask64(value) {
        Ok(value)
    } else {
        Err(SemagraphErrorCode::InvalidMask)
    }
}

#[inline]
pub fn apply_mutation64(state: u8, mutation_mask: u8) -> Result<u8, SemagraphErrorCode> {
    validate_state64(state)?;
    validate_mask64(mutation_mask)?;
    Ok(state ^ mutation_mask)
}

#[inline]
pub fn mutation_between64(source: u8, target: u8) -> Result<u8, SemagraphErrorCode> {
    validate_state64(source)?;
    validate_state64(target)?;
    Ok(source ^ target)
}

#[inline]
pub fn hamming_distance64(source: u8, target: u8) -> Result<u8, SemagraphErrorCode> {
    let mask = mutation_between64(source, target)?;
    Ok(mask.count_ones() as u8)
}

#[inline]
pub fn lower_module3(state: u8) -> Result<u8, SemagraphErrorCode> {
    validate_state64(state)?;
    Ok((state >> 3) & 0b0000_0111)
}

#[inline]
pub fn upper_module3(state: u8) -> Result<u8, SemagraphErrorCode> {
    validate_state64(state)?;
    Ok(state & 0b0000_0111)
}

#[inline]
pub fn transition_index64(source: u8, target: u8) -> Result<u16, SemagraphErrorCode> {
    validate_state64(source)?;
    validate_state64(target)?;
    Ok((source as u16) * 64 + (target as u16))
}

#[inline]
pub const fn module_scope_from_distances(
    lower_distance: u8,
    upper_distance: u8,
) -> ModuleScopeCode {
    match (lower_distance > 0, upper_distance > 0) {
        (false, false) => ModuleScopeCode::NoChange,
        (true, false) => ModuleScopeCode::LowerOnly,
        (false, true) => ModuleScopeCode::UpperOnly,
        (true, true) => ModuleScopeCode::BothModules,
    }
}

/// Classify a transition into a regime class.
///
/// This mirrors, branch for branch and in the same order, the TypeScript
/// `classifyRegimeClass` function. The `module_scope` argument carries the same
/// information the TS code derives from `lower_distance`/`upper_distance`, so the
/// `both_modules` test below is equivalent to `moduleScope !== "both_modules"`.
#[inline]
pub const fn regime_class_from_distances(
    distance: u8,
    lower_distance: u8,
    upper_distance: u8,
) -> RegimeClassCode {
    let both_modules = lower_distance > 0 && upper_distance > 0;
    if distance == 0 {
        RegimeClassCode::NoChange
    } else if distance == 1 {
        RegimeClassCode::BitAdjustment
    } else if distance <= 2 && !both_modules {
        RegimeClassCode::ModuleReconfiguration
    } else if distance == 6 {
        RegimeClassCode::FullBitReversal
    } else if distance >= 4 {
        RegimeClassCode::NearTotalInversion
    } else {
        RegimeClassCode::CrossModuleRegimeShift
    }
}

pub fn lookup_transition64(
    source: u8,
    target: u8,
) -> Result<Transition64Entry, SemagraphErrorCode> {
    let mutation_mask = mutation_between64(source, target)?;
    let distance = mutation_mask.count_ones() as u8;
    let lower_mask = (mutation_mask >> 3) & 0b0000_0111;
    let upper_mask = mutation_mask & 0b0000_0111;
    let lower_distance = lower_mask.count_ones() as u8;
    let upper_distance = upper_mask.count_ones() as u8;
    let module_scope = module_scope_from_distances(lower_distance, upper_distance) as u8;
    let regime_class = regime_class_from_distances(distance, lower_distance, upper_distance) as u8;
    let index = transition_index64(source, target)?;
    Ok(Transition64Entry {
        source,
        target,
        mutation_mask,
        distance,
        lower_distance,
        upper_distance,
        module_scope,
        regime_class,
        index,
    })
}

pub fn compress_chain64(states: &[u8]) -> Result<Chain64Compression, SemagraphErrorCode> {
    if states.len() < 2 {
        return Err(SemagraphErrorCode::EmptyChain);
    }
    for state in states {
        validate_state64(*state)?;
    }

    let source = states[0];
    let target = *states.last().expect("validated non-empty chain");
    let mut net_mutation_mask: u8 = 0;
    let mut cumulative_distance: u32 = 0;

    for pair in states.windows(2) {
        let mask = pair[0] ^ pair[1];
        net_mutation_mask ^= mask;
        cumulative_distance += mask.count_ones();
    }

    Ok(Chain64Compression {
        source,
        target,
        net_mutation_mask,
        cumulative_distance,
        transition_count: (states.len() - 1) as u32,
        status: SemagraphErrorCode::Ok as u8,
    })
}

/// Pack transition metadata into a stable 64-bit word for low-overhead FFI.
/// Layout, least significant to most significant:
/// source:6, target:6, mutation:6, distance:3, lower_distance:2,
/// upper_distance:2, module_scope:2, regime_class:3, index:12.
pub fn pack_transition64(entry: Transition64Entry) -> u64 {
    let mut packed = 0u64;
    packed |= (entry.source as u64) & 0x3f;
    packed |= ((entry.target as u64) & 0x3f) << 6;
    packed |= ((entry.mutation_mask as u64) & 0x3f) << 12;
    packed |= ((entry.distance as u64) & 0x07) << 18;
    packed |= ((entry.lower_distance as u64) & 0x03) << 21;
    packed |= ((entry.upper_distance as u64) & 0x03) << 23;
    packed |= ((entry.module_scope as u64) & 0x03) << 25;
    packed |= ((entry.regime_class as u64) & 0x07) << 27;
    packed |= ((entry.index as u64) & 0x0fff) << 30;
    packed
}

pub mod shapes;
pub mod tables;

pub use shapes::{
    compress_trajectory_batch, project_trajectory, run_collapse_into, TrajectoryProjection,
    Q3_COUNT, Q3_MASK,
};
#[cfg(feature = "simd")]
pub use tables::classify_batch_simd;
pub use tables::{
    classify_batch, classify_batch_full, classify_branchless, classify_branchless_packed, BatchOut,
    DISTANCE_BY_MASK, LOWER_DISTANCE_BY_MASK, MODULE_SCOPE_BY_MASK, REGIME_BY_MASK,
    REGIME_BY_TRANSITION, UPPER_DISTANCE_BY_MASK,
};

#[no_mangle]
pub extern "C" fn sg64_is_valid_state(value: u8) -> u8 {
    if is_valid_state64(value) {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn sg64_apply_mutation(state: u8, mutation_mask: u8) -> u8 {
    if !is_valid_state64(state) || !is_valid_mask64(mutation_mask) {
        return 255;
    }
    state ^ mutation_mask
}

#[no_mangle]
pub extern "C" fn sg64_hamming_distance(source: u8, target: u8) -> u8 {
    if !is_valid_state64(source) || !is_valid_state64(target) {
        return 255;
    }
    (source ^ target).count_ones() as u8
}

#[no_mangle]
pub extern "C" fn sg64_transition_index(source: u8, target: u8) -> u16 {
    if !is_valid_state64(source) || !is_valid_state64(target) {
        return u16::MAX;
    }
    (source as u16) * 64 + (target as u16)
}

#[no_mangle]
pub extern "C" fn sg64_transition_packed(source: u8, target: u8) -> u64 {
    match lookup_transition64(source, target) {
        Ok(entry) => pack_transition64(entry),
        Err(_) => u64::MAX,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applies_xor_mutations() {
        assert_eq!(apply_mutation64(0b010110, 0b001010).unwrap(), 0b011100);
    }

    #[test]
    fn computes_distance_and_index() {
        assert_eq!(hamming_distance64(0b000000, 0b111111).unwrap(), 6);
        assert_eq!(transition_index64(0, 63).unwrap(), 63);
        assert_eq!(transition_index64(63, 0).unwrap(), 4032);
    }

    #[test]
    fn classifies_transition_metadata() {
        let entry = lookup_transition64(0b000000, 0b111111).unwrap();
        assert_eq!(entry.mutation_mask, 0b111111);
        assert_eq!(entry.distance, 6);
        assert_eq!(entry.lower_distance, 3);
        assert_eq!(entry.upper_distance, 3);
        assert_eq!(entry.regime_class, RegimeClassCode::FullBitReversal as u8);
    }

    #[test]
    fn regime_classes_match_typescript_taxonomy() {
        // distance 0 -> no_change
        assert_eq!(
            regime_class_from_distances(0, 0, 0),
            RegimeClassCode::NoChange
        );
        // distance 1 -> bit_adjustment
        assert_eq!(
            regime_class_from_distances(1, 1, 0),
            RegimeClassCode::BitAdjustment
        );
        // distance 2, single module -> module_reconfiguration
        assert_eq!(
            regime_class_from_distances(2, 2, 0),
            RegimeClassCode::ModuleReconfiguration
        );
        assert_eq!(
            regime_class_from_distances(2, 0, 2),
            RegimeClassCode::ModuleReconfiguration
        );
        // distance 2, both modules -> cross_module_regime_shift (NOT module_reconfiguration)
        assert_eq!(
            regime_class_from_distances(2, 1, 1),
            RegimeClassCode::CrossModuleRegimeShift
        );
        // distance 3, single module -> cross_module_regime_shift (previously diverged: Rust said IntraModule)
        assert_eq!(
            regime_class_from_distances(3, 3, 0),
            RegimeClassCode::CrossModuleRegimeShift
        );
        assert_eq!(
            regime_class_from_distances(3, 0, 3),
            RegimeClassCode::CrossModuleRegimeShift
        );
        // distance 3, both modules -> cross_module_regime_shift
        assert_eq!(
            regime_class_from_distances(3, 2, 1),
            RegimeClassCode::CrossModuleRegimeShift
        );
        // distance 4 and 5 -> near_total_inversion (this class did not exist in the old Rust core)
        assert_eq!(
            regime_class_from_distances(4, 2, 2),
            RegimeClassCode::NearTotalInversion
        );
        assert_eq!(
            regime_class_from_distances(4, 1, 3),
            RegimeClassCode::NearTotalInversion
        );
        assert_eq!(
            regime_class_from_distances(5, 2, 3),
            RegimeClassCode::NearTotalInversion
        );
        // distance 6 -> full_bit_reversal
        assert_eq!(
            regime_class_from_distances(6, 3, 3),
            RegimeClassCode::FullBitReversal
        );
    }

    #[test]
    fn compresses_chains() {
        let chain = compress_chain64(&[0b000000, 0b100000, 0b101000, 0b101010]).unwrap();
        assert_eq!(chain.source, 0b000000);
        assert_eq!(chain.target, 0b101010);
        assert_eq!(chain.net_mutation_mask, 0b101010);
        assert_eq!(chain.cumulative_distance, 3);
        assert_eq!(chain.transition_count, 3);
    }

    #[test]
    fn rejects_invalid_high_bits() {
        assert_eq!(validate_state64(64), Err(SemagraphErrorCode::InvalidState));
        assert_eq!(sg64_apply_mutation(64, 0), 255);
    }
}
