#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const roundRoot = resolve(here, "..");
const repoRoot = resolve(roundRoot, "../../..");
const reportsDir = resolve(roundRoot, "reports");
const fixturePath = resolve(roundRoot, "fixtures/scenarios.json");
const fixture = readJson(fixturePath);
const strict = process.argv.includes("--strict");

const variants = [
  {
    name: "baseline",
    runDir: resolve(roundRoot, "runs/baseline"),
    cliCandidates: ["dist/transition-workbench.js", "dist/cli.js"]
  },
  {
    name: "semagraph",
    runDir: resolve(roundRoot, "runs/semagraph"),
    cliCandidates: ["dist/transition-workbench.js", "dist/cli.js"]
  }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function maybeReadJson(path) {
  if (!existsSync(path)) return undefined;
  return readJson(path);
}

function stateBits(state) {
  return state.slice(4);
}

function maskBetween(source, target) {
  const a = stateBits(source);
  const b = stateBits(target);
  let mask = "";
  for (let index = 0; index < 6; index += 1) {
    mask += a[index] === b[index] ? "0" : "1";
  }
  return `M64-${mask}`;
}

function distance(mask) {
  return [...mask.slice(4)].filter((bit) => bit === "1").length;
}

function volatilityClass(cumulativeDistance) {
  if (cumulativeDistance <= 3) return "calm";
  if (cumulativeDistance <= 7) return "active";
  return "volatile";
}

function expectedScenario(scenario) {
  const changedMasks = [];
  let cumulativeDistance = 0;
  for (let index = 0; index < scenario.states.length - 1; index += 1) {
    const mask = maskBetween(scenario.states[index], scenario.states[index + 1]);
    changedMasks.push(mask);
    cumulativeDistance += distance(mask);
  }
  const sourceStateId = scenario.states[0];
  const targetStateId = scenario.states[scenario.states.length - 1];
  const netMutationMask = maskBetween(sourceStateId, targetStateId);
  return {
    id: scenario.id,
    sourceStateId,
    targetStateId,
    states: scenario.states,
    transitionCount: changedMasks.length,
    changedMasks,
    netMutationMask,
    cumulativeDistance,
    netDistance: distance(netMutationMask),
    volatilityClass: volatilityClass(cumulativeDistance)
  };
}

function expectedOutput() {
  const scenarios = fixture.scenarios.map(expectedScenario);
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const histogram = {};
  for (const scenario of scenarios) {
    histogram[scenario.netMutationMask] = (histogram[scenario.netMutationMask] ?? 0) + 1;
  }
  const maxScenario = scenarios.reduce((best, scenario) =>
    scenario.cumulativeDistance > best.cumulativeDistance ? scenario : best
  );
  const comparisons = fixture.comparePairs.map((pair) => {
    const left = byId.get(pair.left);
    const right = byId.get(pair.right);
    const leftMasks = new Set(left.changedMasks);
    const rightMasks = new Set(right.changedMasks);
    let sharedChangedMaskCount = 0;
    for (const mask of leftMasks) {
      if (rightMasks.has(mask)) sharedChangedMaskCount += 1;
    }
    return {
      left: pair.left,
      right: pair.right,
      sameNetMutationMask: left.netMutationMask === right.netMutationMask,
      cumulativeDistanceDelta: Math.abs(left.cumulativeDistance - right.cumulativeDistance),
      sharedChangedMaskCount
    };
  });

  return {
    scenarios,
    aggregate: {
      scenarioCount: scenarios.length,
      totalTransitions: scenarios.reduce((sum, scenario) => sum + scenario.transitionCount, 0),
      totalCumulativeDistance: scenarios.reduce((sum, scenario) => sum + scenario.cumulativeDistance, 0),
      maxCumulativeDistanceScenarioId: maxScenario.id,
      netMutationHistogram: histogram
    },
    comparisons
  };
}

function comparable(output) {
  if (!output || typeof output !== "object") return undefined;
  return {
    scenarios: Array.isArray(output.scenarios)
      ? output.scenarios.map((scenario) => ({
          id: scenario.id,
          sourceStateId: scenario.sourceStateId,
          targetStateId: scenario.targetStateId,
          states: scenario.states,
          transitionCount: scenario.transitionCount,
          changedMasks: scenario.changedMasks,
          netMutationMask: scenario.netMutationMask,
          cumulativeDistance: scenario.cumulativeDistance,
          netDistance: scenario.netDistance,
          volatilityClass: scenario.volatilityClass
        }))
      : undefined,
    aggregate: output.aggregate,
    comparisons: output.comparisons
  };
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!deepEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function qualityScore(output, expected) {
  const actual = comparable(output);
  const checks = [
    {
      name: "scenarios",
      passed: deepEqual(actual?.scenarios, expected.scenarios)
    },
    {
      name: "aggregate",
      passed: deepEqual(actual?.aggregate, expected.aggregate)
    },
    {
      name: "comparisons",
      passed: deepEqual(actual?.comparisons, expected.comparisons)
    },
    {
      name: "scenarioSummaries",
      passed:
        Array.isArray(output?.scenarios) &&
        output.scenarios.every((scenario) => typeof scenario.summary === "string" && scenario.summary.length > 0)
    }
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    passed,
    total: checks.length,
    score: Number((passed / checks.length).toFixed(3)),
    checks
  };
}

function durationMs(log) {
  if (!log?.startTimeIso || !log?.endTimeIso) return undefined;
  const start = Date.parse(log.startTimeIso);
  const end = Date.parse(log.endTimeIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.max(0, end - start);
}

function countRework(log) {
  if (!Array.isArray(log?.reworkEvents)) return undefined;
  return log.reworkEvents.length;
}

function findCli(variant) {
  for (const candidate of variant.cliCandidates) {
    const absolute = resolve(variant.runDir, candidate);
    if (existsSync(absolute)) return absolute;
  }
  return resolve(variant.runDir, variant.cliCandidates[0]);
}

function buildAndRun(variant) {
  if (!existsSync(variant.runDir)) {
    return { output: undefined, runError: "run directory does not exist" };
  }
  try {
    execFileSync(process.execPath, [resolve(repoRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], {
      cwd: variant.runDir,
      stdio: "pipe"
    });
    const stdout = execFileSync(process.execPath, [findCli(variant), fixturePath], {
      cwd: variant.runDir,
      encoding: "utf8"
    });
    const output = JSON.parse(stdout);
    writeFileSync(resolve(variant.runDir, "output.json"), `${JSON.stringify(output, null, 2)}\n`);
    return { output, runError: undefined };
  } catch (error) {
    return {
      output: undefined,
      runError: error instanceof Error ? error.message : String(error)
    };
  }
}

function evaluateVariant(variant, expected) {
  const log = maybeReadJson(resolve(variant.runDir, "agent-log.json"));
  const run = buildAndRun(variant);
  const output = run.output ?? maybeReadJson(resolve(variant.runDir, "output.json"));
  const quality = qualityScore(output, expected);
  const dur = durationMs(log);
  return {
    variant: variant.name,
    delivered: existsSync(variant.runDir),
    hasAgentLog: Boolean(log),
    hasOutput: Boolean(output),
    runError: run.runError,
    correct: quality.score === 1,
    quality,
    durationMs: dur,
    durationSeconds: dur === undefined ? undefined : Number((dur / 1000).toFixed(3)),
    loopCount: log?.loopCount,
    reworkEventCount: countRework(log),
    reworkEvents: log?.reworkEvents,
    semagraphCallCount: Array.isArray(log?.semagraphCalls) ? log.semagraphCalls.length : 0,
    semagraphCalls: log?.semagraphCalls,
    tokenUsage: log?.tokenUsage ?? "unavailable",
    tokenUsageAvailable: typeof log?.tokenUsage === "object",
    acceptanceChecks: log?.acceptanceChecks
  };
}

const expected = expectedOutput();
mkdirSync(reportsDir, { recursive: true });
writeFileSync(resolve(roundRoot, "fixtures/expected-output.json"), `${JSON.stringify(expected, null, 2)}\n`);

const results = variants.map((variant) => evaluateVariant(variant, expected));
const report = {
  benchmark: "agentic-loop-benchmark-round-2",
  generatedAt: new Date().toISOString(),
  fixture: "fixtures/scenarios.json",
  strict,
  results
};

writeFileSync(resolve(reportsDir, "latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

process.exit(strict && results.some((result) => !result.correct) ? 1 : 0);
