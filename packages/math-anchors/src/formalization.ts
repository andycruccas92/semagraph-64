import { canonicalStringify } from "./canonical.js";
import { MathematicalAnchorRegistry } from "./registry.js";
import type {
  EvidenceReference,
  FormalPredicate,
  FormalPredicateExpression,
  FormalValue,
  FormalValueType,
  FormalizedObservation,
  FormalizedSnapshot,
  MathematicalAnchorDefinition,
  MathematicalAnchorObservation,
  ObservationBinding,
  ProjectionDecision,
  ProjectionEvaluation
} from "./types.js";

function typeMatches(value: FormalValue, expected: FormalValueType): boolean {
  return typeof value === expected && (typeof value !== "number" || Number.isFinite(value));
}

function validateEvidence(references: readonly EvidenceReference[], minimum: number, requireContentHash: boolean, observationKey: string): void {
  if (references.length < minimum) {
    throw new Error(`Observation ${observationKey} requires at least ${minimum} evidence reference(s).`);
  }
  const ids = new Set<string>();
  for (const reference of references) {
    if (!reference.id.trim() || !reference.source.trim()) throw new Error(`Observation ${observationKey} has an invalid evidence reference.`);
    if (ids.has(reference.id)) throw new Error(`Observation ${observationKey} has duplicate evidence reference id: ${reference.id}`);
    if (requireContentHash && !reference.contentHash?.trim()) {
      throw new Error(`Observation ${observationKey} requires contentHash on every evidence reference.`);
    }
    ids.add(reference.id);
  }
}

function normalizeUnit(value: FormalValue, unit: string | undefined, definition: MathematicalAnchorDefinition, binding: ObservationBinding): { value: FormalValue; canonicalUnit?: string } {
  const variable = definition.variables.find((entry) => entry.id === binding.formalVariableId);
  if (!variable) throw new Error(`Unknown formal variable: ${binding.formalVariableId}`);
  const constraint = variable.unitConstraint;
  if (!constraint) return { value };
  if (typeof value !== "number") throw new Error(`Unit-constrained variable ${variable.id} requires a numeric observation.`);
  if (!unit) throw new Error(`Observation ${binding.observationKey} requires a unit in dimension ${constraint.dimension}.`);
  const conversion = constraint.conversions.find((entry) => entry.fromUnit === unit);
  if (!conversion) {
    throw new Error(`Unit mismatch for ${binding.observationKey}: ${unit} is not admitted for dimension ${constraint.dimension}.`);
  }
  return { value: value * conversion.scale + conversion.offset, canonicalUnit: constraint.canonicalUnit };
}

function transformValue(value: FormalValue, binding: ObservationBinding): FormalValue {
  switch (binding.transform.kind) {
    case "identity": return value;
    case "absolute": {
      if (typeof value !== "number") throw new Error(`Absolute transform for ${binding.id} requires a number.`);
      return Math.abs(value);
    }
    case "scale_offset": {
      if (typeof value !== "number") throw new Error(`Scale/offset transform for ${binding.id} requires a number.`);
      return value * binding.transform.scale + binding.transform.offset;
    }
  }
}

function replayMaterial(snapshot: Omit<FormalizedSnapshot, "replayKey">): unknown {
  return snapshot;
}

export function computeFormalizedSnapshotReplayKey(snapshot: Omit<FormalizedSnapshot, "replayKey">): string {
  return `MAR:${canonicalStringify(replayMaterial(snapshot))}`;
}

