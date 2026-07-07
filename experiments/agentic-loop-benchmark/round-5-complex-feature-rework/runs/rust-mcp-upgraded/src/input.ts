import { readFileSync } from "node:fs";

export const EXCLUDED_POLICY_SCENARIO_IDS = ["calm-zero"] as const;
const STATE_ID_PATTERN = /^S64-[01]{6}$/;

export type ScenarioInput = {
  id: string;
  states: string[];
  objective?: string;
};

export type ComparePairInput = {
  left: string;
  right: string;
};

export type WorkbenchInput = {
  scenarios: ScenarioInput[];
  comparePairs: ComparePairInput[];
};

export type WorkbenchArgs = WorkbenchInput & {
  excludePolicyScenarioIds: string[];
};

export class WorkbenchError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

export function loadWorkbenchInput(path: string): WorkbenchInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new WorkbenchError(`Failed to read or parse input JSON: ${detail}`);
  }
  validateWorkbenchInput(parsed);
  return parsed;
}

export function buildWorkbenchArgs(input: WorkbenchInput): WorkbenchArgs {
  return {
    scenarios: input.scenarios,
    comparePairs: input.comparePairs,
    excludePolicyScenarioIds: [...EXCLUDED_POLICY_SCENARIO_IDS]
  };
}

function validateWorkbenchInput(value: unknown): asserts value is WorkbenchInput {
  if (!isRecord(value)) {
    throw new WorkbenchError("Input must be a JSON object.");
  }
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
    throw new WorkbenchError("Input field 'scenarios' must be a non-empty array.");
  }
  if (!Array.isArray(value.comparePairs)) {
    throw new WorkbenchError("Input field 'comparePairs' must be an array.");
  }

  const scenarioIds = new Set<string>();
  for (const [index, scenario] of value.scenarios.entries()) {
    if (!isRecord(scenario)) {
      throw new WorkbenchError(`Scenario at index ${index} must be an object.`);
    }
    if (typeof scenario.id !== "string" || scenario.id.trim() === "") {
      throw new WorkbenchError(`Scenario at index ${index} requires a non-empty string id.`);
    }
    if (scenarioIds.has(scenario.id)) {
      throw new WorkbenchError(`Duplicate scenario id '${scenario.id}'.`);
    }
    scenarioIds.add(scenario.id);

    if (!Array.isArray(scenario.states) || scenario.states.length < 2) {
      throw new WorkbenchError(`Scenario '${scenario.id}' requires at least two states.`);
    }
    for (const state of scenario.states) {
      if (typeof state !== "string" || !STATE_ID_PATTERN.test(state)) {
        throw new WorkbenchError(`Scenario '${scenario.id}' has invalid canonical State64 id '${String(state)}'.`);
      }
    }
    if ("objective" in scenario && typeof scenario.objective !== "string") {
      throw new WorkbenchError(`Scenario '${scenario.id}' objective must be a string when present.`);
    }
  }

  for (const [index, pair] of value.comparePairs.entries()) {
    if (!isRecord(pair) || typeof pair.left !== "string" || typeof pair.right !== "string") {
      throw new WorkbenchError(`Compare pair at index ${index} must contain string left and right ids.`);
    }
    if (!scenarioIds.has(pair.left)) {
      throw new WorkbenchError(`Compare pair at index ${index} references unknown left scenario '${pair.left}'.`);
    }
    if (!scenarioIds.has(pair.right)) {
      throw new WorkbenchError(`Compare pair at index ${index} references unknown right scenario '${pair.right}'.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
