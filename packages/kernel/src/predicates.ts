import type { ParameterSnapshot, ParameterValue, Predicate, PredicateExpression, PredicateSet } from "./types.js";

function comparableNumber(value: ParameterValue | readonly ParameterValue[]): number {
  if (typeof value !== "number") {
    throw new Error("Numeric predicate requires a numeric comparator value.");
  }
  return value;
}

export function evaluatePredicate(predicate: Predicate, parameters: ParameterSnapshot): boolean {
  const actual = parameters[predicate.parameterKey];
  if (actual === undefined) return false;

  switch (predicate.operator) {
    case "eq":
      return actual === predicate.value;
    case "neq":
      return actual !== predicate.value;
    case "gt":
      return typeof actual === "number" && actual > comparableNumber(predicate.value);
    case "gte":
      return typeof actual === "number" && actual >= comparableNumber(predicate.value);
    case "lt":
      return typeof actual === "number" && actual < comparableNumber(predicate.value);
    case "lte":
      return typeof actual === "number" && actual <= comparableNumber(predicate.value);
    case "in":
      if (!Array.isArray(predicate.value)) {
        throw new Error("The in predicate requires an array comparator value.");
      }
      return predicate.value.includes(actual);
  }
}

function isPredicate(expression: PredicateExpression): expression is Predicate {
  return "parameterKey" in expression;
}

export function evaluatePredicateExpression(expression: PredicateExpression, parameters: ParameterSnapshot): boolean {
  if (isPredicate(expression)) {
    return evaluatePredicate(expression, parameters);
  }
  return evaluatePredicateSet(expression, parameters);
}

export function evaluatePredicateSet(predicateSet: PredicateSet | undefined, parameters: ParameterSnapshot): boolean {
  if (!predicateSet) return true;
  const all = predicateSet.all?.every((predicate) => evaluatePredicateExpression(predicate, parameters)) ?? true;
  const any = predicateSet.any?.some((predicate) => evaluatePredicateExpression(predicate, parameters)) ?? true;
  const none = predicateSet.none?.every((predicate) => !evaluatePredicateExpression(predicate, parameters)) ?? true;
  return all && any && none;
}

export function flattenPredicateResults(predicateSet: PredicateSet, parameters: ParameterSnapshot): readonly boolean[] {
  return [
    ...(predicateSet.all ?? []).map((predicate) => evaluatePredicateExpression(predicate, parameters)),
    ...(predicateSet.any ?? []).map((predicate) => evaluatePredicateExpression(predicate, parameters)),
    ...(predicateSet.none ?? []).map((predicate) => !evaluatePredicateExpression(predicate, parameters))
  ];
}
