import type { BinaryBitValue, BinaryState64, BitPosition, BitVector3, BitVector6, MutationMask64, State64Id } from "./types.js";
import { binaryStringToBits } from "./bits.js";

function assertSixBitBinary(binary: string): asserts binary is `${number}` {
  if (!/^[01]{6}$/.test(binary)) throw new Error(`Expected a six-bit binary code, received: ${binary}`);
}

function asBitVector6(binary: string): BitVector6 {
  assertSixBitBinary(binary);
  return binaryStringToBits(binary) as unknown as BitVector6;
}

export function createBinaryState64(binary: string): BinaryState64 {
  const bits = asBitVector6(binary);
  return {
    id: `S64-${binary}` as State64Id,
    binary,
    bits,
    lowerModule: bits.slice(0, 3) as unknown as BitVector3,
    upperModule: bits.slice(3, 6) as unknown as BitVector3
  };
}

export function createMutationMask64(positions: readonly BitPosition[]): MutationMask64 {
  const bits: BinaryBitValue[] = [0, 0, 0, 0, 0, 0];
  const seen = new Set<number>();
  for (const position of positions) {
    if (!Number.isInteger(position) || position < 1 || position > 6) throw new Error(`Invalid mutation position: ${position}`);
    if (seen.has(position)) throw new Error(`Duplicate mutation position: ${position}`);
    seen.add(position);
    bits[position - 1] = 1;
  }
  return `M64-${bits.join("")}` as MutationMask64;
}

export function createMutationMask64FromBinary(binary: string): MutationMask64 {
  assertSixBitBinary(binary);
  return `M64-${binary}` as MutationMask64;
}

export function positionsFromMutationMask64(mask: MutationMask64): readonly BitPosition[] {
  const binary = mask.slice(4);
  assertSixBitBinary(binary);
  return [...binary]
    .map((bit, index) => (bit === "1" ? ((index + 1) as BitPosition) : null))
    .filter((position): position is BitPosition => position !== null);
}

export function applyMutationMask64(state: BinaryState64 | State64Id, mask: MutationMask64): BinaryState64 {
  const source = typeof state === "string" ? createBinaryState64(state.slice(4)) : state;
  const maskBinary = mask.slice(4);
  const maskBits = asBitVector6(maskBinary);
  const result = source.bits.map((bit, index) => (bit ^ (maskBits[index] ?? 0)) as BinaryBitValue).join("");
  return createBinaryState64(result);
}

export function mutationMaskBetween64(source: BinaryState64 | State64Id, target: BinaryState64 | State64Id): MutationMask64 {
  const a = typeof source === "string" ? source.slice(4) : source.binary;
  const b = typeof target === "string" ? target.slice(4) : target.binary;
  assertSixBitBinary(a);
  assertSixBitBinary(b);
  const mask = [...a].map((bit, index) => (bit === b[index] ? "0" : "1")).join("");
  return createMutationMask64FromBinary(mask);
}

export function xorMutationMasks64(left: MutationMask64, right: MutationMask64): MutationMask64 {
  const a = left.slice(4);
  const b = right.slice(4);
  assertSixBitBinary(a);
  assertSixBitBinary(b);
  const result = [...a].map((bit, index) => (bit === b[index] ? "0" : "1")).join("");
  return createMutationMask64FromBinary(result);
}

export function hammingDistance64(left: BinaryState64 | State64Id, right: BinaryState64 | State64Id): number {
  const a = typeof left === "string" ? left.slice(4) : left.binary;
  const b = typeof right === "string" ? right.slice(4) : right.binary;
  assertSixBitBinary(a);
  assertSixBitBinary(b);
  return [...a].reduce((distance, value, index) => distance + (value === b[index] ? 0 : 1), 0);
}

export function elementaryNeighbours(state: BinaryState64 | State64Id): readonly BinaryState64[] {
  const source = typeof state === "string" ? createBinaryState64(state.slice(4)) : state;
  return ([1, 2, 3, 4, 5, 6] as const).map((position) => applyMutationMask64(source, createMutationMask64([position])));
}
