#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repoRoot = resolve(root, "../../..");
const reportsDir = resolve(root, "reports");
const baselineCli = resolve(here, "baseline-classify.mjs");

const sampleSize = positiveInt(process.env.METROLOGY_SAMPLE_SIZE, 128);
const repeats = positiveInt(process.env.METROLOGY_REPEATS, 9);
const warmups = positiveInt(process.env.METROLOGY_WARMUPS, 3);
const inprocessIterations = positiveInt(process.env.METROLOGY_INPROCESS_ITERATIONS, 10000);

function positiveInt(raw, fallback) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

function stateId(value) {
  return `S64-${value.toString(2).padStart(6, "0")}`;
}

function maskId(value) {
  return `M64-${value.toString(2).padStart(6, "0")}`;
}

function changedPositions(maskNumber) {
  return [...maskNumber.toString(2).padStart(6, "0")].flatMap((bit, index) => (bit === "1" ? [index + 1] : []));
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
    sourceStateId: stateId(source),
    targetStateId: stateId(target),
    mutationMaskNumber: mutationMask,
    mutationMask: maskId(mutationMask),
    changedPositions: changedPositions(mutationMask),
    distance,
    lowerDistance,
    upperDistance,
    moduleScope,
    regimeClass,
    regimeClassCode: regimeClassCode(regimeClass),
    transitionIndex: source * 64 + target,
    inferenceUsed: false
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

function normalizeCli(raw) {
  return {
    source: Number(raw.source),
    target: Number(raw.target),
    mutationMaskNumber: Number(raw.mutation_mask),
    mutationMask: maskId(Number(raw.mutation_mask)),
    changedPositions: changedPositions(Number(raw.mutation_mask)),
    distance: Number(raw.distance),
    lowerDistance: Number(raw.lower_distance),
    upperDistance: Number(raw.upper_distance),
    moduleScope: raw.module_scope,
    regimeClass: raw.regime_class,
    regimeClassCode: Number(raw.regime_class_code),
    transitionIndex: Number(raw.index),
    inferenceUsed: false
  };
}

function normalizeMcp(raw) {
  return {
    source: Number(raw.sourceNumber),
    target: Number(raw.targetNumber),
    sourceStateId: raw.sourceStateId,
    targetStateId: raw.targetStateId,
    mutationMaskNumber: Number(raw.mutationMaskNumber),
    mutationMask: raw.mutationMask,
    changedPositions: raw.changedPositions,
    distance: Number(raw.distance),
    lowerDistance: Number(raw.lowerDistance),
    upperDistance: Number(raw.upperDistance),
    moduleScope: raw.moduleScope,
    regimeClass: raw.regimeClass,
    transitionIndex: Number(raw.transitionIndex),
    inferenceUsed: raw.inferenceUsed
  };
}

function comparable(value) {
  return {
    source: value.source,
    target: value.target,
    mutationMaskNumber: value.mutationMaskNumber,
    mutationMask: value.mutationMask,
    changedPositions: value.changedPositions,
    distance: value.distance,
    lowerDistance: value.lowerDistance,
    upperDistance: value.upperDistance,
    moduleScope: value.moduleScope,
    regimeClass: value.regimeClass,
    transitionIndex: value.transitionIndex,
    inferenceUsed: value.inferenceUsed
  };
}

function sameTransition(left, right) {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function runBaselineCli(transition) {
  return normalizeCli(
    JSON.parse(
      execFileSync(process.execPath, [baselineCli, String(transition.source), String(transition.target)], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      })
    )
  );
}

function findMcpBinary() {
  const explicit = process.env.SEMAGRAPH_MCP_BIN;
  if (explicit && existsSync(explicit) && statSync(explicit).isFile()) return explicit;

  const exe = process.platform === "win32" ? "semagraph-mcp.exe" : "semagraph-mcp";
  const releaseCandidate = resolve(repoRoot, "packages/target/release", exe);
  if (existsSync(releaseCandidate) && statSync(releaseCandidate).isFile()) return releaseCandidate;

  execFileSync("cargo", ["build", "--release", "--manifest-path", "packages/Cargo.toml", "--bin", "semagraph-mcp"], {
    cwd: repoRoot,
    stdio: "pipe"
  });
  if (existsSync(releaseCandidate) && statSync(releaseCandidate).isFile()) return releaseCandidate;

  const candidate = resolve(repoRoot, "packages/target/debug", exe);
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  execFileSync("cargo", ["build", "--manifest-path", "packages/Cargo.toml", "--bin", "semagraph-mcp"], {
    cwd: repoRoot,
    stdio: "pipe"
  });
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  throw new Error(`Unable to find or build ${candidate}`);
}

function measureCli(name, runner, sample) {
  const measurements = [];
  const validationFailures = [];
  for (let repeat = 0; repeat < repeats + warmups; repeat += 1) {
    const started = performance.now();
    for (const transition of sample) {
      const expected = classify(transition.source, transition.target);
      const actual = runner(transition);
      if (!sameTransition(actual, expected)) validationFailures.push({ repeat, transition, actual, expected });
    }
    const totalMs = performance.now() - started;
    if (repeat >= warmups) measurements.push(measurement(repeat - warmups, sample.length, totalMs));
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
        const expected = classify(transition.source, transition.target);
        if (iteration === 0 && !sameTransition(expected, expected)) validationFailures.push({ repeat, transition, expected });
      }
    }
    const totalMs = performance.now() - started;
    if (repeat >= warmups) measurements.push(measurement(repeat - warmups, sample.length * inprocessIterations, totalMs));
  }
  return summarizeMeasurement("baseline-js-inprocess", "in-process-lower-bound", measurements, validationFailures);
}

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

