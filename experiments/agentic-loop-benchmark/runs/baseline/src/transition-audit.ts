#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STATE64_PATTERN = /^S64-[01]{6}$/;

type State64Id = `S64-${string}`;
type Mask64Id = `M64-${string}`;

interface TransitionAudit {
  sourceStateId: State64Id;
  targetStateId: State64Id;
  states: State64Id[];
  transitionCount: number;
  changedMasks: Mask64Id[];
  netMutationMask: Mask64Id;
  cumulativeDistance: number;
  summary: string;
}

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}

function parseStateList(filePath: string): State64Id[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Unable to read or parse JSON file: ${detail}`);
  }

  if (!Array.isArray(parsed)) {
    fail("Input JSON must be an ordered array of State64 ids.");
  }

  if (parsed.length === 0) {
    fail("Input array must contain at least one State64 id.");
  }

  return parsed.map((value, index) => {
    if (typeof value !== "string" || !STATE64_PATTERN.test(value)) {
      fail(`Invalid State64 id at index ${index}: expected S64-[01]{6}.`);
    }

    return value as State64Id;
  });
}

function stateBits(stateId: State64Id): string {
  return stateId.slice("S64-".length);
}

function mutationMask(fromStateId: State64Id, toStateId: State64Id): Mask64Id {
  const fromBits = stateBits(fromStateId);
  const toBits = stateBits(toStateId);
  let mask = "";

  for (let index = 0; index < 6; index += 1) {
    mask += fromBits[index] === toBits[index] ? "0" : "1";
  }

  return `M64-${mask}` as Mask64Id;
}

function hammingDistance(mask: Mask64Id): number {
  let distance = 0;

  for (const bit of mask.slice("M64-".length)) {
    if (bit === "1") {
      distance += 1;
    }
  }

  return distance;
}

function auditTransitions(states: State64Id[]): TransitionAudit {
  const changedMasks: Mask64Id[] = [];
  let cumulativeDistance = 0;

  for (let index = 0; index < states.length - 1; index += 1) {
    const mask = mutationMask(states[index]!, states[index + 1]!);
    changedMasks.push(mask);
    cumulativeDistance += hammingDistance(mask);
  }

  const sourceStateId = states[0]!;
  const targetStateId = states[states.length - 1]!;
  const netMutationMask = mutationMask(sourceStateId, targetStateId);
  const transitionCount = Math.max(states.length - 1, 0);

  return {
    sourceStateId,
    targetStateId,
    states,
    transitionCount,
    changedMasks,
    netMutationMask,
    cumulativeDistance,
    summary:
      `${transitionCount} transition${transitionCount === 1 ? "" : "s"} from ` +
      `${sourceStateId} to ${targetStateId}; net mutation ${netMutationMask}; ` +
      `cumulative distance ${cumulativeDistance}.`
  };
}

function main(): void {
  const inputPath = process.argv[2];

  if (!inputPath) {
    fail("Usage: transition-audit <states.json>");
  }

  const states = parseStateList(resolve(inputPath));
  const audit = auditTransitions(states);
  console.log(JSON.stringify(audit, null, 2));
}

main();
