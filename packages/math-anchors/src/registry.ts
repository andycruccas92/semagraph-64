import { canonicalStringify, immutableJsonClone } from "./canonical.js";
import type {
  CandidateAnchor,
  MathematicalAnchorDefinition,
  MathematicalDomainDefinition,
  RegisteredAnchor
} from "./types.js";
import {
  assertValidMathematicalAnchorDefinition,
  assertValidMathematicalDomainDefinition
} from "./validation.js";

function versionKey(id: string, version: string): string {
  return `${id}\u0000${version}`;
}

export function createCandidateAnchor(
  definition: MathematicalAnchorDefinition,
  proposedBy: CandidateAnchor["proposedBy"]
): CandidateAnchor {
  return immutableJsonClone({ authority: "candidate", proposedBy, definition });
}

export class MathematicalAnchorRegistry {
  readonly #domains = new Map<string, MathematicalDomainDefinition>();
  readonly #anchors = new Map<string, RegisteredAnchor>();

  registerDomain(definition: MathematicalDomainDefinition): MathematicalDomainDefinition {
    assertValidMathematicalDomainDefinition(definition);
    const key = versionKey(definition.id, definition.version);
    const existing = this.#domains.get(key);
    if (existing) {
      if (canonicalStringify(existing) !== canonicalStringify(definition)) {
        throw new Error(`Mathematical domain identity collision: ${definition.id}@${definition.version}`);
      }
      return existing;
    }
    const registered = immutableJsonClone(definition);
    this.#domains.set(key, registered);
    return registered;
  }

  registerAnchor(candidate: CandidateAnchor, acceptedBy: string): RegisteredAnchor {
    if (candidate.authority !== "candidate") throw new Error("Only an explicit candidate anchor may be registered.");
    if (!acceptedBy.trim()) throw new Error("Registered anchor requires a non-empty accepting authority.");
    const definition = candidate.definition;
    const domain = this.requireDomain(definition.mathematicalDomainId, definition.mathematicalDomainVersion);
    assertValidMathematicalAnchorDefinition(definition, domain);
    const key = versionKey(definition.id, definition.version);
    const existing = this.#anchors.get(key);
    if (existing) {
      if (canonicalStringify(existing.definition) !== canonicalStringify(definition)) {
        throw new Error(`Mathematical anchor identity collision: ${definition.id}@${definition.version}`);
      }
      return existing;
    }
    const registered = immutableJsonClone({ authority: "registered" as const, acceptedBy, definition });
    this.#anchors.set(key, registered);
    return registered;
  }

  getDomain(id: string, version: string): MathematicalDomainDefinition | undefined {
    return this.#domains.get(versionKey(id, version));
  }

  requireDomain(id: string, version: string): MathematicalDomainDefinition {
    const definition = this.getDomain(id, version);
    if (!definition) throw new Error(`Unregistered mathematical domain: ${id}@${version}`);
    return definition;
  }

  getRegisteredAnchor(id: string, version: string): RegisteredAnchor | undefined {
    return this.#anchors.get(versionKey(id, version));
  }

  requireRegisteredAnchor(id: string, version: string): RegisteredAnchor {
    const anchor = this.getRegisteredAnchor(id, version);
    if (!anchor) throw new Error(`Unregistered mathematical anchor: ${id}@${version}`);
    return anchor;
  }

  listDomains(): readonly MathematicalDomainDefinition[] {
    return [...this.#domains.values()];
  }

  listRegisteredAnchors(): readonly RegisteredAnchor[] {
    return [...this.#anchors.values()];
  }
}
