#!/usr/bin/env node
import { readFileSync } from "node:fs";

const STATE64_PATTERN = /^S64-[01]{6}$/;

type State64Id = `S64-${string}`;
type MutationMask64 = `M64-${string}`;

type TransitionAudit = {
  sourceStateId: State64Id;
  targetStateId: State64Id;
  states: readonly State64Id[];
  transitionCount: number;
  changedMasks: readonly MutationMask64[];
  netMutationMask: MutationMask64;
  cumulativeDistance: number;
  summary: string;
};

function usage(): string {
  return "Usage: transition-audit <states.json>";
}

function assertState64Id(value: unknown, index: number): asserts value is State64Id {
  if (typeof value !== "string" || !STATE64_PATTERN.test(value)) {
    throw new Error(`states[${index}] must match S64-[01]{6}`);
  }
}

function parseStates(filePath: string): State64Id[] {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Input JSON must be an ordered array of State64 ids.");
  }
  if (parsed.length < 2) {
    throw new Error("At least two State64 ids are required.");
  }
  parsed.forEach(assertState64Id);
  return parsed;
}

function stateBits(state: State64Id): string {
  return state.slice(4);
}

function maskBetween(source: State64Id, target: State64Id): MutationMask64 {
  const sourceBits = stateBits(source);
  const targetBits = stateBits(target);
  let mask = "";
  for (let index = 0; index < 6; index += 1) {
    mask += sourceBits[index] === targetBits[index] ? "0" : "1";
  }
  return `M64-${mask}`;
}

function distanceFromMask(mask: MutationMask64): number {
  return [...mask.slice(4)].filter((bit) => bit === "1").length;
}

function xorMasks(masks: readonly MutationMask64[]): MutationMask64 {
  const bits = [0, 0, 0, 0, 0, 0];
  for (const mask of masks) {
    [...mask.slice(4)].forEach((bit, index) => {
      if (bit === "1") bits[index] ^= 1;
    });
  }
  return `M64-${bits.join("")}`;
}

export function auditTransitions(states: readonly State64Id[]): TransitionAudit {
  if (states.length < 2) {
    throw new Error("At least two State64 ids are required.");
  }

  const changedMasks = states.slice(0, -1).map((state, index) => maskBetween(state, states[index + 1]));
  const cumulativeDistance = changedMasks.reduce((sum, mask) => sum + distanceFromMask(mask), 0);
  const sourceStateId = states[0];
  const targetStateId = states[states.length - 1];
  const transitionCount = changedMasks.length;
  const netMutationMask = xorMasks(changedMasks);

  return {
    sourceStateId,
    targetStateId,
    states,
    transitionCount,
    changedMasks,
    netMutationMask,
    cumulativeDistance,
    summary: `${transitionCount} deterministic State64 transition${transitionCount === 1 ? "" : "s"} from ${sourceStateId} to ${targetStateId}; net mutation ${netMutationMask}; cumulative distance ${cumulativeDistance}.`
  };
}

function main(): void {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    console.error(usage());
    process.exit(2);
  }

  try {
    const states = parseStates(filePath);
    process.stdout.write(`${JSON.stringify(auditTransitions(states), null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
