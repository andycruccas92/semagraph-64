#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repoRoot = resolve(root, "../..");
const expected = readJson(resolve(root, "fixtures/expected-output.json"));
const fixturePath = resolve(root, "fixtures/sample-chain.json");
const variants = [
  {
    name: "baseline",
    runDir: resolve(root, "runs/baseline"),
    cliPath: resolve(root, "runs/baseline/dist/transition-audit.js")
  },
  {
    name: "semagraph",
    runDir: resolve(root, "runs/semagraph/transition-audit"),
    cliPath: resolve(root, "runs/semagraph/transition-audit/dist/cli.js"),
    reportDir: resolve(root, "runs/semagraph")
  }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function maybeReadJson(path) {
  if (!existsSync(path)) return undefined;
  return readJson(path);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickComparable(output) {
  if (!output || typeof output !== "object") return undefined;
  return {
    sourceStateId: output.sourceStateId,
    targetStateId: output.targetStateId,
    states: output.states,
    transitionCount: output.transitionCount,
    changedMasks: output.changedMasks,
    netMutationMask: output.netMutationMask,
    cumulativeDistance: output.cumulativeDistance
  };
}

function durationMs(log) {
  if (!log?.startTimeIso || !log?.endTimeIso) return undefined;
  const start = Date.parse(log.startTimeIso);
  const end = Date.parse(log.endTimeIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.max(0, end - start);
}

function runVariant(variant) {
  if (!existsSync(variant.runDir)) {
    return { output: undefined, runError: "run directory does not exist" };
  }

  try {
    execFileSync(process.execPath, [resolve(repoRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], {
      cwd: variant.runDir,
      stdio: "pipe"
    });
    const stdout = execFileSync(process.execPath, [variant.cliPath, fixturePath], {
      cwd: variant.runDir,
      encoding: "utf8"
    });
    const output = JSON.parse(stdout);
    writeFileSync(resolve(variant.reportDir ?? variant.runDir, "output.json"), `${JSON.stringify(output, null, 2)}\n`);
    return { output, runError: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: undefined, runError: message };
  }
}

function evaluateVariant(variant) {
  const runDir = variant.runDir;
  const log = maybeReadJson(resolve(runDir, "agent-log.json"));
  const executed = runVariant(variant);
  const output = executed.output ?? maybeReadJson(resolve(variant.reportDir ?? runDir, "output.json"));
  const comparable = pickComparable(output);
  const correct = sameJson(comparable, expected);
  const dur = durationMs(log);

  return {
    variant: variant.name,
    delivered: existsSync(runDir),
    hasAgentLog: Boolean(log),
    hasOutput: Boolean(output),
    runError: executed.runError,
    correct,
    durationMs: dur,
    durationSeconds: dur === undefined ? undefined : Number((dur / 1000).toFixed(3)),
    loopCount: log?.loopCount,
    reworkEvents: log?.reworkEvents,
    tokenUsage: log?.tokenUsage,
    semagraphCalls: log?.semagraphCalls,
    toolUseNotes: log?.toolUseNotes,
    acceptanceChecks: log?.acceptanceChecks
  };
}

const results = variants.map(evaluateVariant);
const report = {
  benchmark: "agentic-loop-benchmark",
  generatedAt: new Date().toISOString(),
  expectedFixture: "fixtures/sample-chain.json",
  results
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

const failures = results.filter((result) => !result.delivered || !result.hasAgentLog || !result.hasOutput || !result.correct);
process.exit(failures.length === 0 ? 0 : 1);
