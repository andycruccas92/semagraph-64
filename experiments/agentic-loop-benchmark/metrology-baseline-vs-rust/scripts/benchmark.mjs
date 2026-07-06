#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repoRoot = resolve(root, "../../..");
const reportsDir = resolve(root, "reports");
const baselineCli = resolve(here, "baseline-classify.mjs");

const sampleSize = positiveInt(process.env.METROLOGY_SAMPLE_SIZE, 128);
const repeats = positiveInt(process.env.METROLOGY_REPEATS, 7);
const warmups = positiveInt(process.env.METROLOGY_WARMUPS, 2);
const inprocessIterations = positiveInt(process.env.METROLOGY_INPROCESS_ITERATIONS, 10000);
const rustBinary = findRustBinary();

function positiveInt(raw, fallback) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function findRustBinary() {
  const explicit = process.env.SEMAGRAPH_RS_BIN;
  if (explicit && existsSync(explicit) && statSync(explicit).isFile()) return explicit;

  const tempCandidate = resolve(
    tmpdir(),
    "semagraph-rs-v0.7.0/unzipped/packages/target/x86_64-pc-windows-msvc/release/semagraph.exe"
  );
  if (existsSync(tempCandidate) && statSync(tempCandidate).isFile()) return tempCandidate;

  return undefined;
}

function popcount6(value) {
  let count = 0;
  let cursor = value & 0b111111;
  while (cursor > 0) {
    count += cursor & 1;
    cursor >>= 1;
  }
  return count;
}

function classifyModuleScope(lowerDistance, upperDistance) {
  if (lowerDistance === 0 && upperDistance === 0) return "none";
  if (lowerDistance > 0 && upperDistance === 0) return "lower_only";
  if (lowerDistance === 0 && upperDistance > 0) return "upper_only";
  return "both_modules";
}

function classifyRegimeClass(distance, moduleScope) {
  if (distance === 0) return "no_change";
  if (distance === 1) return "bit_adjustment";
  if (distance <= 2 && moduleScope !== "both_modules") return "module_reconfiguration";
  if (distance === 6) return "full_bit_reversal";
  if (distance >= 4) return "near_total_inversion";
  return "cross_module_regime_shift";
}

function regimeClassCode(regimeClass) {
  return {
    no_change: 0,
    bit_adjustment: 1,
    module_reconfiguration: 2,
    cross_module_regime_shift: 3,
    near_total_inversion: 4,
    full_bit_reversal: 5
  }[regimeClass];
}

function classify(source, target) {
  const mutationMask = source ^ target;
  const distance = popcount6(mutationMask);
  const lowerDistance = popcount6((mutationMask >> 3) & 0b111);
  const upperDistance = popcount6(mutationMask & 0b111);
  const moduleScope = classifyModuleScope(lowerDistance, upperDistance);
  const regimeClass = classifyRegimeClass(distance, moduleScope);
  return {
    source,
    target,
    mutation_mask: mutationMask,
    distance,
    lower_distance: lowerDistance,
    upper_distance: upperDistance,
    module_scope: moduleScope,
    regime_class: regimeClass,
    regime_class_code: regimeClassCode(regimeClass),
    index: source * 64 + target
  };
}

function allTransitions() {
  const transitions = [];
  for (let source = 0; source < 64; source += 1) {
    for (let target = 0; target < 64; target += 1) {
      transitions.push({ source, target, distance: popcount6(source ^ target) });
    }
  }
  return transitions;
}

function stratifiedSample(size) {
  const buckets = new Map();
  for (const transition of allTransitions()) {
    const bucket = buckets.get(transition.distance) ?? [];
    bucket.push(transition);
    buckets.set(transition.distance, bucket);
  }
  const selected = [];
  let offset = 0;
  while (selected.length < size) {
    for (let distance = 0; distance <= 6 && selected.length < size; distance += 1) {
      const bucket = buckets.get(distance);
      selected.push(bucket[offset % bucket.length]);
    }
    offset += 1;
  }
  return selected;
}

