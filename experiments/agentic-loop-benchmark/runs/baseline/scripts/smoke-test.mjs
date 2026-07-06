import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runRoot = resolve(here, "..");
const cliPath = resolve(runRoot, "dist", "transition-audit.js");
const fixturePath = resolve(runRoot, "fixtures", "sample-states.json");

const stdout = execFileSync(process.execPath, [cliPath, fixturePath], {
  cwd: runRoot,
  encoding: "utf8"
});

const audit = JSON.parse(stdout);

assert.equal(audit.sourceStateId, "S64-000000");
assert.equal(audit.targetStateId, "S64-101010");
assert.deepEqual(audit.states, ["S64-000000", "S64-100000", "S64-101010"]);
assert.equal(audit.transitionCount, 2);
assert.deepEqual(audit.changedMasks, ["M64-100000", "M64-001010"]);
assert.equal(audit.netMutationMask, "M64-101010");
assert.equal(audit.cumulativeDistance, 3);
assert.equal(
  audit.summary,
  "2 transitions from S64-000000 to S64-101010; net mutation M64-101010; cumulative distance 3."
);

console.log("transition-audit smoke test passed");