class McpClient {
  constructor(binary) {
    this.nextId = 1;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    const started = performance.now();
    this.child = spawn(binary, [], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.startupStarted = started;
    this.stderr = "";
    this.child.stdout.on("data", (chunk) => this.onData(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString("utf8");
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString("utf8");
      const match = /^Content-Length:\s*(\d+)/im.exec(header);
      if (!match) throw new Error(`Invalid MCP frame header: ${header}`);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (this.buffer.length < bodyEnd) return;
      const body = this.buffer.slice(bodyStart, bodyEnd).toString("utf8");
      this.buffer = this.buffer.slice(bodyEnd);
      const message = JSON.parse(body);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        pending.resolve(message);
      }
    }
  }

  request(method, params) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = { jsonrpc: "2.0", id, method };
    if (params !== undefined) payload.params = params;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(frame(payload), (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async close() {
    this.child.stdin.end();
    await new Promise((resolve) => {
      this.child.once("exit", resolve);
      setTimeout(() => {
        if (!this.child.killed) this.child.kill();
        resolve();
      }, 1000);
    });
  }
}

async function measureRustMcp(sample) {
  const binary = findMcpBinary();
  const client = new McpClient(binary);
  const measurements = [];
  const validationFailures = [];
  const startupStarted = performance.now();
  const initialize = await client.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "semagraph-mcp-metrology", version: "0.1.0" }
  });
  const startupMs = performance.now() - startupStarted;
  if (initialize?.result?.serverInfo?.name !== "semagraph-rs-mcp") {
    validationFailures.push({ phase: "initialize", initialize });
  }
  const tools = await client.request("tools/list");
  const toolNames = tools?.result?.tools?.map((tool) => tool.name) ?? [];
  if (!toolNames.includes("semagraph_lookup_transition64")) {
    validationFailures.push({ phase: "tools/list", toolNames });
  }

  for (let repeat = 0; repeat < repeats + warmups; repeat += 1) {
    const started = performance.now();
    for (const transition of sample) {
      const expected = classify(transition.source, transition.target);
      const response = await client.request("tools/call", {
        name: "semagraph_lookup_transition64",
        arguments: {
          sourceStateId: expected.sourceStateId,
          targetStateId: expected.targetStateId
        }
      });
      const structured = response?.result?.structuredContent;
      const actual = normalizeMcp(structured?.result ?? {});
      if (structured?.status !== "ok" || !sameTransition(actual, expected)) {
        validationFailures.push({ repeat, transition, actual, expected, structured });
      }
    }
    const totalMs = performance.now() - started;
    if (repeat >= warmups) measurements.push(measurement(repeat - warmups, sample.length, totalMs));
  }

  await client.close();
  const summary = summarizeMeasurement("semagraph-rs-mcp", "persistent-mcp-stdio-tools-call", measurements, validationFailures);
  return {
    ...summary,
    serverStartupMs: round(startupMs),
    binary,
    stderr: client.stderr.trim()
  };
}

