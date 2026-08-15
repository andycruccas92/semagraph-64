import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(readFileSync(resolve(root, "fixtures/scenarios.json"), "utf8"));
const expected = JSON.parse(readFileSync(resolve(root, "fixtures/expected-output.json"), "utf8"));
const candidatePath = process.argv[2];
const candidate = candidatePath ? JSON.parse(readFileSync(resolve(candidatePath), "utf8")) : expected;

function assertFixtureIsAdversarial() {
  const byId = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const distance = byId.get("distance-three-ontologies");
  if (new Set(distance.candidates.map((item) => item.structureKind)).size !== 3) throw new Error("distance collision fixture must contain three distinct structures");
  const shared = byId.get("different-words-shared-structure");
  if (new Set(shared.anchors.map((item) => item.structureKind)).size !== 1 || new Set(shared.expressions).size !== 2) throw new Error("shared-structure fixture is malformed");
  const versions = byId.get("historical-version-replay");
  if (versions.historicalVersion === versions.latestVersion || versions.historicalState === versions.latestState) throw new Error("version drift fixture must distinguish versions and outputs");
  const ambiguous = byId.get("ambiguous-candidate-ontology");
  if (ambiguous.registeredAnchorIds.length !== 0 || ambiguous.candidateAnchorIds.length < 2) throw new Error("ambiguity fixture must contain only multiple candidates");
}

assertFixtureIsAdversarial();
const expectedById = new Map(expected.outcomes.map((outcome) => [outcome.id, outcome]));
const actualById = new Map((candidate.outcomes ?? []).map((outcome) => [outcome.id, outcome]));
const results = fixture.scenarios.map((scenario) => {
  const wanted = expectedById.get(scenario.id);
  const actual = actualById.get(scenario.id);
  return { id: scenario.id, passed: JSON.stringify(actual) === JSON.stringify(wanted), expected: wanted, actual: actual ?? null };
});
const summary = { benchmarkVersion: fixture.benchmarkVersion, passed: results.filter((result) => result.passed).length, total: results.length, results };
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (summary.passed !== summary.total) process.exitCode = 1;
