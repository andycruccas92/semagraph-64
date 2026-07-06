import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(runDir, "../../../../..");
const commonFixturePath = join(
  repoRoot,
  "experiments",
  "agentic-loop-benchmark",
  "round-2",
  "fixtures",
  "scenarios.json"
);
const localFixturePath = join(runDir, "fixtures", "scenarios.local.json");
const fixturePath = existsSync(commonFixturePath) ? commonFixturePath : localFixturePath;
const outputPath = join(runDir, "output.json");
const cliPath = join(runDir, "src", "transition-workbench.ts");

const stdout = execFileSync(process.execPath, [cliPath, fixturePath], {
  cwd: runDir,
  encoding: "utf8",
  windowsHide: true
});

const stdoutJson = JSON.parse(stdout);

assert.equal(Array.isArray(stdoutJson.scenarios), true, "scenarios must be an array");
assert.equal(Array.isArray(stdoutJson.comparisons), true, "comparisons must be an array");
assert.equal(typeof stdoutJson.aggregate, "object", "aggregate must be an object");

if (fixturePath === commonFixturePath) {
  assert.equal(existsSync(outputPath), true, "output.json must exist for the common fixture");
  const outputJson = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.deepEqual(outputJson, stdoutJson, "output.json must match common fixture CLI stdout");
} else {
  assert.deepEqual(stdoutJson, {
    scenarios: [
      {
        id: "steady-rise",
        sourceStateId: "S64-000000",
        targetStateId: "S64-111000",
        transitionCount: 3,
        changedMasks: ["M64-100000", "M64-010000", "M64-001000"],
        netMutationMask: "M64-111000",
        cumulativeDistance: 3,
        netDistance: 3,
        volatilityClass: "calm",
        summary:
          "steady-rise: 3 transitions from S64-000000 to S64-111000; net mutation M64-111000 at distance 3; cumulative distance 3; volatility calm."
      },
      {
        id: "active-shift",
        sourceStateId: "S64-010101",
        targetStateId: "S64-001111",
        transitionCount: 3,
        changedMasks: ["M64-100000", "M64-001010", "M64-110000"],
        netMutationMask: "M64-011010",
        cumulativeDistance: 5,
        netDistance: 3,
        volatilityClass: "active",
        summary:
          "active-shift: 3 transitions from S64-010101 to S64-001111; net mutation M64-011010 at distance 3; cumulative distance 5; volatility active."
      },
      {
        id: "wide-swing",
        sourceStateId: "S64-001100",
        targetStateId: "S64-000011",
        transitionCount: 3,
        changedMasks: ["M64-110000", "M64-001111", "M64-110000"],
        netMutationMask: "M64-001111",
        cumulativeDistance: 8,
        netDistance: 4,
        volatilityClass: "volatile",
        summary:
          "wide-swing: 3 transitions from S64-001100 to S64-000011; net mutation M64-001111 at distance 4; cumulative distance 8; volatility volatile."
      },
      {
        id: "return-loop",
        sourceStateId: "S64-101010",
        targetStateId: "S64-001010",
        transitionCount: 3,
        changedMasks: ["M64-000001", "M64-100000", "M64-000001"],
        netMutationMask: "M64-100000",
        cumulativeDistance: 3,
        netDistance: 1,
        volatilityClass: "calm",
        summary:
          "return-loop: 3 transitions from S64-101010 to S64-001010; net mutation M64-100000 at distance 1; cumulative distance 3; volatility calm."
      }
    ],
    aggregate: {
      scenarioCount: 4,
      totalTransitions: 12,
      totalCumulativeDistance: 19,
      maxCumulativeDistanceScenarioId: "wide-swing",
      netMutationHistogram: {
        "M64-001111": 1,
        "M64-011010": 1,
        "M64-100000": 1,
        "M64-111000": 1
      }
    },
    comparisons: [
      {
        left: "steady-rise",
        right: "active-shift",
        sameNetMutationMask: false,
        cumulativeDistanceDelta: -2,
        sharedChangedMaskCount: 1
      },
      {
        left: "active-shift",
        right: "wide-swing",
        sameNetMutationMask: false,
        cumulativeDistanceDelta: -3,
        sharedChangedMaskCount: 1
      },
      {
        left: "wide-swing",
        right: "return-loop",
        sameNetMutationMask: false,
        cumulativeDistanceDelta: 5,
        sharedChangedMaskCount: 0
      },
      {
        left: "steady-rise",
        right: "return-loop",
        sameNetMutationMask: false,
        cumulativeDistanceDelta: 0,
        sharedChangedMaskCount: 1
      }
    ]
  });

  process.stderr.write(
    "Common round-2 fixture was not found; smoke test used the baseline-local fixture.\n"
  );
}

process.stdout.write(`transition-workbench smoke ok: ${fixturePath}\n`);
