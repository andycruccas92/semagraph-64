import type {
  AnchorValidationIssue,
  FormalPredicateExpression,
  FormalValue,
  FormalValueType,
  MathematicalAnchorDefinition,
  MathematicalDomainDefinition
} from "./types.js";
import { isMathematicalStructureKind, structureFamilyFor } from "./vocabulary.js";

function issue(path: string, code: string, message: string): AnchorValidationIssue {
  return { path, code, message };
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function valueMatchesType(value: FormalValue, valueType: FormalValueType): boolean {
  return typeof value === valueType && (typeof value !== "number" || Number.isFinite(value));
}

function collectPredicateReferences(
  expression: FormalPredicateExpression,
  variableIds: Set<string>,
  relationIds: Set<string>,
  path: string,
  issues: AnchorValidationIssue[]
): void {
  if ("formalVariableId" in expression) {
    if (!variableIds.has(expression.formalVariableId)) {
      issues.push(issue(`${path}.formalVariableId`, "unknown_variable", `Predicate references unknown formal variable: ${expression.formalVariableId}`));
    }
    for (const relationId of expression.formalRelationIds) {
      if (!relationIds.has(relationId)) {
        issues.push(issue(`${path}.formalRelationIds`, "unknown_relation", `Predicate references unknown formal relation: ${relationId}`));
      }
    }
    if (expression.operator === "in" && !Array.isArray(expression.value)) {
      issues.push(issue(`${path}.value`, "invalid_comparator", "The in operator requires an array value."));
    }
    return;
  }

  const groups = [expression.all ?? [], expression.any ?? [], expression.none ?? []];
  if (groups.every((group) => group.length === 0)) {
    issues.push(issue(path, "empty_predicate_expression", "A predicate expression must contain all, any, or none clauses."));
  }
  for (const [groupIndex, group] of groups.entries()) {
    for (const [index, nested] of group.entries()) {
      collectPredicateReferences(nested, variableIds, relationIds, `${path}.${["all", "any", "none"][groupIndex]}.${index}`, issues);
    }
  }
}

export function validateMathematicalDomainDefinition(definition: MathematicalDomainDefinition): AnchorValidationIssue[] {
  const issues: AnchorValidationIssue[] = [];
  if (!nonEmpty(definition.id)) issues.push(issue("id", "required", "Mathematical domain id must not be empty."));
  if (!nonEmpty(definition.version)) issues.push(issue("version", "required", "Mathematical domain version must not be empty."));
  if (!nonEmpty(definition.label)) issues.push(issue("label", "required", "Mathematical domain label must not be empty."));
  if (!nonEmpty(definition.observationalSpace.description)) {
    issues.push(issue("observationalSpace.description", "required", "The observational space requires a description."));
  }
  if (definition.observationalSpace.admissibleObservationKeys.length === 0) {
    issues.push(issue("observationalSpace.admissibleObservationKeys", "required", "At least one admissible observation key is required."));
  }
  for (const duplicate of duplicateValues(definition.observationalSpace.admissibleObservationKeys)) {
    issues.push(issue("observationalSpace.admissibleObservationKeys", "duplicate", `Duplicate admissible observation key: ${duplicate}`));
  }
  if (!isMathematicalStructureKind(definition.structure.kind)) {
    issues.push(issue("structure.kind", "unknown_structure_kind", `Unknown mathematical structure kind: ${String(definition.structure.kind)}`));
  } else if (structureFamilyFor(definition.structure.kind) !== definition.structure.family) {
    issues.push(issue("structure.family", "family_mismatch", `Structure kind ${definition.structure.kind} belongs to ${structureFamilyFor(definition.structure.kind)}.`));
  }
  if (!nonEmpty(definition.structure.description)) {
    issues.push(issue("structure.description", "required", "The mathematical structure requires an operational description."));
  }
  return issues;
}

export function validateMathematicalAnchorDefinition(
  definition: MathematicalAnchorDefinition,
  domain?: MathematicalDomainDefinition
): AnchorValidationIssue[] {
  const issues: AnchorValidationIssue[] = [];
  const requiredStrings: readonly [string, string][] = [
    ["id", definition.id], ["version", definition.version], ["label", definition.label],
    ["mathematicalDomainId", definition.mathematicalDomainId],
    ["mathematicalDomainVersion", definition.mathematicalDomainVersion],
    ["formalizationDescription", definition.formalizationDescription],
    ["projection.version", definition.projection.version],
    ["validityScope.description", definition.validityScope.description]
  ];
  for (const [path, value] of requiredStrings) {
    if (!nonEmpty(value)) issues.push(issue(path, "required", `${path} must not be empty.`));
  }

  if (!isMathematicalStructureKind(definition.structureKind)) {
    issues.push(issue("structureKind", "unknown_structure_kind", `Unknown mathematical structure kind: ${String(definition.structureKind)}`));
  }
  if (domain) {
    if (domain.id !== definition.mathematicalDomainId || domain.version !== definition.mathematicalDomainVersion) {
      issues.push(issue("mathematicalDomainId", "domain_identity_mismatch", "Anchor domain identity does not match the registered mathematical domain."));
    }
    if (domain.structure.kind !== definition.structureKind) {
      issues.push(issue("structureKind", "structure_mismatch", `Anchor structure ${definition.structureKind} does not match domain structure ${domain.structure.kind}.`));
    }
  }

  const variableIds = new Set(definition.variables.map((variable) => variable.id));
  const relationIds = new Set(definition.relations.map((relation) => relation.id));
  for (const duplicate of duplicateValues(definition.variables.map((variable) => variable.id))) {
    issues.push(issue("variables", "duplicate", `Duplicate formal variable id: ${duplicate}`));
  }
  for (const duplicate of duplicateValues(definition.relations.map((relation) => relation.id))) {
    issues.push(issue("relations", "duplicate", `Duplicate formal relation id: ${duplicate}`));
  }
  for (const duplicate of duplicateValues(definition.observationBindings.map((binding) => binding.id))) {
    issues.push(issue("observationBindings", "duplicate", `Duplicate observation binding id: ${duplicate}`));
  }
  for (const duplicate of duplicateValues(definition.observationBindings.map((binding) => binding.observationKey))) {
    issues.push(issue("observationBindings", "duplicate_observation", `Observation key is bound more than once: ${duplicate}`));
  }
  for (const duplicate of duplicateValues(definition.observationBindings.map((binding) => binding.formalVariableId))) {
    issues.push(issue("observationBindings", "duplicate_variable_binding", `Formal variable is bound more than once: ${duplicate}`));
  }

  for (const [index, variable] of definition.variables.entries()) {
    if (!nonEmpty(variable.id)) issues.push(issue(`variables.${index}.id`, "required", "Formal variable id must not be empty."));
    if (!nonEmpty(variable.label) || !nonEmpty(variable.description)) {
      issues.push(issue(`variables.${index}`, "required", "Formal variable label and description must not be empty."));
    }
    if (variable.unitConstraint) {
      const unit = variable.unitConstraint;
      if (!nonEmpty(unit.dimension) || !nonEmpty(unit.canonicalUnit)) {
        issues.push(issue(`variables.${index}.unitConstraint`, "invalid_unit_constraint", "Unit dimension and canonical unit must not be empty."));
      }
      const conversions = unit.conversions.filter((entry) => entry.fromUnit === unit.canonicalUnit);
      if (conversions.length !== 1 || conversions[0]?.scale !== 1 || conversions[0]?.offset !== 0) {
        issues.push(issue(`variables.${index}.unitConstraint.conversions`, "missing_identity_conversion", "Canonical unit requires exactly one identity conversion."));
      }
      for (const conversion of unit.conversions) {
        if (!Number.isFinite(conversion.scale) || !Number.isFinite(conversion.offset)) {
          issues.push(issue(`variables.${index}.unitConstraint.conversions`, "invalid_conversion", "Unit conversion scale and offset must be finite."));
        }
      }
    }
  }

  for (const [index, relation] of definition.relations.entries()) {
    if (!nonEmpty(relation.id) || !nonEmpty(relation.kind) || !nonEmpty(relation.description)) {
      issues.push(issue(`relations.${index}`, "required", "Formal relation id, kind, and description must not be empty."));
    }
    if (relation.operandVariableIds.length === 0) {
      issues.push(issue(`relations.${index}.operandVariableIds`, "required", "A formal relation requires at least one operand variable."));
    }
    for (const variableId of relation.operandVariableIds) {
      if (!variableIds.has(variableId)) issues.push(issue(`relations.${index}.operandVariableIds`, "unknown_variable", `Relation references unknown formal variable: ${variableId}`));
    }
  }

  for (const [index, binding] of definition.observationBindings.entries()) {
    if (!nonEmpty(binding.id) || !nonEmpty(binding.observationKey)) {
      issues.push(issue(`observationBindings.${index}`, "required", "Binding id and observation key must not be empty."));
    }
    if (!variableIds.has(binding.formalVariableId)) {
      issues.push(issue(`observationBindings.${index}.formalVariableId`, "unknown_variable", `Binding references unknown formal variable: ${binding.formalVariableId}`));
    }
    if (domain && !domain.observationalSpace.admissibleObservationKeys.includes(binding.observationKey)) {
      issues.push(issue(`observationBindings.${index}.observationKey`, "inadmissible_observation", `Observation key is not admitted by the domain: ${binding.observationKey}`));
    }
    const variable = definition.variables.find((entry) => entry.id === binding.formalVariableId);
    if (!binding.required && binding.declaredDefault === undefined) {
      issues.push(issue(`observationBindings.${index}.declaredDefault`, "missing_default", "An optional binding requires an explicit deterministic default."));
    }
    if (binding.declaredDefault !== undefined && variable && !valueMatchesType(binding.declaredDefault, variable.valueType)) {
      issues.push(issue(`observationBindings.${index}.declaredDefault`, "default_type_mismatch", `Declared default does not match ${variable.valueType}.`));
    }
    if (binding.transform.kind === "scale_offset" && (!Number.isFinite(binding.transform.scale) || !Number.isFinite(binding.transform.offset))) {
      issues.push(issue(`observationBindings.${index}.transform`, "invalid_transform", "Scale and offset must be finite."));
    }
  }
  for (const variableId of variableIds) {
    if (!definition.observationBindings.some((binding) => binding.formalVariableId === variableId)) {
      issues.push(issue("observationBindings", "unbound_variable", `Formal variable has no observation binding: ${variableId}`));
    }
  }

  if (definition.assumptions.length === 0) issues.push(issue("assumptions", "required", "At least one explicit assumption is required."));
  for (const duplicate of duplicateValues(definition.assumptions.map((assumption) => assumption.id))) {
    issues.push(issue("assumptions", "duplicate", `Duplicate assumption id: ${duplicate}`));
  }
  if (!Number.isInteger(definition.evidenceProvenance.minimumReferencesPerObservation) || definition.evidenceProvenance.minimumReferencesPerObservation < 0) {
    issues.push(issue("evidenceProvenance.minimumReferencesPerObservation", "invalid_minimum", "Evidence reference minimum must be a non-negative integer."));
  }

  if (definition.projection.predicates.length !== 6) {
    issues.push(issue("projection.predicates", "predicate_count", "A State64 projection requires exactly six predicates."));
  }
  const positions = definition.projection.predicates.map((predicate) => predicate.position);
  if (new Set(positions).size !== 6 || positions.some((position) => position < 1 || position > 6)) {
    issues.push(issue("projection.predicates", "predicate_positions", "Projection positions 1 through 6 must each occur exactly once."));
  }
  for (const [index, predicate] of definition.projection.predicates.entries()) {
    if (!nonEmpty(predicate.id) || !nonEmpty(predicate.label)) {
      issues.push(issue(`projection.predicates.${index}`, "required", "Predicate id and label must not be empty."));
    }
    collectPredicateReferences(predicate.expression, variableIds, relationIds, `projection.predicates.${index}.expression`, issues);
  }
  return issues;
}

export function assertValidMathematicalDomainDefinition(definition: MathematicalDomainDefinition): void {
  const issues = validateMathematicalDomainDefinition(definition);
  if (issues.length) throw new Error(`Invalid mathematical domain: ${issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`);
}

export function assertValidMathematicalAnchorDefinition(definition: MathematicalAnchorDefinition, domain?: MathematicalDomainDefinition): void {
  const issues = validateMathematicalAnchorDefinition(definition, domain);
  if (issues.length) throw new Error(`Invalid mathematical anchor: ${issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`);
}