export function applyMathematicalAnchor(
  registry: MathematicalAnchorRegistry,
  anchorDefinitionId: string,
  anchorVersion: string,
  observations: readonly MathematicalAnchorObservation[]
): FormalizedSnapshot {
  const registered = registry.requireRegisteredAnchor(anchorDefinitionId, anchorVersion);
  const definition = registered.definition;
  const observationByKey = new Map<string, MathematicalAnchorObservation>();
  const admissibleKeys = new Set(definition.observationBindings.map((binding) => binding.observationKey));

  for (const observation of observations) {
    if (!observation.key.trim()) throw new Error("Mathematical anchor observation key must not be empty.");
    if (!admissibleKeys.has(observation.key)) throw new Error(`Observation is not bound by anchor ${definition.id}@${definition.version}: ${observation.key}`);
    if (observationByKey.has(observation.key)) throw new Error(`Duplicate mathematical anchor observation key: ${observation.key}`);
    observationByKey.set(observation.key, observation);
  }

  const formalVariables: Record<string, FormalValue> = {};
  const formalizedObservations: FormalizedObservation[] = [];
  const evidenceById = new Map<string, EvidenceReference>();
  for (const binding of definition.observationBindings) {
    const observation = observationByKey.get(binding.observationKey);
    const variable = definition.variables.find((entry) => entry.id === binding.formalVariableId);
    if (!variable) throw new Error(`Unknown formal variable: ${binding.formalVariableId}`);

    if (!observation) {
      if (binding.required || binding.declaredDefault === undefined) {
        throw new Error(`Missing required observation: ${binding.observationKey}`);
      }
      if (!typeMatches(binding.declaredDefault, variable.valueType)) {
        throw new Error(`Declared default for ${binding.observationKey} does not match ${variable.valueType}.`);
      }
      formalVariables[variable.id] = binding.declaredDefault;
      formalizedObservations.push({
        bindingId: binding.id,
        observationKey: binding.observationKey,
        formalVariableId: variable.id,
        formalValue: binding.declaredDefault,
        origin: "declared_default",
        evidenceReferences: []
      });
      continue;
    }

    validateEvidence(
      observation.evidenceReferences,
      definition.evidenceProvenance.minimumReferencesPerObservation,
      definition.evidenceProvenance.requireContentHash,
      observation.key
    );
    for (const reference of observation.evidenceReferences) {
      const existing = evidenceById.get(reference.id);
      if (existing && canonicalStringify(existing) !== canonicalStringify(reference)) {
        throw new Error(`Evidence reference identity collision: ${reference.id}`);
      }
      evidenceById.set(reference.id, reference);
    }
    const normalized = normalizeUnit(observation.value, observation.unit, definition, binding);
    const formalValue = transformValue(normalized.value, binding);
    if (!typeMatches(formalValue, variable.valueType)) {
      throw new Error(`Formalized value for ${variable.id} does not match ${variable.valueType}.`);
    }
    formalVariables[variable.id] = formalValue;
    formalizedObservations.push({
      bindingId: binding.id,
      observationKey: observation.key,
      formalVariableId: variable.id,
      observedValue: observation.value,
      ...(observation.unit ? { observedUnit: observation.unit } : {}),
      formalValue,
      ...(normalized.canonicalUnit ? { canonicalUnit: normalized.canonicalUnit } : {}),
      origin: "observation",
      evidenceReferences: observation.evidenceReferences
    });
  }

  const material: Omit<FormalizedSnapshot, "replayKey"> = {
    mathematicalDomainId: definition.mathematicalDomainId,
    mathematicalDomainVersion: definition.mathematicalDomainVersion,
    anchorDefinitionId: definition.id,
    anchorVersion: definition.version,
    projectionVersion: definition.projection.version,
    formalVariables,
    formalizedObservations,
    assumptions: definition.assumptions,
    validityScope: definition.validityScope
  };
  return { ...material, replayKey: computeFormalizedSnapshotReplayKey(material) };
}

function compare(actual: FormalValue, predicate: FormalPredicate): boolean {
  const expected = predicate.value;
  switch (predicate.operator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte": return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt": return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte": return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in": return Array.isArray(expected) && expected.includes(actual);
  }
}

function evaluateExpression(expression: FormalPredicateExpression, variables: Readonly<Record<string, FormalValue>>): boolean {
  if ("formalVariableId" in expression) {
    const actual = variables[expression.formalVariableId];
    if (actual === undefined) throw new Error(`Projection references absent formal variable: ${expression.formalVariableId}`);
    return compare(actual, expression);
  }
  const all = expression.all?.every((nested) => evaluateExpression(nested, variables)) ?? true;
  const any = expression.any?.some((nested) => evaluateExpression(nested, variables)) ?? true;
  const none = expression.none?.every((nested) => !evaluateExpression(nested, variables)) ?? true;
  return all && any && none;
}