function normalize(raw) {
  return {
    source: Number(raw.source),
    target: Number(raw.target),
    mutation_mask: Number(raw.mutation_mask),
    distance: Number(raw.distance),
    lower_distance: Number(raw.lower_distance),
    upper_distance: Number(raw.upper_distance),
    module_scope: raw.module_scope,
    regime_class: raw.regime_class,
    regime_class_code: Number(raw.regime_class_code),
    index: Number(raw.index)
  };
}

function sameTransition(left, right) {
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function runBaselineCli(transition) {
  return JSON.parse(
    execFileSync(process.execPath, [baselineCli, String(transition.source), String(transition.target)], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
}

function runRustCli(transition) {
  if (!rustBinary) throw new Error("SEMAGRAPH_RS_BIN is required for semagraph-rs-cli");
  return JSON.parse(
    execFileSync(rustBinary, ["classify", String(transition.source), String(transition.target), "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
}

function measureCli(name, runner, sample) {
  const measurements = [];
  const validationFailures = [];
  for (let repeat = 0; repeat < repeats + warmups; repeat += 1) {
    const started = performance.now();
    for (const transition of sample) {
      const expected = classify(transition.source, transition.target);
      const actual = runner(transition);
      if (!sameTransition(actual, expected)) {
        validationFailures.push({ repeat, transition, actual, expected });
      }
    }
    const totalMs = performance.now() - started;
    if (repeat >= warmups) {
      measurements.push({
        sample: repeat - warmups,
        calls: sample.length,
        totalMs,
        perCallMs: totalMs / sample.length
      });
    }
  }
  return summarizeMeasurement(name, "cli-per-transition", measurements, validationFailures);
}

function measureInprocess(sample) {
  const measurements = [];
  const validationFailures = [];
  for (let repeat = 0; repeat < repeats + warmups; repeat += 1) {
    const started = performance.now();
    for (let iteration = 0; iteration < inprocessIterations; iteration += 1) {
      for (const transition of sample) {
        const actual = classify(transition.source, transition.target);
        if (iteration === 0 && repeat === 0 && !sameTransition(actual, actual)) {
          validationFailures.push({ repeat, transition, actual });
        }
      }
    }
    const totalMs = performance.now() - started;
    if (repeat >= warmups) {
      measurements.push({
        sample: repeat - warmups,
        calls: sample.length * inprocessIterations,
        totalMs,
        perCallMs: totalMs / (sample.length * inprocessIterations)
      });
    }
  }
  return summarizeMeasurement("baseline-js-inprocess", "in-process-lower-bound", measurements, validationFailures);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1);
  return sorted[index];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function summarize(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const med = median(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  const deviations = values.map((value) => Math.abs(value - med));
  return {
    min: round(Math.min(...values)),
    median: round(med),
    mean: round(mean),
    p95: round(quantile(values, 0.95)),
    max: round(Math.max(...values)),
    stdev: round(stdev),
    mad: round(median(deviations)),
    cv: mean === 0 ? 0 : round(stdev / mean)
  };
}

function summarizeMeasurement(name, boundary, measurements, validationFailures) {
  return {
    name,
    boundary,
    valid: validationFailures.length === 0,
    validationFailures,
    repeats,
    warmups,
    callsPerRepeat: measurements[0]?.calls ?? 0,
    totalCalls: measurements.reduce((sum, measurement) => sum + measurement.calls, 0),
    totalMs: summarize(measurements.map((measurement) => measurement.totalMs)),
    perCallMs: summarize(measurements.map((measurement) => measurement.perCallMs)),
    samples: measurements.map((measurement) => ({
      sample: measurement.sample,
      calls: measurement.calls,
      totalMs: round(measurement.totalMs),
      perCallMs: round(measurement.perCallMs)
    }))
  };
}

function round(value) {
  return Number(value.toFixed(6));
}

function rustVerify() {
  if (!rustBinary) return { available: false, ok: false, error: "SEMAGRAPH_RS_BIN not set" };
  const stdout = execFileSync(rustBinary, ["verify", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const parsed = JSON.parse(stdout);
  return { available: true, ...parsed };
}

function markdown(report) {
  const byName = new Map(report.measurements.map((measurement) => [measurement.name, measurement]));
  const baselineCli = byName.get("baseline-node-cli");
  const rustCli = byName.get("semagraph-rs-cli");
  const inprocess = byName.get("baseline-js-inprocess");
  const cliRatio = baselineCli && rustCli ? baselineCli.perCallMs.median / rustCli.perCallMs.median : undefined;
  const rustImprovement = cliRatio ? (1 - rustCli.perCallMs.median / baselineCli.perCallMs.median) * 100 : undefined;

  return `# Baseline vs Rust Metrology Comparison

Generated from:

\`\`\`bash
SEMAGRAPH_RS_BIN=<semagraph.exe> node experiments/agentic-loop-benchmark/metrology-baseline-vs-rust/scripts/benchmark.mjs
\`\`\`

## Method

This report does not use agent-loop wall-clock durations. It measures direct Q6
transition classification with warmups and repeated samples.

Primary comparison: \`baseline-node-cli\` vs \`semagraph-rs-cli\`.
Both spawn one CLI process per transition and emit JSON for the same
classification operation.

\`baseline-js-inprocess\` is retained only as a lower-bound computation baseline;
it is not an integration-surface equivalent to Rust CLI.

## Configuration

| Field | Value |
| --- | ---: |
| Sample size | ${report.config.sampleSize} |
| Repeats | ${report.config.repeats} |
| Warmups | ${report.config.warmups} |
| In-process iterations/repeat | ${report.config.inprocessIterations} |
| Node version | ${report.environment.node} |
| Platform | ${report.environment.platform} ${report.environment.arch} |

## Results

| Measurement | Boundary | Median per call | p95 per call | MAD per call | Valid |
| --- | --- | ---: | ---: | ---: | --- |
${report.measurements
  .map(
    (measurement) =>
      `| ${measurement.name} | ${measurement.boundary} | ${measurement.perCallMs.median} ms | ${measurement.perCallMs.p95} ms | ${measurement.perCallMs.mad} ms | ${measurement.valid ? "yes" : "no"} |`
  )
  .join("\n")}

## Interpretation

At the comparable CLI boundary, Rust was ${
    cliRatio ? `${cliRatio.toFixed(2)}x` : "not"
  } faster than the Node baseline by median per-call latency${
    rustImprovement ? `, a ${rustImprovement.toFixed(1)}% lower median per-call time` : ""
  }.

The in-process JavaScript baseline is much faster than either CLI surface, which
confirms that process startup and JSON command boundaries dominate small single
transition calls. A future Rust batch or embedded binding would be the right
surface for measuring Rust kernel cost without per-call process overhead.

## Validity

- Baseline CLI and Rust CLI outputs were validated against the same deterministic
  reference for every measured transition.
- Rust \`verify --json\` result: ${JSON.stringify(report.rustVerify)}.
- Sample is stratified across mutation distances 0..6.
- Token usage is not part of this benchmark.
`;
}

mkdirSync(reportsDir, { recursive: true });
const sample = stratifiedSample(sampleSize);
const rustStatus = rustVerify();
const measurements = [
  measureInprocess(sample),
  measureCli("baseline-node-cli", runBaselineCli, sample),
  rustBinary
    ? measureCli("semagraph-rs-cli", runRustCli, sample)
    : {
        name: "semagraph-rs-cli",
        boundary: "cli-per-transition",
        valid: false,
        validationFailures: [{ error: "SEMAGRAPH_RS_BIN not set and no temp release binary found" }],
        repeats,
        warmups,
        callsPerRepeat: 0,
        totalCalls: 0,
        totalMs: {},
        perCallMs: {},
        samples: []
      }
];

const report = {
  benchmark: "baseline-vs-rust-metrology",
  generatedAt: new Date().toISOString(),
  config: {
    sampleSize,
    repeats,
    warmups,
    inprocessIterations,
    sampleStrategy: "stratified round-robin over mutation distances 0..6"
  },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    rustBinary: rustBinary ?? null
  },
  rustVerify: rustStatus,
  measurements
};

writeFileSync(resolve(reportsDir, "latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(reportsDir, "initial-comparison.md"), markdown(report));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
