import type { State64CatalogEntry, State64Id } from "./types.js";
import { createBinaryState64 } from "./hypercube.js";

function codeOf(ordinal: number): `S${string}` {
  return `S${ordinal.toString().padStart(2, "0")}` as `S${string}`;
}

export function createState64CatalogEntry(binary: string, index: number): State64CatalogEntry {
  const state = createBinaryState64(binary);
  const lowerBinary = state.lowerModule.join("");
  const upperBinary = state.upperModule.join("");
  return {
    ...state,
    index,
    ordinal: index + 1,
    code: codeOf(index + 1),
    lowerModuleId: `B3-${lowerBinary}`,
    upperModuleId: `B3-${upperBinary}`
  };
}

export function generateState64Catalog(): readonly State64CatalogEntry[] {
  return Array.from({ length: 64 }, (_, index) => createState64CatalogEntry(index.toString(2).padStart(6, "0"), index));
}

export const STATE64_CATALOG: readonly State64CatalogEntry[] = generateState64Catalog();

export function getState64ById(id: State64Id): State64CatalogEntry {
  const state = STATE64_CATALOG.find((item) => item.id === id);
  if (!state) throw new Error(`Unknown State64 id: ${id}`);
  return state;
}

export function getState64ByBinary(binary: string): State64CatalogEntry {
  if (!/^[01]{6}$/.test(binary)) throw new Error(`Expected a six-bit binary code, received: ${binary}`);
  const state = STATE64_CATALOG.find((item) => item.binary === binary);
  if (!state) throw new Error(`Unknown State64 binary code: ${binary}`);
  return state;
}

export function getState64ByOrdinal(ordinal: number): State64CatalogEntry {
  const state = STATE64_CATALOG.find((item) => item.ordinal === ordinal);
  if (!state) throw new Error(`Unknown State64 ordinal: ${ordinal}`);
  return state;
}

export function getStatesByModulePair(lowerModuleBinary: string, upperModuleBinary: string): readonly State64CatalogEntry[] {
  if (!/^[01]{3}$/.test(lowerModuleBinary) || !/^[01]{3}$/.test(upperModuleBinary)) {
    throw new Error("Module pair lookup requires two three-bit binary strings.");
  }
  return STATE64_CATALOG.filter(
    (state) => state.lowerModule.join("") === lowerModuleBinary && state.upperModule.join("") === upperModuleBinary
  );
}
