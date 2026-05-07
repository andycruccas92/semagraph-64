import type { BinaryLineValue, LineValue, MovingLinePosition } from "./types.js";

export function binaryToLineValue(value: BinaryLineValue): LineValue {
  return value === 1 ? "yang" : "yin";
}

export function lineValueToBinary(value: LineValue): BinaryLineValue {
  return value === "yang" ? 1 : 0;
}

export function flipLineValue(value: LineValue): LineValue {
  return value === "yang" ? "yin" : "yang";
}

export function assertMovingLinePosition(position: number): asserts position is MovingLinePosition {
  if (!Number.isInteger(position) || position < 1 || position > 6) {
    throw new Error(`Invalid moving line position: ${position}. Expected integer 1..6.`);
  }
}

export function binaryStringToLines<const T extends string>(binary: T): LineValue[] {
  if (!/^[01]+$/.test(binary)) {
    throw new Error(`Invalid binary line string: ${binary}`);
  }

  return [...binary].map((char) => binaryToLineValue(char === "1" ? 1 : 0));
}

export function linesToBinaryString(lines: readonly LineValue[]): string {
  return lines.map(lineValueToBinary).join("");
}
