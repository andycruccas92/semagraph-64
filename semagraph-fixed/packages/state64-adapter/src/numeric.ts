import type { BinaryState64, MutationMask64, State64Id } from "./types.js";
import { createBinaryState64, createMutationMask64FromBinary } from "./hypercube.js";

function assertState64Number(value: number): asserts value is number {
  if (!Number.isInteger(value) || value < 0 || value > 63) {
    throw new Error(`Expected an integer in the State64 range 0..63, received: ${value}`);
  }
}

function toSixBitBinary(value: number): string {
  assertState64Number(value);
  return value.toString(2).padStart(6, "0");
}

export function state64NumberToBinary(value: number): string {
  return toSixBitBinary(value);
}

export function binaryToState64Number(binary: string): number {
  if (!/^[01]{6}$/.test(binary)) throw new Error(`Expected a six-bit binary code, received: ${binary}`);
  return Number.parseInt(binary, 2);
}

export function state64IdToNumber(stateId: State64Id): number {
  return binaryToState64Number(stateId.slice(4));
}

export function mutationMask64ToNumber(mask: MutationMask64): number {
  return binaryToState64Number(mask.slice(4));
}

export function state64NumberToId(value: number): State64Id {
  return `S64-${toSixBitBinary(value)}` as State64Id;
}

export function mutationMask64NumberToId(value: number): MutationMask64 {
  return `M64-${toSixBitBinary(value)}` as MutationMask64;
}

export function createState64FromNumber(value: number): BinaryState64 {
  return createBinaryState64(toSixBitBinary(value));
}

export function createMutationMask64FromNumber(value: number): MutationMask64 {
  return createMutationMask64FromBinary(toSixBitBinary(value));
}

export function transitionIndex64Number(source: number, target: number): number {
  assertState64Number(source);
  assertState64Number(target);
  return source * 64 + target;
}
