import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(scriptDir, "..");
const repoRoot = resolve(runDir, "../../../../..");
const fixturePath = resolve(runDir, "../../fixtures/transitions.json");
const oracleDir = resolve(runDir, "semagraph-oracle");
const cliPath = resolve(runDir, "dist/transition-matrix-profiler.js");
const outputPath = resolve(runDir, "output.json");
const agentLogPath = resolve(runDir, "agent-log.json");
const oracleCliPath = resolve(repoRoot, "ai-tools/semagraph-kernel-tool/dist/cli.js");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? runDir,
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const startTimeIso = new Date().toISOString();
mkdirSync(oracleDir, { recursive: true });

const dataset = readJson(fixturePath);
const semagraphCalls = [];

for (const transition of dataset.transitions) {
  const args = {
    sourceStateId: transition.sourceStateId,
    targetStateId: transition.targetStateId
  };
  const argsPath = resolve(oracleDir, `${transition.id}.args.json`);
  const resultPath = resolve(oracleDir, `${transition.id}.result.json`);
  writeJson(argsPath, args);
  const stdout = run(process.execPath, [oracleCliPath, "semagraph_lookup_transition64", argsPath], { cwd: repoRoot });
  const result = JSON.parse(stdout);
  writeJson(resultPath, result);
  semagraphCalls.push({
    id: transition.id,
    status: result.status,
    observed: {
      sourceStateId: transition.sourceStateId,
      targetStateId: transition.targetStateId,
      mutationMask: result.result?.mutationMask,
      distance: result.result?.distance,
      changedPositions: result.result?.changedPositions,
      transitionIndex: result.result?.transitionIndex,
      inferenceUsed: result.result?.inferenceUsed
    }
  });
}

const profilerStdout = run(process.execPath, [cliPath, fixturePath], { cwd: runDir });
writeFileSync(outputPath, profilerStdout);
const output = JSON.parse(profilerStdout);
const byId = new Map(output.transitions.map((transition) => [transition.id, transition]));

for (const call of semagraphCalls) {
  const profiled = byId.get(call.id);
  assertEqual(profiled.mutationMask, call.observed.mutationMask, `${call.id} mutationMask`);
  assertEqual(profiled.distance, call.observed.distance, `${call.id} distance`);
  assertEqual(profiled.changedPositions, call.observed.changedPositions, `${call.id} changedPositions`);
  assertEqual(profiled.transitionIndex, call.observed.transitionIndex, `${call.id} transitionIndex`);
}

const acceptanceChecks = [
  {
    name: "fixture profiles generated",
    status: output.transitions.length === dataset.transitions.length ? "passed" : "failed",
    observed: `${output.transitions.length} transitions`
  },
  {
    name: "oracle transition fields match",
    status: "passed",
    observed: `${semagraphCalls.length} semagraph_lookup_transition64 calls`
  },
  {
    name: "summaries are non-empty",
    status: output.transitions.every((transition) => typeof transition.summary === "string" && transition.summary.length > 0) ? "passed" : "failed",
    observed: "all transition summaries checked"
  }
];

writeJson(agentLogPath, {
  startTimeIso,
  endTimeIso: new Date().toISOString(),
  loopCount: 1,
  reworkEvents: [],
  toolUseNotes: [
    "Used TypeScript SemaGraph oracle semagraph_lookup_transition64 for every fixture transition.",
    "Saved oracle args and results under semagraph-oracle/.",
    "Compared profiler mutationMask, distance, changedPositions and transitionIndex against oracle results."
  ],
  acceptanceChecks,
  semagraphRuntime: "ts",
  semagraphCalls,
  tokenUsage: "unavailable"
});

if (acceptanceChecks.some((check) => check.status !== "passed")) {
  throw new Error("one or more acceptance checks failed");
}

process.stdout.write(`smoke ok: ${output.transitions.length} transitions, ${semagraphCalls.length} oracle calls\n`);