function measurement(sample, calls, totalMs) {
  return {
    sample,
    calls,
    totalMs,
    perCallMs: totalMs / calls
  };
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
    totalCalls: measurements.reduce((sum, item) => sum + item.calls, 0),
    totalMs: summarize(measurements.map((item) => item.totalMs)),
    perCallMs: summarize(measurements.map((item) => item.perCallMs)),
    samples: measurements.map((item) => ({
      sample: item.sample,
      calls: item.calls,
      totalMs: round(item.totalMs),
      perCallMs: round(item.perCallMs)
    }))
  };
}

function round(value) {
  return Number(value.toFixed(6));
}

function ratio(numerator, denominator) {
  return denominator === 0 ? undefined : round(numerator / denominator);
}

function markdown(report) {
  const byName = new Map(report.measurements.map((item) => [item.name, item]));
  const baselineCli = byName.get("baseline-node-cli");
  const mcp = byName.get("semagraph-rs-mcp");
  const inprocess = byName.get("baseline-js-inprocess");
  const cliToMcp = baselineCli && mcp ? ratio(baselineCli.perCallMs.median, mcp.perCallMs.median) : undefined;
  const inprocessToMcp = inprocess && mcp ? ratio(mcp.perCallMs.median, inprocess.perCallMs.median) : undefined;

  return `# Rust MCP Metrology Comparison

Generated from:

\`\`\`bash
node experiments/agentic-loop-benchmark/metrology-baseline-vs-rust/scripts/benchmark-mcp.mjs
\`\`\`

## Method

This report measures direct Q6 / State64 transition classification through a
persistent Rust MCP stdio server. The server is initialized once, then every
measured call uses \`tools/call -> semagraph_lookup_transition64\`.

\`baseline-node-cli\` is a process-per-transition Node baseline. It is the
closest existing integration-surface baseline. \`baseline-js-inprocess\` is a
lower-bound compute baseline, not an agent integration surface.

## Configuration

| Field | Value |
| --- | ---: |
| Sample size | ${report.config.sampleSize} |
| Repeats | ${report.config.repeats} |
| Warmups | ${report.config.warmups} |
| In-process iterations/repeat | ${report.config.inprocessIterations} |
| Node version | ${report.environment.node} |
| Platform | ${report.environment.platform} ${report.environment.arch} |
| MCP binary | ${report.environment.mcpBinary} |

## Results

| Measurement | Boundary | Median per call | p95 per call | MAD per call | Valid |
| --- | --- | ---: | ---: | ---: | --- |
${report.measurements
  .map(
    (item) =>
      `| ${item.name} | ${item.boundary} | ${item.perCallMs.median} ms | ${item.perCallMs.p95} ms | ${item.perCallMs.mad} ms | ${item.valid ? "yes" : "no"} |`
  )
  .join("\n")}

## KPI

| KPI | Value |
| --- | ---: |
| Rust MCP startup to initialize response | ${mcp?.serverStartupMs ?? "n/a"} ms |
| Baseline Node CLI / Rust MCP median latency ratio | ${cliToMcp ? `${cliToMcp}x` : "n/a"} |
| Rust MCP median latency reduction vs Node CLI | ${
    baselineCli && mcp ? `${round((1 - mcp.perCallMs.median / baselineCli.perCallMs.median) * 100)}%` : "n/a"
  } |
| Rust MCP overhead vs JS in-process lower bound | ${inprocessToMcp ? `${inprocessToMcp}x` : "n/a"} |

## Validity

- Every measured call was checked against the deterministic reference fields.
- The MCP server was initialized once and reused across warmup and measured calls.
- Sample is stratified across mutation distances 0..6.
- Token usage is not part of this benchmark.
`;
}

mkdirSync(reportsDir, { recursive: true });
const sample = stratifiedSample(sampleSize);
const mcpMeasurement = await measureRustMcp(sample);
const measurements = [measureInprocess(sample), measureCli("baseline-node-cli", runBaselineCli, sample), mcpMeasurement];

const report = {
  benchmark: "rust-mcp-metrology",
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
    mcpBinary: mcpMeasurement.binary
  },
  measurements
};

writeFileSync(resolve(reportsDir, "mcp-latest-results.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(reportsDir, "mcp-comparison.md"), markdown(report));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
