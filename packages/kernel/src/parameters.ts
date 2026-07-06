import type { ParameterDefinition, ParameterSnapshot, ParameterValue, Predicate, PredicateExpression } from "./types.js";

export type ValidationIssue = {
  parameterKey: string;
  message: string;
};

export type PredicateReferenceInput = PredicateExpression | readonly PredicateExpression[];

function isValidValue(definition: ParameterDefinition, value: ParameterValue): boolean {
  switch (definition.kind) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (definition.min === undefined || value >= definition.min) &&
        (definition.max === undefined || value <= definition.max)
      );
    case "categorical":
    case "ordinal":
      return (
        typeof value === "string" &&
        definition.allowedValues !== undefined &&
        definition.allowedValues.includes(value)
      );
  }
}

export function validateParameterDefinitions(definitions: readonly ParameterDefinition[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (!definition.key.trim()) {
      issues.push({ parameterKey: definition.key, message: "Parameter key must not be empty." });
    }
    if (seen.has(definition.key)) {
      issues.push({ parameterKey: definition.key, message: "Parameter key must be unique." });
    }
    seen.add(definition.key);

    if ((definition.kind === "categorical" || definition.kind === "ordinal") && !definition.allowedValues?.length) {
      issues.push({ parameterKey: definition.key, message: "Categorical and ordinal parameters require allowedValues." });
    }
    if (definition.kind === "number" && definition.min !== undefined && definition.max !== undefined && definition.min > definition.max) {
      issues.push({ parameterKey: definition.key, message: "Minimum cannot exceed maximum." });
    }
  }
  return issues;
}

export function validateParameterSnapshot(
  definitions: readonly ParameterDefinition[],
  parameters: ParameterSnapshot
): ValidationIssue[] {
  const issues = validateParameterDefinitions(definitions);
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const definition of definitions) {
    const value = parameters[definition.key];
    if (value === undefined) {
      issues.push({ parameterKey: definition.key, message: "Missing parameter value." });
      continue;
    }
    if (!isValidValue(definition, value)) {
      issues.push({ parameterKey: definition.key, message: `Invalid value for ${definition.kind} parameter.` });
    }
  }

  for (const key of Object.keys(parameters)) {
    if (!definitionByKey.has(key)) {
      issues.push({ parameterKey: key, message: "Unknown parameter value." });
    }
  }
  return issues;
}

function isPredicate(expression: PredicateExpression): expression is Predicate {
  return "parameterKey" in expression;
}

function isPredicateReferenceList(reference: PredicateReferenceInput): reference is readonly PredicateExpression[] {
  return Array.isArray(reference);
}

function collectPredicateParameterReferenceIssues(
  reference: PredicateReferenceInput,
  definitionByKey: ReadonlyMap<string, ParameterDefinition>,
  issues: ValidationIssue[]
): void {
  if (isPredicateReferenceList(reference)) {
    for (const expression of reference) {
      collectPredicateParameterReferenceIssues(expression, definitionByKey, issues);
    }
    return;
  }

  if (isPredicate(reference)) {
    if (!definitionByKey.has(reference.parameterKey)) {
      issues.push({
        parameterKey: reference.parameterKey,
        message: "Predicate references undeclared parameter key."
      });
    }
    return;
  }

  for (const expression of reference.all ?? []) {
    collectPredicateParameterReferenceIssues(expression, definitionByKey, issues);
  }
  for (const expression of reference.any ?? []) {
    collectPredicateParameterReferenceIssues(expression, definitionByKey, issues);
  }
  for (const expression of reference.none ?? []) {
    collectPredicateParameterReferenceIssues(expression, definitionByKey, issues);
  }
}

export function validatePredicateParameterReferences(
  definitions: readonly ParameterDefinition[],
  references: PredicateReferenceInput
): ValidationIssue[] {
  const issues = validateParameterDefinitions(definitions);
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  collectPredicateParameterReferenceIssues(references, definitionByKey, issues);
  return issues;
}

export function assertValidPredicateParameterReferences(
  definitions: readonly ParameterDefinition[],
  references: PredicateReferenceInput
): void {
  const issues = validatePredicateParameterReferences(definitions, references);
  if (issues.length) {
    const summary = issues.map((issue) => `${issue.parameterKey}: ${issue.message}`).join("; ");
    throw new Error(`Invalid predicate parameter references: ${summary}`);
  }
}

export function assertValidParameterSnapshot(
  definitions: readonly ParameterDefinition[],
  parameters: ParameterSnapshot
): void {
  const issues = validateParameterSnapshot(definitions, parameters);
  if (issues.length) {
    const summary = issues.map((issue) => `${issue.parameterKey}: ${issue.message}`).join("; ");
    throw new Error(`Invalid parameter snapshot: ${summary}`);
  }
}
