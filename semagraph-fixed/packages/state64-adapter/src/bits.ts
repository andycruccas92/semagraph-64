import type { BinaryBitValue, BitPosition } from "./types.js";

export function assertBitValue(value: number): asserts value is BinaryBitValue {
  if (value !== 0 && value !== 1) {
    throw new Error(`Invalid bit value: ${value}. Expected 0 or 1.`);
  }
}

export function flipBitValue(value: BinaryBitValue): BinaryBitValue {
  return value === 1 ? 0 : 1;
}

export function assertBitPosition(position: number): asserts position is BitPosition {
  if (!Number.isInteger(position) || position < 1 || position > 6) {
    throw new Error(`Invalid bit position: ${position}. Expected integer 1..6.`);
  }
}

export function binaryStringToBits(binary: string): BinaryBitValue[] {
  if (!/^[01]+$/.test(binary)) {
    throw new Error(`Invalid binary string: ${binary}`);
  }

  return [...binary].map((char) => (char === "1" ? 1 : 0));
}

export function bitsToBinaryString(bits: readonly BinaryBitValue[]): string {
  return bits.join("");
}
