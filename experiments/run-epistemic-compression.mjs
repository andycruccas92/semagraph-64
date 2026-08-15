import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MathematicalAnchorRegistry,
  compareMathematicalStructures,
  createCandidateAnchor
} from "../packages/math-anchors/dist/index.js";
import { anchorMathematicalObservationsToState64 } from "../packages/state64-adapter/dist/index.js";
import {
  compareTrajectories,
  endpointCompression,
  exactPathKey,
  netMutationQ3,
  pathQ3,
  shapeKey
} from "../packages/kernel/dist/index.js";

const experimentRoot = dirname(fileURLToPath(import.meta.url));

function loadJson(relativePath) {
  return JSON.parse(readFileSync(resolve(experimentRoot, relativePath), "utf8"));
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function unorderedPairs(items) {
  const pairs = [];
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      pairs.push([items[left], items[right]]);
    }
  }
  return pairs;
}

function hamming(leftStateId, rightStateId) {
  const left = leftStateId.slice("S64-".length);
  const right = rightStateId.slice("S64-".length);
  let distance = 0;
  for (let index = 0; index < 6; index += 1) if (left[index] !== right[index]) distance += 1;
  return distance;
}

function entropy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let result = 0;
  for (const count of counts.values()) {
    const probability = count / values.length;
    result -= probability * Math.log2(probability);
  }
  return result;
}

function semanticCollisionExperiment() {
  const fixture = loadJson("semantic-collision/scenarios.json");
  const definitions = fixture.definitions.map((entry) => ({
    id: entry.id,
    version: entry.version,
    label: entry.label,
    observationalSpace: {
      description: `Synthetic observations for ${entry.id}.`,
      admissibleObservationKeys: ["value"]
    },
    structure: {
      kind: entry.kind,
      family: entry.family,
      description: `Declared ${entry.kind} contract for the experiment.`,
      declaredAxioms: entry.axioms
    }
  }));

  const comparisons = unorderedPairs(definitions).map(([left, right]) => ({
    left: left.id,
    right: right.id,
    ...compareMathematicalStructures(left, right)
  }));
  const lexicalCollisionPairs = comparisons.filter(
    (entry) => entry.sameLexicalLabel && !entry.sameDeclaredStructure
  );
  const sharedStructureDifferentLabels = comparisons.filter(
    (entry) => !entry.sameLexicalLabel && entry.sameDeclaredStructure
  );

  return {
    fixtureVersion: fixture.experimentVersion,
    definitionCount: definitions.length,
    lexicalCollisionPairCount: lexicalCollisionPairs.length,
    lexicalCollisionPairs: lexicalCollisionPairs.map(({ left, right }) => [left, right]),
    sharedStructureDifferentLabelPairCount: sharedStructureDifferentLabels.length,
    sharedStructureDifferentLabelPairs: sharedStructureDifferentLabels.map(({ left, right }) => [left, right]),
    semanticIdentityAssertions: comparisons.filter((entry) => entry.semanticIdentityAsserted).length
  };
}

function makeExperimentalDomain(fixture) {
  return {
    id: fixture.domainId,
    version: fixture.experimentVersion,
    label: "Synthetic six-coordinate capability space",
    observationalSpace: {
      description: "Declared synthetic records for deterministic compression metrology.",
      admissibleObservationKeys: [1, 2, 3, 4, 5, 6].map((position) => `feature${position}`)
    },
    structure: {
      kind: "state_space",
      family: "dynamical_state",
      description: "A six-coordinate formal state used only by the experimental fixture.",
      declaredAxioms: ["Each coordinate is a supplied number in the closed interval [0,100]."]
    }
  };
}

function makeExperimentalAnchor(fixture, config) {
  const variables = [1, 2, 3, 4, 5, 6].map((position) => ({
    id: `feature${position}`,
    label: `Feature ${position}`,
    valueType: "number",
    description: `Declared synthetic feature ${position}.`
  }));
  return {
    id: config.id,
    version: config.version,
    label: `${config.id} State64 contract`,
    mathematicalDomainId: fixture.domainId,
    mathematicalDomainVersion: fixture.experimentVersion,
    structureKind: "state_space",
    formalizationDescription: "Identity-bind six admitted numeric observations to the declared state-space coordinates.",
    variables,
    relations: variables.map((variable) => ({
      id: `relation-${variable.id}`,
      kind: "coordinate_membership",
      operandVariableIds: [variable.id],
      description: `${variable.id} participates in the declared synthetic state space.`
    })),
    observationBindings: variables.map((variable) => ({
      id: `binding-${variable.id}`,
      observationKey: variable.id,
      formalVariableId: variable.id,
      required: true,
      transform: { kind: "identity" }
    })),
    assumptions: [{
      id: "synthetic-metrology",
      statement: "The supplied fixture is a deterministic metrology surface, not evidence about an external domain."
    }],
    validityScope: {
      description: "Only the committed synthetic epistemic-compression fixture.",
      appliesWhen: [`experimentVersion=${fixture.experimentVersion}`],
      excludes: ["external empirical claims"]
    },
    projection: {
      version: `${config.id}-projection-${config.version}`,
      predicates: config.thresholds.map((threshold, index) => ({
        id: `${config.id}-predicate-${index + 1}`,
        position: index + 1,
        label: `Feature ${index + 1} >= ${threshold}`,
        expression: {
          formalVariableId: `feature${index + 1}`,
          formalRelationIds: [`relation-feature${index + 1}`],
          operator: "gte",
          value: threshold
        }
      }))
    },
    evidenceProvenance: { minimumReferencesPerObservation: 1, requireContentHash: false }
  };
}