function collectReferences(expression: FormalPredicateExpression, variables: Set<string>, relations: Set<string>): void {
  if ("formalVariableId" in expression) {
    variables.add(expression.formalVariableId);
    for (const relationId of expression.formalRelationIds) relations.add(relationId);
    return;
  }
  for (const nested of [...(expression.all ?? []), ...(expression.any ?? []), ...(expression.none ?? [])]) {
    collectReferences(nested, variables, relations);
  }
}

export function evaluateRegisteredProjection(registry: MathematicalAnchorRegistry, snapshot: FormalizedSnapshot): ProjectionEvaluation {
  const registered = registry.requireRegisteredAnchor(snapshot.anchorDefinitionId, snapshot.anchorVersion);
  const definition = registered.definition;
  const expectedIdentity = [
    definition.mathematicalDomainId,
    definition.mathematicalDomainVersion,
    definition.projection.version
  ];
  const actualIdentity = [snapshot.mathematicalDomainId, snapshot.mathematicalDomainVersion, snapshot.projectionVersion];
  if (canonicalStringify(expectedIdentity) !== canonicalStringify(actualIdentity)) {
    throw new Error("Formalized snapshot identity does not match its registered anchor version.");
  }
  if (canonicalStringify(snapshot.assumptions) !== canonicalStringify(definition.assumptions)
    || canonicalStringify(snapshot.validityScope) !== canonicalStringify(definition.validityScope)) {
    throw new Error("Formalized snapshot assumptions or validity scope drifted from its registered anchor.");
  }
  const { replayKey: _ignored, ...material } = snapshot;
  if (snapshot.replayKey !== computeFormalizedSnapshotReplayKey(material)) {
    throw new Error("Formalized snapshot replay key does not match its content.");
  }
  const replayObservations: MathematicalAnchorObservation[] = snapshot.formalizedObservations
    .filter((row) => row.origin === "observation")
    .map((row) => {
      if (row.observedValue === undefined) throw new Error(`Formalized observation ${row.observationKey} has no observed value.`);
      return {
        key: row.observationKey,
        value: row.observedValue,
        ...(row.observedUnit ? { unit: row.observedUnit } : {}),
        evidenceReferences: row.evidenceReferences
      };
    });
  const replayed = applyMathematicalAnchor(registry, snapshot.anchorDefinitionId, snapshot.anchorVersion, replayObservations);
  if (canonicalStringify(replayed) !== canonicalStringify(snapshot)) {
    throw new Error("Formalized snapshot cannot be reproduced from its retained observations and registered anchor.");
  }

  const decisions: ProjectionDecision[] = definition.projection.predicates
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((predicate) => {
      const variableIds = new Set<string>();
      const relationIds = new Set<string>();
      collectReferences(predicate.expression, variableIds, relationIds);
      const observationRows = snapshot.formalizedObservations.filter((row) => variableIds.has(row.formalVariableId));
      const evidenceById = new Map<string, EvidenceReference>();
      for (const row of observationRows) for (const reference of row.evidenceReferences) evidenceById.set(reference.id, reference);
      const result = evaluateExpression(predicate.expression, snapshot.formalVariables);
      return {
        predicateId: predicate.id,
        position: predicate.position,
        label: predicate.label,
        result,
        value: result ? (predicate.trueValue ?? 1) : (predicate.falseValue ?? 0),
        formalVariableIds: [...variableIds],
        formalRelationIds: [...relationIds],
        observationBindingIds: observationRows.map((row) => row.bindingId),
        evidenceReferences: [...evidenceById.values()]
      };
    });
  if (decisions.length !== 6) throw new Error("A registered State64 projection must evaluate exactly six predicates.");
  const values = decisions.map((decision) => decision.value);
  const bits = values as [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
  return { projectionVersion: definition.projection.version, bits, decisions };
}
