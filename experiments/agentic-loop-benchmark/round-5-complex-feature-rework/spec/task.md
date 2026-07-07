# Task: policy-transition-workbench

Build a TypeScript CLI named `policy-transition-workbench`.

Input: a JSON file with canonical State64 chains and comparison pairs:

```json
{
  "scenarios": [
    {
      "id": "alpha",
      "states": ["S64-000000", "S64-100000", "S64-101000"],
      "objective": "stabilize alpha"
    }
  ],
  "comparePairs": [{ "left": "alpha", "right": "beta" }]
}
```

Output JSON must contain:

- `scenarios`
- `aggregate`
- `comparisons`
- `policyQueue`

## Required Scenario Fields

Each scenario output must include:

- `id`
- `sourceStateId`
- `targetStateId`
- `states`
- `transitionCount`
- `orderedMutationMasks`
- `netMutationMask`
- `cumulativeDistance`
- `netDistance`
- `dominantRegimeClass`
- `volatilityClass`
- `policyReadiness`
- `signature`
- `summary`

## Required Aggregate Fields

The aggregate output must include:

- `scenarioCount`
- `totalTransitions`
- `totalCumulativeDistance`
- `averageCumulativeDistance`
- `maxCumulativeDistanceScenarioIds`
- `volatilityHistogram`
- `dominantRegimeHistogram`
- `netMutationHistogram`

## Required Comparison Fields

For each pair:

- `left`
- `right`
- `sameNetMutationMask`
- `sameDominantRegimeClass`
- `sameVolatilityClass`
- `cumulativeDistanceDelta`
- `sharedOrderedMutationMaskCount`
- `sharedStateCount`

## Required Policy Queue Fields

For each scenario except `calm-zero`, emit:

- `scenarioId`
- `triggerSignature`
- `objective`
- `priority`
- `allowedActions`
- `forbiddenActions`
- `reviewRequired`

## Deterministic Rules

- State ids must match exactly `S64-[01]{6}`.
- Mutation masks must match exactly `M64-[01]{6}`.
- `orderedMutationMasks` are one mask per adjacent state pair.
- `netMutationMask` is the XOR of ordered masks, equivalent to source vs target.
- `cumulativeDistance` is the sum of Hamming distances for every adjacent pair.
- `netDistance` is the Hamming distance of `netMutationMask`.
- `signature` is:

```text
C64:<sourceStateId>><targetStateId>|M:<orderedMutationMasks joined by ".">|N:<netMutationMask>
```

- `dominantRegimeClass` is the most frequent transition regime class; ties are
  resolved by highest cumulative distance contributed by that class, then by
  lexical order.
- `volatilityClass` is:
  - `calm` when `cumulativeDistance <= 3`
  - `active` when `cumulativeDistance <= 7`
  - `volatile` otherwise
- `policyReadiness` is:
  - `hold` for `calm`
  - `review` for `active`
  - `escalate` for `volatile`
- Policy priority is:
  - `low` for `calm`
  - `normal` for `active`
  - `high` for `volatile`
- `allowedActions` may be domain-neutral strings only.
- `forbiddenActions` must include:
  - `do not infer observations`
  - `do not mutate State64 ids`
  - `do not override deterministic signatures`
- No observations may be inferred.

## Variants

### no-mcp

Do not call SemaGraph packages, CLI, or MCP. Implement the deterministic math
from the spec.

### rust-mcp

Use the Rust MCP server for deterministic facts when useful. The model may
synthesize policy queue text only after deterministic transition/chain
compression.
