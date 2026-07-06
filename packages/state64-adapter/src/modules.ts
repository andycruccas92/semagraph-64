import type { BitVector3, Module3, Module3Id } from "./types.js";
import { binaryStringToBits } from "./bits.js";

function createModule3(binary: string, index: number): Module3 {
  if (!/^[01]{3}$/.test(binary)) throw new Error(`Expected a three-bit binary module, received: ${binary}`);
  return {
    id: `B3-${binary}` as Module3Id,
    index,
    binary,
    bits: binaryStringToBits(binary) as unknown as BitVector3
  };
}

export const MODULE3_CATALOG: readonly Module3[] = Array.from({ length: 8 }, (_, index) =>
  createModule3(index.toString(2).padStart(3, "0"), index)
);

export function getModule3ByBinary(binary: string): Module3 {
  const module = MODULE3_CATALOG.find((item) => item.binary === binary);
  if (!module) throw new Error(`Unknown three-bit module: ${binary}`);
  return module;
}

export function getModule3ById(id: Module3Id): Module3 {
  const module = MODULE3_CATALOG.find((item) => item.id === id);
  if (!module) throw new Error(`Unknown three-bit module id: ${id}`);
  return module;
}
