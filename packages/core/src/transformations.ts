import type { MovingLinePosition, State64, State64Id, Transformation } from "./types.js";
import { assertMovingLinePosition, flipLineValue, linesToBinaryString } from "./lines.js";
import { getState64ByBinary, getState64ById } from "./hexagrams.js";

export function transformLines(
  state: State64,
  movingLinePositions: readonly number[]
): State64["lines"] {
  const mutable = [...state.lines];

  for (const rawPosition of movingLinePositions) {
    assertMovingLinePosition(rawPosition);
    const index = rawPosition - 1;
    const current = mutable[index];
    if (!current) {
      throw new Error(`Missing line at position ${rawPosition}`);
    }
    mutable[index] = flipLineValue(current);
  }

  return mutable as unknown as State64["lines"];
}

export function transformState64(
  sourceStateId: State64Id,
  movingLinePositions: readonly MovingLinePosition[]
): Transformation {
  const source = getState64ById(sourceStateId);
  const targetLines = transformLines(source, movingLinePositions);
  const targetBinary = linesToBinaryString(targetLines);
  const target = getState64ByBinary(targetBinary);

  return {
    sourceStateId,
    movingLinePositions,
    targetStateId: target.id
  };
}
