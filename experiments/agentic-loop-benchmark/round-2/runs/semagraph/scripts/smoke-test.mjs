import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(scriptDir, "..");
const cliPath = resolve(runDir, "dist", "transition-workbench.js");
const fixturePath = resolve(runDir, "fixtures", "smoke-scenarios.json");

const stdout = execFileSync(process.execPath, [cliPath, fixturePath], {
  cwd: runDir,
  encoding: "utf8"
});
const output = JSON.parse(stdout);

assert.equal(output.scenarios.length, 3);
assert.deepEqual(output.scenarios.map((scenario) => scenario.id), [
  "calm-ladder",
  "active-turn",
  "volatile-return"
]);

const calm = output.scenarios[0];
assert.equal(calm.sourceStateId, "S64-000000");
assert.equal(calm.targetStateId, "S64-101010");
assert.deepEqual(calm.states, ["S64-000000", "S64-100000", "S64-101000", "S64-101010"]);
assert.equal(calm.transitionCount, 3);
assert.deepEqual(calm.changedMasks, ["M64-100000", "M64-001000", "M64-000010"]);
assert.equal(calm.netMutationMask, "M64-101010");
assert.equal(calm.cumulativeDistance, 3);
assert.equal(calm.netDistance, 3);
assert.equal(calm.volatilityClass, "calm");

const active = output.scenarios[1];
assert.equal(active.netMutationMask, "M64-111001");
assert.equal(active.cumulativeDistance, 4);
assert.equal(active.netDistance, 4);
assert.equal(active.volatilityClass, "active");

const volatile = output.scenarios[2];
assert.equal(volatile.netMutationMask, "M64-111000");
assert.equal(volatile.cumulativeDistance, 15);
assert.equal(volatile.netDistance, 3);
assert.equal(volatile.volatilityClass, "volatile");

assert.deepEqual(output.aggregate, {
  scenarioCount: 3,
  totalTransitions: 8,
  totalCumulativeDistance: 22,
  maxCumulativeDistanceScenarioId: "volatile-return",
  netMutationHistogram: {
    "M64-101010": 1,
    "M64-111001": 1,
    "M64-111000": 1
  }
});

assert.deepEqual(output.comparisons, [
  {
    left: "calm-ladder",
    right: "active-turn",
    sameNetMutationMask: false,
    cumulativeDistanceDelta: 1,
    sharedChangedMaskCount: 0
  },
  {
    left: "active-turn",
    right: "volatile-return",
    sameNetMutationMask: false,
    cumulativeDistanceDelta: 11,
    sharedChangedMaskCount: 1
  },
  {
    left: "calm-ladder",
    right: "calm-ladder",
    sameNetMutationMask: true,
    cumulativeDistanceDelta: 0,
    sharedChangedMaskCount: 3
  }
]);

const invalidState = resolve(runDir, "fixtures", "invalid-state.json");
const invalidResult = spawnSync(process.execPath, [cliPath, invalidState], {
  cwd: runDir,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

assert.equal(invalidResult.status, 1);
assert.match(invalidResult.stderr, /S64-\[01\]\{6\}/);
assert.equal(invalidResult.stdout, "");