function projectFixture() {
  const fixture = loadJson("fixtures/anchored-observations.json");
  if (fixture.decision.weights.length !== 6) throw new Error("Decision fixture must declare six weights.");
  if (round(fixture.decision.weights.reduce((sum, value) => sum + value, 0)) !== 1) {
    throw new Error("Decision weights must sum to one.");
  }

  const registry = new MathematicalAnchorRegistry();
  registry.registerDomain(makeExperimentalDomain(fixture));
  for (const config of fixture.anchors) {
    registry.registerAnchor(
      createCandidateAnchor(makeExperimentalAnchor(fixture, config), "human"),
      "experiment-review-board"
    );
  }

  const byAnchor = new Map();
  for (const config of fixture.anchors) {
    const projections = fixture.records.map((record) => {
      const observations = record.values.map((value, index) => ({
        key: `feature${index + 1}`,
        value,
        evidenceReferences: [{
          id: `${record.id}-evidence-${index + 1}`,
          source: `fixture:${fixture.experimentVersion}:${record.id}`
        }]
      }));
      const anchored = anchorMathematicalObservationsToState64(
        registry,
        config.id,
        config.version,
        observations
      );
      return { record, anchored, bits: anchored.state.id.slice("S64-".length).split("").map(Number) };
    });
    byAnchor.set(config.id, projections);
  }
  return { fixture, byAnchor };
}

function anchorComparisonExperiment(projected) {
  const [leftConfig, rightConfig] = projected.fixture.anchors;
  const left = projected.byAnchor.get(leftConfig.id);
  const right = projected.byAnchor.get(rightConfig.id);
  const comparisons = left.map((entry, index) => ({
    recordId: entry.record.id,
    leftState: entry.anchored.state.id,
    rightState: right[index].anchored.state.id,
    distance: hamming(entry.anchored.state.id, right[index].anchored.state.id)
  }));
  const indistinguishable = comparisons.filter((entry) => entry.distance === 0);
  return {
    anchors: [leftConfig.id, rightConfig.id],
    recordCount: comparisons.length,
    indistinguishableRecordCount: indistinguishable.length,
    indistinguishableRate: round(indistinguishable.length / comparisons.length),
    averageStateHammingDisagreement: round(
      comparisons.reduce((sum, entry) => sum + entry.distance, 0) / comparisons.length
    ),
    indistinguishableRecordIds: indistinguishable.map((entry) => entry.recordId)
  };
}

function projectionDistortionExperiment(projected) {
  const results = [];
  for (const config of projected.fixture.anchors) {
    const projections = projected.byAnchor.get(config.id);
    const pairs = unorderedPairs(projections);
    const collisionPairs = pairs.filter(([left, right]) =>
      left.anchored.state.id === right.anchored.state.id
      && JSON.stringify(left.record.values) !== JSON.stringify(right.record.values)
    );
    const buckets = new Map();
    for (const entry of projections) {
      const stateId = entry.anchored.state.id;
      const bucket = buckets.get(stateId) ?? [];
      bucket.push(entry.record.id);
      buckets.set(stateId, bucket);
    }
    const traceDecisions = projections.flatMap((entry) => entry.anchored.trace.bits);
    const completeTraceDecisions = traceDecisions.filter((decision) =>
      decision.predicateId
      && decision.formalVariableIds.length > 0
      && decision.formalRelationIds.length > 0
      && decision.observationBindingIds.length > 0
      && decision.evidenceReferences.length > 0
    );
    const largestBucket = [...buckets.entries()].sort((left, right) => right[1].length - left[1].length)[0];
    results.push({
      anchorId: config.id,
      richRecordCount: projections.length,
      occupiedStateCount: buckets.size,
      stateEntropyBits: round(entropy(projections.map((entry) => entry.anchored.state.id))),
      collisionPairCount: collisionPairs.length,
      collisionRate: round(collisionPairs.length / pairs.length),
      largestBucket: { stateId: largestBucket[0], recordIds: largestBucket[1] },
      provenanceTraceCompleteness: round(completeTraceDecisions.length / traceDecisions.length)
    });
  }
  return results;
}

function score(values, weights) {
  return values.reduce((sum, value, index) => sum + value * weights[index], 0);
}

