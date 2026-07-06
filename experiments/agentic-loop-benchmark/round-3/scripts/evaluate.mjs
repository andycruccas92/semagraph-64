#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const roundRoot = resolve(here, "..");
const repoRoot = resolve(roundRoot, "../../..");
const reportsDir = resolve(roundRoot, "reports");
const fixturePath = resolve(roundRoot, "fixtures/transitions.json");
const fixture = readJson(fixturePath);
const strict = process.argv.includes("--strict");
const oracleRepeats = Number.parseInt(process.env.ROUND3_ORACLE_REPEATS ?? "3", 10);

const variants = [
  {
    name: "baseline",
    runDir: resolve(roundRoot, "runs/baseline"),
    cliCandidates: ["dist/transition-matrix-profiler.js", "dist/cli.js"]
  },
  {
    name: "semagraph-ts",
    runDir: resolve(roundRoot, "runs/semagraph-ts"),
    cliCandidates: ["dist/transition-matrix-profiler.js", "dist/cli.js"]
  },
  {
    name: "semagraph-rs",
    runDir: resolve(roundRoot, "runs/semagraph-rs"),
    cliCandidates: ["dist/transition-matrix-profiler.js", "dist/cli.js"]
  }
];

const regimeClassCodes = {
  no_change: 0,
  bit_adjustment: 1,
  module_reconfiguration: 2,
  cross_module_regime_shift: 3,
  near_total_inversion: 4,
  full_bit_reversal: 5
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function maybeReadJson(path) {
  if (!existsSync(path)) return undefined;
  return readJson(path);
}

function stateBits(state) {
  if (!/^S64-[01]{6}$/.test(state)) throw new Error(`Invalid State64 id: ${state}`);
  return state.slice(4);
}

function stateNumber(state) {
  return Number.parseInt(stateBits(state), 2);
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

function changedPositions(mask) {
  return [...mask.slice(4)].flatMap((bit, index) => (bit === "1" ? [index + 1] : []));
}

function distance(mask) {
  return changedPositions(mask).length;
}

function lowerDistance(mask) {
  return changedPositions(`M64-${mask.slice(4, 7)}000`).length;
}

function upperDistance(mask) {
  return changedPositions(`M64-000${mask.slice(7, 10)}`).length;
}

function moduleScope(lower, upper) {
  if (lower === 0 && upper === 0) return "none";
  if (lower > 0 && upper === 0) return "lower_only";
  if (lower === 0 && upper > 0) return "upper_only";
  return "both_modules";
}

function regimeClass(totalDistance, scope) {
  if (totalDistance === 0) return "no_change";
  if (totalDistance === 1) return "bit_adjustment";
  if (totalDistance <= 2 && scope !== "both_modules") return "module_reconfiguration";
  if (totalDistance === 6) return "full_bit_reversal";
  if (totalDistance >= 4) return "near_total_inversion";
  return "cross_module_regime_shift";
}

function transitionExpected(transition) {
  const mutationMask = maskBetween(transition.sourceStateId, transition.targetStateId);
  const lower = lowerDistance(mutationMask);
  const upper = upperDistance(mutationMask);
  const scope = moduleScope(lower, upper);
  const totalDistance = distance(mutationMask);
  const klass = regimeClass(totalDistance, scope);
  return {
    id: transition.id,
    sourceStateId: transition.sourceStateId,
    targetStateId: transition.targetStateId,
    groupId: transition.groupId,
    mutationMask,
    changedPositions: changedPositions(mutationMask),
    distance: totalDistance,
    lowerDistance: lower,
    upperDistance: upper,
    moduleScope: scope,
    regimeClass: klass,
    transitionIndex: stateNumber(transition.sourceStateId) * 64 + stateNumber(transition.targetStateId)
  };
}

function round3(value) {
  return Number(value.toFixed(3));
}

function histogram(values) {
  const result = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function groupExpected(group, byId) {
  const transitions = group.transitionIds.map((id) => byId.get(id));
  const distances = transitions.map((transition) => transition.distance);
  const maxDistance = Math.max(...distances);
  return {
    id: group.id,
    transitionCount: transitions.length,
    totalDistance: distances.reduce((sum, value) => sum + value, 0),
    averageDistance: round3(distances.reduce((sum, value) => sum + value, 0) / transitions.length),
    maxDistance,
    maxDistanceTransitionIds: transitions.filter((transition) => transition.distance === maxDistance).map((transition) => transition.id),
    regimeHistogram: histogram(transitions.map((transition) => transition.regimeClass)),
    moduleScopeHistogram: histogram(transitions.map((transition) => transition.moduleScope))
  };
}

function expectedOutput() {
  const transitions = fixture.transitions.map(transitionExpected);
  const byId = new Map(transitions.map((transition) => [transition.id, transition]));
  const groups = fixture.groups.map((group) => groupExpected(group, byId));
  const distances = transitions.map((transition) => transition.distance);
  const maxDistance = Math.max(...distances);
  const comparisons = fixture.comparePairs.map((pair) => {
    const left = byId.get(pair.left);
    const right = byId.get(pair.right);
    const leftPositions = new Set(left.changedPositions);
    let sharedChangedPositionCount = 0;
    for (const position of right.changedPositions) {
      if (leftPositions.has(position)) sharedChangedPositionCount += 1;
    }
    return {
      left: pair.left,
      right: pair.right,
      sameMutationMask: left.mutationMask === right.mutationMask,
      sameRegimeClass: left.regimeClass === right.regimeClass,
      sameModuleScope: left.moduleScope === right.moduleScope,
      distanceDelta: left.distance - right.distance,
      sharedChangedPositionCount
    };
  });

  return {
    transitions,
    groups,
    aggregate: {
      transitionCount: transitions.length,
      totalDistance: distances.reduce((sum, value) => sum + value, 0),
      averageDistance: round3(distances.reduce((sum, value) => sum + value, 0) / transitions.length),
      maxDistance,
      maxDistanceTransitionIds: transitions.filter((transition) => transition.distance === maxDistance).map((transition) => transition.id),
      regimeHistogram: histogram(transitions.map((transition) => transition.regimeClass)),
      moduleScopeHistogram: histogram(transitions.map((transition) => transition.moduleScope)),
      mutationMaskHistogram: histogram(transitions.map((transition) => transition.mutationMask))
    },
    comparisons
  };
}

function comparable(output) {
  if (!output || typeof output !== "object") return undefined;
  return {
    transitions: Array.isArray(output.transitions)
      ? output.transitions.map((transition) => ({
          id: transition.id,
          sourceStateId: transition.sourceStateId,
          targetStateId: transition.targetStateId,
          groupId: transition.groupId,
          mutationMask: transition.mutationMask,
          changedPositions: transition.changedPositions,
          distance: transition.distance,
          lowerDistance: transition.lowerDistance,
          upperDistance: transition.upperDistance,
          moduleScope: transition.moduleScope,
          regimeClass: transition.regimeClass,
          transitionIndex: transition.transitionIndex
        }))
      : undefined,
    groups: output.groups,
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
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!deepEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function qualityScore(output, expected) {
  const actual = comparable(output);
  const checks = [
    { name: "transitions", passed: deepEqual(actual?.transitions, expected.transitions) },
    { name: "groups", passed: deepEqual(actual?.groups, expected.groups) },
    { name: "aggregate", passed: deepEqual(actual?.aggregate, expected.aggregate) },
    { name: "comparisons", passed: deepEqual(actual?.comparisons, expected.comparisons) },
    {
      name: "transitionSummaries",
      passed:
        Array.isArray(output?.transitions) &&
        output.transitions.every((transition) => typeof transition.summary === "string" && transition.summary.length > 0)
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
    reworkEventCount: Array.isArray(log?.reworkEvents) ? log.reworkEvents.length : undefined,
    reworkEvents: log?.reworkEvents,
    semagraphRuntime: log?.semagraphRuntime,
    semagraphCallCount: Array.isArray(log?.semagraphCalls) ? log.semagraphCalls.length : 0,
    semagraphCalls: log?.semagraphCalls,
    tokenUsage: log?.tokenUsage ?? "unavailable",
    tokenUsageAvailable: typeof log?.tokenUsage === "object",
    acceptanceChecks: log?.acceptanceChecks
  };
}

function assertOracleTransition(actual, expected) {
  return (
    actual.mutationMask === expected.mutationMask &&
    deepEqual(actual.changedPositions, expected.changedPositions) &&
    actual.distance === expected.distance &&
    actual.lowerDistance === expected.lowerDistance &&
    actual.upperDistance === expected.upperDistance &&
    actual.moduleScope === expected.moduleScope &&
    actual.regimeClass === expected.regimeClass &&
    actual.transitionIndex === expected.transitionIndex
  );
}

function benchmarkTsOracle(expected) {
  const argsDir = resolve(tmpdir(), "semagraph-round-3-oracle-args-ts");
  mkdirSync(argsDir, { recursive: true });
  const cli = resolve(repoRoot, "ai-tools/semagraph-kernel-tool/dist/cli.js");
  if (!existsSync(cli)) {
    return { runtime: "semagraph-ts", available: false, error: "TS tool CLI not found" };
  }

  let ok = true;
  const failures = [];
  const started = performance.now();
  let callCount = 0;
  for (let repeat = 0; repeat < oracleRepeats; repeat += 1) {
    for (const transition of expected.transitions) {
      const argsPath = resolve(argsDir, `${transition.id}.json`);
      writeFileSync(
        argsPath,
        `${JSON.stringify({ sourceStateId: transition.sourceStateId, targetStateId: transition.targetStateId })}\n`
      );
      const stdout = execFileSync(process.execPath, [cli, "semagraph_lookup_transition64", argsPath], {
        cwd: repoRoot,
        encoding: "utf8"
      });
      callCount += 1;
      const payload = JSON.parse(stdout);
      if (!payload?.result || payload.result.inferenceUsed !== false || !assertOracleTransition(payload.result, transition)) {
        ok = false;
        failures.push(transition.id);
      }
    }
  }
  const durationMs = performance.now() - started;
  return {
    runtime: "semagraph-ts",
    available: true,
    ok,
    failures,
    callCount,
    repeats: oracleRepeats,
    durationMs: Number(durationMs.toFixed(3)),
    averageMsPerCall: Number((durationMs / callCount).toFixed(3)),
    surface: "node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_lookup_transition64 <args.json>"
  };
}

function rsBinCandidate() {
  const explicit = process.env.SEMAGRAPH_RS_BIN;
  if (explicit && existsSync(explicit) && statSync(explicit).isFile()) {
    return { path: explicit, source: "SEMAGRAPH_RS_BIN" };
  }
  const local = resolve(roundRoot, "runtime/semagraph.exe");
  if (existsSync(local) && statSync(local).isFile()) {
    return { path: local, source: "round-3/runtime/semagraph.exe" };
  }
  return undefined;
}

function rsTransitionFromJson(raw, expected) {
  const mask = `M64-${Number(raw.mutation_mask).toString(2).padStart(6, "0")}`;
  return {
    mutationMask: mask,
    changedPositions: changedPositions(mask),
    distance: raw.distance,
    lowerDistance: raw.lower_distance,
    upperDistance: raw.upper_distance,
    moduleScope: raw.module_scope,
    regimeClass: raw.regime_class,
    transitionIndex: raw.index,
    sourceStateId: expected.sourceStateId,
    targetStateId: expected.targetStateId,
    regimeClassCode: raw.regime_class_code
  };
}

function benchmarkRsOracle(expected) {
  const binary = rsBinCandidate();
  if (!binary) {
    return {
      runtime: "semagraph-rs",
      available: false,
      error: "Set SEMAGRAPH_RS_BIN to a semagraph binary or place runtime/semagraph.exe under round-3."
    };
  }

  let ok = true;
  const failures = [];
  const started = performance.now();
  let callCount = 0;
  for (let repeat = 0; repeat < oracleRepeats; repeat += 1) {
    for (const transition of expected.transitions) {
      const stdout = execFileSync(
        binary.path,
        ["classify", String(stateNumber(transition.sourceStateId)), String(stateNumber(transition.targetStateId)), "--json"],
        { encoding: "utf8" }
      );
      callCount += 1;
      const raw = JSON.parse(stdout);
      const actual = rsTransitionFromJson(raw, transition);
      if (!assertOracleTransition(actual, transition) || raw.regime_class_code !== regimeClassCodes[transition.regimeClass]) {
        ok = false;
        failures.push(transition.id);
      }
    }
  }
  const durationMs = performance.now() - started;
  return {
    runtime: "semagraph-rs",
    available: true,
    binarySource: binary.source,
    ok,
    failures,
    callCount,
    repeats: oracleRepeats,
    durationMs: Number(durationMs.toFixed(3)),
    averageMsPerCall: Number((durationMs / callCount).toFixed(3)),
    surface: "semagraph classify <sourceNumber> <targetNumber> --json"
  };
}

const expected = expectedOutput();
mkdirSync(reportsDir, { recursive: true });
writeFileSync(resolve(roundRoot, "fixtures/expected-output.json"), `${JSON.stringify(expected, null, 2)}\n`);

const results = variants.map((variant) => evaluateVariant(variant, expected));
const oracleBenchmark = {
  generatedAt: new Date().toISOString(),
  fixture: "fixtures/transitions.json",
  repeats: oracleRepeats,
  ts: benchmarkTsOracle(expected),
  rs: benchmarkRsOracle(expected)
};

const report = {
  benchmark: "agentic-loop-benchmark-round-3",
  generatedAt: new Date().toISOString(),
  fixture: "fixtures/transitions.json",
  strict,
  results,
  oracleBenchmark
};

writeFileSync(resolve(reportsDir, "oracle-benchmark.json"), `${JSON.stringify(oracleBenchmark, null, 2)}\n`);
writeFileSync(resolve(reportsDir, "latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

process.exit(strict && results.some((result) => !result.correct) ? 1 : 0);
