import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, "..");
const repoRoot = resolve(runDir, "../../../../..");
const fixturePath = resolve(repoRoot, "experiments/agentic-loop-benchmark/round-3/fixtures/transitions.json");
const cliPath = resolve(runDir, "dist/transition-matrix-profiler.js");
const outputPath = resolve(runDir, "output.json");

const result = spawnSync(process.execPath, [cliPath, fixturePath], {
  cwd: runDir,
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const output = JSON.parse(result.stdout);

assert(output.transitions.length === 16, "expected 16 profiled transitions");
assert(output.groups.length === 5, "expected 5 group summaries");
assert(output.aggregate.transitionCount === 16, "expected aggregate transitionCount 16");
assert(output.aggregate.totalDistance === 47, "expected aggregate totalDistance 47");
assert(output.aggregate.averageDistance === 2.938, "expected aggregate averageDistance 2.938");
assert(output.comparisons.length === 6, "expected 6 pairwise comparisons");
assert(output.transitions.every((transition) => typeof transition.summary === "string" && transition.summary.length > 0), "expected non-empty transition summaries");

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