function pairwiseRankingPreservation(rows) {
  let eligible = 0;
  let preserved = 0;
  for (const [left, right] of unorderedPairs(rows)) {
    const richDifference = left.richScore - right.richScore;
    if (richDifference === 0) continue;
    eligible += 1;
    const compressedDifference = left.compressedScore - right.compressedScore;
    if (Math.sign(richDifference) === Math.sign(compressedDifference)) preserved += 1;
  }
  return { eligiblePairs: eligible, preservedPairs: preserved, rate: round(preserved / eligible) };
}

function decisionPreservationExperiment(projected) {
  const { weights, threshold } = projected.fixture.decision;
  const results = [];
  for (const config of projected.fixture.anchors) {
    const rows = projected.byAnchor.get(config.id).map((entry) => {
      const richScore = score(entry.record.values, weights);
      const compressedScore = score(entry.bits.map((bit) => bit * 100), weights);
      return {
        recordId: entry.record.id,
        richScore,
        compressedScore,
        richDecision: richScore >= threshold,
        compressedDecision: compressedScore >= threshold
      };
    });
    const preserved = rows.filter((row) => row.richDecision === row.compressedDecision);
    results.push({
      anchorId: config.id,
      recordCount: rows.length,
      decisionPreservationRate: round(preserved.length / rows.length),
      rankingPreservation: pairwiseRankingPreservation(rows),
      disagreementRecordIds: rows
        .filter((row) => row.richDecision !== row.compressedDecision)
        .map((row) => row.recordId)
    });
  }
  return results;
}

function trajectoryEquivalenceExperiment() {
  const fixture = loadJson("trajectory-equivalence/scenarios.json");
  const paths = fixture.paths.map((entry) => ({ ...entry, path: pathQ3(entry.states) }));
  const projections = {
    endpoint: (entry) => String(endpointCompression(entry.path)),
    netMutation: (entry) => String(netMutationQ3(entry.path)),
    shape: (entry) => shapeKey(entry.path),
    exactPath: (entry) => exactPathKey(entry.path)
  };
  const pairRows = unorderedPairs(paths);
  const falseEquivalencePairs = {};
  for (const [name, projection] of Object.entries(projections)) {
    falseEquivalencePairs[name] = pairRows.filter(([left, right]) =>
      projection(left) === projection(right)
      && exactPathKey(left.path) !== exactPathKey(right.path)
    ).length;
  }
  const comparisonRelations = {};
  for (const [left, right] of pairRows) {
    const relation = compareTrajectories(left.path, right.path).relation;
    comparisonRelations[relation] = (comparisonRelations[relation] ?? 0) + 1;
  }
  return {
    fixtureVersion: fixture.experimentVersion,
    pathRecordCount: paths.length,
    pairCount: pairRows.length,
    falseEquivalencePairs,
    comparisonRelations
  };
}

const semanticCollision = semanticCollisionExperiment();
const projected = projectFixture();
const anchorComparison = anchorComparisonExperiment(projected);
const projectionDistortion = projectionDistortionExperiment(projected);
const decisionPreservation = decisionPreservationExperiment(projected);
const trajectoryEquivalence = trajectoryEquivalenceExperiment();

const checks = [
  {
    id: "lexical-equality-has-no-authority",
    passed: semanticCollision.lexicalCollisionPairCount > 0
      && semanticCollision.semanticIdentityAssertions === 0
  },
  {
    id: "structural-comparability-does-not-require-lexical-equality",
    passed: semanticCollision.sharedStructureDifferentLabelPairCount > 0
  },
  {
    id: "distinct-anchors-can-agree-and-disagree-after-projection",
    passed: anchorComparison.indistinguishableRecordCount > 0
      && anchorComparison.indistinguishableRecordCount < anchorComparison.recordCount
  },
  {
    id: "q6-creates-rich-input-collisions",
    passed: projectionDistortion.every((entry) => entry.collisionPairCount > 0)
  },
  {
    id: "every-projected-bit-retains-complete-provenance",
    passed: projectionDistortion.every((entry) => entry.provenanceTraceCompleteness === 1)
  },
  {
    id: "fixture-exposes-decision-loss",
    passed: decisionPreservation.some((entry) => entry.decisionPreservationRate < 1)
  },
  {
    id: "lossy-trajectory-projections-do-not-become-exact-identity",
    passed: trajectoryEquivalence.falseEquivalencePairs.endpoint > 0
      && trajectoryEquivalence.falseEquivalencePairs.netMutation > 0
      && trajectoryEquivalence.falseEquivalencePairs.exactPath === 0
  },
  {
    id: "shape-and-dwell-remain-distinct",
    passed: (trajectoryEquivalence.comparisonRelations.same_form_different_duration ?? 0) > 0
  }
];

const report = {
  benchmark: "semagraph-epistemic-compression",
  benchmarkVersion: projected.fixture.experimentVersion,
  claimStatus: "synthetic metrology baseline; no empirical confirmation of H1-H5",
  passed: checks.every((check) => check.passed),
  checks,
  metrics: {
    semanticCollision,
    anchorComparison,
    projectionDistortion,
    decisionPreservation,
    trajectoryEquivalence
  }
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
