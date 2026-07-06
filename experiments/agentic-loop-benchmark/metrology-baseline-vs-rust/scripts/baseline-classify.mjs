#!/usr/bin/env node

const [sourceToken, targetToken] = process.argv.slice(2);

function parseState(token, label) {
  const value = Number.parseInt(token ?? "", 10);
  if (!Number.isInteger(value) || value < 0 || value > 63 || String(value) !== token) {
    throw new Error(`${label} must be an integer in 0..63`);
  }
  return value;
}

function classify(source, target) {
  const mutationMask = source ^ target;
  const distance = popcount6(mutationMask);
  const lowerDistance = popcount6((mutationMask >> 3) & 0b111);
  const upperDistance = popcount6(mutationMask & 0b111);
  const moduleScope = classifyModuleScope(lowerDistance, upperDistance);
  const regimeClass = classifyRegimeClass(distance, moduleScope);
  return {
    source,
    target,
    mutation_mask: mutationMask,
    distance,
    lower_distance: lowerDistance,
    upper_distance: upperDistance,
    module_scope: moduleScope,
    regime_class: regimeClass,
    regime_class_code: regimeClassCode(regimeClass),
    index: source * 64 + target
  };
}

function popcount6(value) {
  let count = 0;
  let cursor = value & 0b111111;
  while (cursor > 0) {
    count += cursor & 1;
    cursor >>= 1;
  }
  return count;
}

function classifyModuleScope(lowerDistance, upperDistance) {
  if (lowerDistance === 0 && upperDistance === 0) return "none";
  if (lowerDistance > 0 && upperDistance === 0) return "lower_only";
  if (lowerDistance === 0 && upperDistance > 0) return "upper_only";
  return "both_modules";
}

function classifyRegimeClass(distance, moduleScope) {
  if (distance === 0) return "no_change";
  if (distance === 1) return "bit_adjustment";
  if (distance <= 2 && moduleScope !== "both_modules") return "module_reconfiguration";
  if (distance === 6) return "full_bit_reversal";
  if (distance >= 4) return "near_total_inversion";
  return "cross_module_regime_shift";
}

function regimeClassCode(regimeClass) {
  return {
    no_change: 0,
    bit_adjustment: 1,
    module_reconfiguration: 2,
    cross_module_regime_shift: 3,
    near_total_inversion: 4,
    full_bit_reversal: 5
  }[regimeClass];
}

try {
  const source = parseState(sourceToken, "source");
  const target = parseState(targetToken, "target");
  process.stdout.write(`${JSON.stringify(classify(source, target))}\n`);
} catch (error) {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
