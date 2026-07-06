import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "dist", "cli.js");
const sample = join(here, "sample-chain.json");

const output = execFileSync(process.execPath, [cli, sample], { encoding: "utf8" });
const audit = JSON.parse(output);

assert.equal(audit.sourceStateId, "S64-000000");
assert.equal(audit.targetStateId, "S64-101010");
assert.deepEqual(audit.states, ["S64-000000", "S64-100000", "S64-101010"]);
assert.equal(audit.transitionCount, 2);
assert.deepEqual(audit.changedMasks, ["M64-100000", "M64-001010"]);
assert.equal(audit.netMutationMask, "M64-101010");
assert.equal(audit.cumulativeDistance, 3);
assert.match(audit.summary, /2 deterministic State64 transitions/);

assert.throws(
  () => execFileSync(process.execPath, [cli], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
  { status: 2 }
);

console.log("transition-audit smoke test passed");
