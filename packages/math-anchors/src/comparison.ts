import { canonicalStringify } from "./canonical.js";
import type { AnchorTrace, MathematicalDomainDefinition, MathematicalStructureComparison, ProjectionDecision } from "./types.js";

export function compareMathematicalStructures(
  left: MathematicalDomainDefinition,
  right: MathematicalDomainDefinition
): MathematicalStructureComparison {
  const leftContract = { kind: left.structure.kind, family: left.structure.family, declaredAxioms: left.structure.declaredAxioms };
  const rightContract = { kind: right.structure.kind, family: right.structure.family, declaredAxioms: right.structure.declaredAxioms };
  return {
    sameDefinition: left.id === right.id && left.version === right.version,
    sameStructureKind: left.structure.kind === right.structure.kind,
    sameDeclaredStructure: canonicalStringify(leftContract) === canonicalStringify(rightContract),
    sameLexicalLabel: left.label === right.label,
    semanticIdentityAsserted: false
  };
}

export function inspectAnchorTrace<TStateId extends string>(
  trace: AnchorTrace<TStateId>,
  position: 1 | 2 | 3 | 4 | 5 | 6
): ProjectionDecision {
  const decision = trace.bits.find((entry) => entry.position === position);
  if (!decision) throw new Error(`Anchor trace has no decision for bit position ${position}.`);
  return decision;
}
