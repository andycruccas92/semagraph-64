import type { BinaryState64, State64Transition } from "./types.js";
import { createBinaryState64, hammingDistance64 } from "./hypercube.js";

export type State64ModuleScope = "none" | "lower_only" | "upper_only" | "both_modules";
export type State64RegimeClass =
  | "no_change"
  | "bit_adjustment"
  | "module_reconfiguration"
  | "cross_module_regime_shift"
  | "near_total_inversion"
  | "full_bit_reversal";

/**
 * Canonical numeric encoding shared with the Rust core (`ModuleScopeCode`).
 * These integers are part of the cross-implementation contract and must not be
 * reordered without updating `packages/core-rs/src/lib.rs`.
 */
export const STATE64_MODULE_SCOPE_CODE: Readonly<Record<State64ModuleScope, number>> = {
  none: 0,
  lower_only: 1,
  upper_only: 2,
  both_modules: 3
};

/**
 * Canonical numeric encoding shared with the Rust core (`RegimeClassCode`).
 * These integers are part of the cross-implementation contract and must not be
 * reordered without updating `packages/core-rs/src/lib.rs`.
 */
export const STATE64_REGIME_CLASS_CODE: Readonly<Record<State64RegimeClass, number>> = {
  no_change: 0,
  bit_adjustment: 1,
  module_reconfiguration: 2,
  cross_module_regime_shift: 3,
  near_total_inversion: 4,
  full_bit_reversal: 5
};

export type State64RegimeClassification = {
  sourceStateId: string;
  targetStateId: string;
  distance: number;
  lowerDistance: number;
  upperDistance: number;
  moduleScope: State64ModuleScope;
  regimeClass: State64RegimeClass;
  rationale: string;
};

export function classifyState64RegimeTransition(transition: State64Transition): State64RegimeClassification {
  const source = createBinaryState64(transition.sourceStateId.slice(4));
  const target = createBinaryState64(transition.targetStateId.slice(4));
  return classifyState64RegimePair(source, target);
}

export function classifyState64RegimePair(source: BinaryState64, target: BinaryState64): State64RegimeClassification {
  const distance = hammingDistance64(source, target);
  const lowerDistance = moduleDistance(source.lowerModule, target.lowerModule);
  const upperDistance = moduleDistance(source.upperModule, target.upperModule);
  const moduleScope = classifyModuleScope(lowerDistance, upperDistance);
  const regimeClass = classifyRegimeClass(distance, moduleScope);

  return {
    sourceStateId: source.id,
    targetStateId: target.id,
    distance,
    lowerDistance,
    upperDistance,
    moduleScope,
    regimeClass,
    rationale: `State64 transition classified as ${regimeClass}; distance=${distance}, lowerDistance=${lowerDistance}, upperDistance=${upperDistance}.`
  };
}

function moduleDistance(left: readonly number[], right: readonly number[]): number {
  return left.reduce((distance, value, index) => distance + (value === right[index] ? 0 : 1), 0);
}

function classifyModuleScope(lowerDistance: number, upperDistance: number): State64ModuleScope {
  if (lowerDistance === 0 && upperDistance === 0) return "none";
  if (lowerDistance > 0 && upperDistance === 0) return "lower_only";
  if (lowerDistance === 0 && upperDistance > 0) return "upper_only";
  return "both_modules";
}

function classifyRegimeClass(distance: number, moduleScope: State64ModuleScope): State64RegimeClass {
  if (distance === 0) return "no_change";
  if (distance === 1) return "bit_adjustment";
  if (distance <= 2 && moduleScope !== "both_modules") return "module_reconfiguration";
  if (distance === 6) return "full_bit_reversal";
  if (distance >= 4) return "near_total_inversion";
  return "cross_module_regime_shift";
}
