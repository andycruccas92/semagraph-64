#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(__dirname, "..");
const repoRoot = resolve(runDir, "../../../../..");
const fixturePath = join(
  repoRoot,
  "experiments",
  "agentic-loop-benchmark",
  "round-3",
  "fixtures",
  "transitions.json",
);
const cliPath = join(runDir, "dist", "transition-matrix-profiler.js");
const oracleDir = join(runDir, "semagraph-oracle");
const oracleExe = process.env.SEMAGRAPH_RS_BIN ?? join(runDir, "runtime", "semagraph.exe");
const oracleSource = process.env.SEMAGRAPH_RS_BIN ? "SEMAGRAPH_RS_BIN" : "round-3/runs/semagraph-rs/runtime/semagraph.exe";

mkdirSync(oracleDir, { recursive: true });

const startTimeIso = new Date().toISOString();
const dataset = JSON.parse(readFileSync(fixturePath, "utf8"));
const cliRun = spawnSync(process.execPath, [cliPath, fixturePath], {
  encoding: "utf8",
});

if (cliRun.status !== 0) {
  throw new Error(`CLI failed: ${cliRun.stderr || cliRun.stdout}`);
}

const output = JSON.parse(cliRun.stdout);
writeFileSync(join(runDir, "output.json"), `${JSON.stringify(output, null, 2)}\n`);

const transitionsById = new Map(output.transitions.map((transition) => [transition.id, transition]));
const semagraphCalls = [];

for (const transition of dataset.transitions) {
  const sourceNumber = stateNumber(transition.sourceStateId);
  const targetNumber = stateNumber(transition.targetStateId);
  const args = ["classify", String(sourceNumber), String(targetNumber), "--json"];
  const argsRecord = {
    transitionId: transition.id,
    sourceStateId: transition.sourceStateId,
    targetStateId: transition.targetStateId,
    sourceNumber,
    targetNumber,
    executable: oracleSource,
    args,
  };
  writeFileSync(
    join(oracleDir, `${transition.id}-args.json`),
    `${JSON.stringify(argsRecord, null, 2)}\n`,
  );

  const oracleRun = spawnSync(oracleExe, args, { encoding: "utf8" });
  const resultRecord = {
    transitionId: transition.id,
    status: oracleRun.status === 0 ? "ok" : "error",
    exitCode: oracleRun.status,
    stdout: oracleRun.stdout.trim(),
    stderr: oracleRun.stderr.trim(),
    parsed: parseJsonOrNull(oracleRun.stdout),
  };
  writeFileSync(
    join(oracleDir, `${transition.id}-result.json`),
    `${JSON.stringify(resultRecord, null, 2)}\n`,
  );

  if (oracleRun.status !== 0 || !resultRecord.parsed) {
    throw new Error(`Oracle failed for ${transition.id}: ${oracleRun.stderr || oracleRun.stdout}`);
  }

  const profiled = transitionsById.get(transition.id);
  if (!profiled) {
    throw new Error(`Missing profiled transition ${transition.id}`);
  }

  const observed = {
    source: resultRecord.parsed.source,
    target: resultRecord.parsed.target,
    mutationMaskNumber: resultRecord.parsed.mutation_mask,
    mutationMask: numberMaskToId(resultRecord.parsed.mutation_mask),
    distance: resultRecord.parsed.distance,
    lowerDistance: resultRecord.parsed.lower_distance,
    upperDistance: resultRecord.parsed.upper_distance,
    moduleScope: resultRecord.parsed.module_scope,
    regimeClass: resultRecord.parsed.regime_class,
    transitionIndex: resultRecord.parsed.index,
  };

  assertEqual(profiled.mutationMask, observed.mutationMask, `${transition.id} mutationMask`);
  assertEqual(profiled.distance, observed.distance, `${transition.id} distance`);
  assertEqual(profiled.lowerDistance, observed.lowerDistance, `${transition.id} lowerDistance`);
  assertEqual(profiled.upperDistance, observed.upperDistance, `${transition.id} upperDistance`);
  assertEqual(profiled.moduleScope, observed.moduleScope, `${transition.id} moduleScope`);
  assertEqual(profiled.regimeClass, observed.regimeClass, `${transition.id} regimeClass`);
  assertEqual(profiled.transitionIndex, observed.transitionIndex, `${transition.id} transitionIndex`);

  semagraphCalls.push({
    transitionId: transition.id,
    status: "ok",
    observed,
  });
}

const acceptanceChecks = [
  "TypeScript CLI executed against shared transitions fixture.",
  "Rust SemaGraph classify oracle called once per fixture transition.",
  "Direct transition fields matched oracle mutation mask, distances, module scope, regime class, and index.",
  "output.json written from CLI stdout.",
];

const agentLog = {
  startTimeIso,
  endTimeIso: new Date().toISOString(),
  loopCount: 1,
  reworkEvents: [],
  toolUseNotes: [
    "Used deterministic TypeScript implementation for profiler output.",
    "Used semagraph.exe classify <sourceNumber> <targetNumber> --json as RS oracle for every fixture transition.",
    "Saved per-transition oracle args/results in semagraph-oracle/.",
  ],
  acceptanceChecks,
  semagraphRuntime: "rs",
  semagraphCalls,
  tokenUsage: "unavailable",
};

writeFileSync(join(runDir, "agent-log.json"), `${JSON.stringify(agentLog, null, 2)}\n`);
process.stdout.write(`${acceptanceChecks.join("\n")}\n`);

function stateNumber(stateId) {
  return Number.parseInt(stateId.slice("S64-".length), 2);
}

function numberMaskToId(mask) {
  return `M64-${Number(mask).toString(2).padStart(6, "0")}`;
}

function parseJsonOrNull(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}
