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
const invalidFixturePath = resolve(roundRoot, "fixtures/invalid-scenarios.json");
const fixture = readJson(fixturePath);
const strict = process.argv.includes("--strict");

const variants = [
  {
    name: "no-mcp",
    runDir: resolve(roundRoot, "runs/no-mcp"),
    cliCandidates: ["dist/policy-transition-workbench.js", "dist/cli.js"]
  },
  {
    name: "rust-mcp",
    runDir: resolve(roundRoot, "runs/rust-mcp"),
    cliCandidates: ["dist/policy-transition-workbench.js", "dist/cli.js"]
  },
  {
    name: "rust-mcp-upgraded",
    runDir: resolve(roundRoot, "runs/rust-mcp-upgraded"),
    cliCandidates: ["dist/policy-transition-workbench.js", "dist/cli.js"]
  }
];

const regimeOrder = [
  "no_change",
  "bit_adjustment",
  "module_reconfiguration",
  "cross_module_regime_shift",
  "near_total_inversion",
  "full_bit_reversal"
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function maybeReadJson(path) {
  if (!existsSync(path)) return undefined;
  return readJson(path);
}

function assertStateId(state) {
  if (!/^S64-[01]{6}$/.test(state)) throw new Error(`Invalid State64 id: ${state}`);
}

function bits(state) {
  assertStateId(state);
  return state.slice(4);
}

function stateNumber(state) {
  return Number.parseInt(bits(state), 2);
}

function maskBetween(source, target) {
  const left = bits(source);
  const right = bits(target);
  let mask = "";
  for (let index = 0; index < 6; index += 1) {
    mask += left[index] === right[index] ? "0" : "1";
  }
  return `M64-${mask}`;
}

function xorMasks(left, right) {
  const a = left.slice(4);
  const b = right.slice(4);
  let out = "";
  for (let index = 0; index < 6; index += 1) {
    out += a[index] === b[index] ? "0" : "1";
  }
  return `M64-${out}`;
}

function distance(mask) {
  return [...mask.slice(4)].filter((bit) => bit === "1").length;
}

function transitionRegime(source, target) {
  const mask = maskBetween(source, target);
  const total = distance(mask);
  const lowerDistance = distance(`M64-${mask.slice(4, 7)}000`);
  const upperDistance = distance(`M64-000${mask.slice(7, 10)}`);
  const moduleScope =
    lowerDistance === 0 && upperDistance === 0
      ? "none"
      : lowerDistance > 0 && upperDistance === 0
        ? "lower_only"
        : lowerDistance === 0 && upperDistance > 0
          ? "upper_only"
          : "both_modules";
  const regimeClass =
    total === 0
      ? "no_change"
      : total === 1
        ? "bit_adjustment"
        : total <= 2 && moduleScope !== "both_modules"
          ? "module_reconfiguration"
          : total === 6
            ? "full_bit_reversal"
            : total >= 4
              ? "near_total_inversion"
              : "cross_module_regime_shift";
  return { mask, distance: total, regimeClass };
}

function volatilityClass(cumulativeDistance) {
  if (cumulativeDistance <= 3) return "calm";
  if (cumulativeDistance <= 7) return "active";
  return "volatile";
}

function policyReadiness(volatility) {
  return volatility === "calm" ? "hold" : volatility === "active" ? "review" : "escalate";
}

function histogram(values) {
  const result = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function average(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function dominantRegime(transitions) {
  const counts = new Map();
  const distances = new Map();
  for (const transition of transitions) {
    counts.set(transition.regimeClass, (counts.get(transition.regimeClass) ?? 0) + 1);
    distances.set(transition.regimeClass, (distances.get(transition.regimeClass) ?? 0) + transition.distance);
  }
  return [...counts.keys()].sort((left, right) => {
    const countDelta = counts.get(right) - counts.get(left);
    if (countDelta !== 0) return countDelta;
    const distanceDelta = distances.get(right) - distances.get(left);
    if (distanceDelta !== 0) return distanceDelta;
    return left.localeCompare(right);
  })[0];
}

function expectedScenario(scenario) {
  if (!scenario.states || scenario.states.length < 2) throw new Error(`Scenario ${scenario.id} requires at least two states`);
  for (const state of scenario.states) assertStateId(state);

  const transitions = [];
  const orderedMutationMasks = [];
  let netMutationMask = "M64-000000";
  let cumulativeDistance = 0;
  for (let index = 0; index < scenario.states.length - 1; index += 1) {
    const transition = transitionRegime(scenario.states[index], scenario.states[index + 1]);
    transitions.push(transition);
    orderedMutationMasks.push(transition.mask);
    netMutationMask = xorMasks(netMutationMask, transition.mask);
    cumulativeDistance += transition.distance;
  }

  const sourceStateId = scenario.states[0];
  const targetStateId = scenario.states[scenario.states.length - 1];
  const netDistance = distance(netMutationMask);
  const volatility = volatilityClass(cumulativeDistance);
  const dominantRegimeClass = dominantRegime(transitions);
  const signature = `C64:${sourceStateId}>${targetStateId}|M:${orderedMutationMasks.join(".")}|N:${netMutationMask}`;

  return {
    id: scenario.id,
    sourceStateId,
    targetStateId,
    states: scenario.states,
    transitionCount: orderedMutationMasks.length,
    orderedMutationMasks,
    netMutationMask,
    cumulativeDistance,
    netDistance,
    dominantRegimeClass,
    volatilityClass: volatility,
    policyReadiness: policyReadiness(volatility),
    signature,
    summary: `${scenario.id}: ${sourceStateId} to ${targetStateId}; ${volatility}; cumulative distance ${cumulativeDistance}.`
  };
}

function priority(volatility) {
  return volatility === "calm" ? "low" : volatility === "active" ? "normal" : "high";
}

function expectedOutput() {
  const scenarios = fixture.scenarios.map(expectedScenario);
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const cumulativeDistances = scenarios.map((scenario) => scenario.cumulativeDistance);
  const maxCumulativeDistance = Math.max(...cumulativeDistances);
  const comparisons = fixture.comparePairs.map((pair) => {
    const left = byId.get(pair.left);
    const right = byId.get(pair.right);
    const leftMasks = new Set(left.orderedMutationMasks);
    const leftStates = new Set(left.states);
    return {
      left: pair.left,
      right: pair.right,
      sameNetMutationMask: left.netMutationMask === right.netMutationMask,
      sameDominantRegimeClass: left.dominantRegimeClass === right.dominantRegimeClass,
      sameVolatilityClass: left.volatilityClass === right.volatilityClass,
      cumulativeDistanceDelta: Math.abs(left.cumulativeDistance - right.cumulativeDistance),
      sharedOrderedMutationMaskCount: right.orderedMutationMasks.filter((mask) => leftMasks.has(mask)).length,
      sharedStateCount: right.states.filter((state) => leftStates.has(state)).length
    };
  });
  const policyQueue = scenarios
    .filter((scenario) => scenario.id !== "calm-zero")
    .map((scenario) => ({
      scenarioId: scenario.id,
      triggerSignature: scenario.signature,
      objective: fixture.scenarios.find((item) => item.id === scenario.id).objective,
      priority: priority(scenario.volatilityClass),
      allowedActions: ["monitor", "review", "escalate"],
      forbiddenActions: [
        "do not infer observations",
        "do not mutate State64 ids",
        "do not override deterministic signatures"
      ],
      reviewRequired: true
    }));

  return {
    scenarios,
    aggregate: {
      scenarioCount: scenarios.length,
      totalTransitions: scenarios.reduce((sum, scenario) => sum + scenario.transitionCount, 0),
      totalCumulativeDistance: scenarios.reduce((sum, scenario) => sum + scenario.cumulativeDistance, 0),
      averageCumulativeDistance: average(cumulativeDistances),
      maxCumulativeDistanceScenarioIds: scenarios
        .filter((scenario) => scenario.cumulativeDistance === maxCumulativeDistance)
        .map((scenario) => scenario.id),
      volatilityHistogram: histogram(scenarios.map((scenario) => scenario.volatilityClass)),
      dominantRegimeHistogram: histogram(scenarios.map((scenario) => scenario.dominantRegimeClass)),
      netMutationHistogram: histogram(scenarios.map((scenario) => scenario.netMutationMask))
    },
    comparisons,
    policyQueue
  };
}

function comparable(output) {
  if (!output || typeof output !== "object") return undefined;
  return {
    scenarios: output.scenarios,
    aggregate: output.aggregate,
    comparisons: output.comparisons,
    policyQueue: output.policyQueue
  };
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!deepEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function qualityScore(output, expected) {
  const actual = comparable(output);
  const checks = [
    { name: "scenarios", passed: deepEqual(actual?.scenarios, expected.scenarios) },
    { name: "aggregate", passed: deepEqual(actual?.aggregate, expected.aggregate) },
    { name: "comparisons", passed: deepEqual(actual?.comparisons, expected.comparisons) },
    { name: "policyQueue", passed: deepEqual(actual?.policyQueue, expected.policyQueue) },
    {
      name: "summaries",
      passed:
        Array.isArray(output?.scenarios) &&
        output.scenarios.every((scenario) => typeof scenario.summary === "string" && scenario.summary.length > 0)
    }
  ];
  const passed = checks.filter((check) => check.passed).length;
  return { passed, total: checks.length, score: Number((passed / checks.length).toFixed(3)), checks };
}

function findCli(variant) {
  for (const candidate of variant.cliCandidates) {
    const absolute = resolve(variant.runDir, candidate);
    if (existsSync(absolute)) return absolute;
  }
  return resolve(variant.runDir, variant.cliCandidates[0]);
}

function buildAndRun(variant) {
  if (!existsSync(variant.runDir)) return { output: undefined, runError: "run directory does not exist" };
  try {
    execFileSync(process.execPath, [resolve(repoRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], {
      cwd: variant.runDir,
      stdio: "pipe"
    });
    const stdout = execFileSync(process.execPath, [findCli(variant), fixturePath], {
      cwd: variant.runDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const output = JSON.parse(stdout);
    writeFileSync(resolve(variant.runDir, "output.json"), `${JSON.stringify(output, null, 2)}\n`);
    return { output, runError: undefined };
  } catch (error) {
    return { output: undefined, runError: error instanceof Error ? error.message : String(error) };
  }
}

function invalidInputCheck(variant) {
  if (!existsSync(variant.runDir)) return { attempted: false, passed: false, error: "run directory does not exist" };
  try {
    execFileSync(process.execPath, [findCli(variant), invalidFixturePath], {
      cwd: variant.runDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { attempted: true, passed: false, error: "invalid input was accepted" };
  } catch (error) {
    return { attempted: true, passed: true, error: undefined };
  }
}

function durationMs(log) {
  if (!log?.startTimeIso || !log?.endTimeIso) return undefined;
  const start = Date.parse(log.startTimeIso);
  const end = Date.parse(log.endTimeIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.max(0, end - start);
}

function evaluateVariant(variant, expected) {
  const log = maybeReadJson(resolve(variant.runDir, "agent-log.json"));
  const run = buildAndRun(variant);
  const output = run.output ?? maybeReadJson(resolve(variant.runDir, "output.json"));
  const quality = qualityScore(output, expected);
  const invalidInput = invalidInputCheck(variant);
  const dur = durationMs(log);
  return {
    variant: variant.name,
    delivered: existsSync(variant.runDir),
    hasAgentLog: Boolean(log),
    hasOutput: Boolean(output),
    runError: run.runError,
    correct: quality.score === 1 && invalidInput.passed,
    quality,
    invalidInput,
    durationMs: dur,
    durationSeconds: dur === undefined ? undefined : Number((dur / 1000).toFixed(3)),
    loopCount: log?.loopCount,
    reworkEventCount: Array.isArray(log?.reworkEvents) ? log.reworkEvents.length : undefined,
    reworkEvents: log?.reworkEvents,
    semagraphRuntime: log?.semagraphRuntime ?? "none",
    semagraphCallCount: Array.isArray(log?.semagraphCalls) ? log.semagraphCalls.length : 0,
    semagraphCalls: log?.semagraphCalls,
    tokenUsage: log?.tokenUsage ?? "unavailable",
    tokenUsageAvailable: typeof log?.tokenUsage === "object",
    acceptanceChecks: log?.acceptanceChecks
  };
}

mkdirSync(reportsDir, { recursive: true });
const expected = expectedOutput();
writeFileSync(resolve(roundRoot, "fixtures/expected-output.json"), `${JSON.stringify(expected, null, 2)}\n`);

const results = variants.map((variant) => evaluateVariant(variant, expected));
const report = {
  benchmark: "round-5-complex-feature-rework",
  generatedAt: new Date().toISOString(),
  fixture: "fixtures/scenarios.json",
  invalidFixture: "fixtures/invalid-scenarios.json",
  strict,
  results
};

writeFileSync(resolve(reportsDir, "latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(strict && results.some((result) => !result.correct) ? 1 : 0);
