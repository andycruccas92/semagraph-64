# Initial Agentic Loop Comparison

Date: 2026-07-06

This is a pilot run comparing two background coding loops on the same deterministic
State64 transition-audit task.

## Summary

Both agents delivered a working TypeScript CLI. Both implementations passed the
shared fixture evaluation after the benchmark harness rebuilt them and executed
the same four-state chain.

This pilot does **not** show a speed advantage for the SemaGraph-assisted loop.
It does show a clearer deterministic checkpoint: the SemaGraph variant recorded
a tool oracle call with canonical mutation masks, net mask, cumulative distance
and `inferenceUsed: false`.

## Results

| Metric | Baseline | SemaGraph-assisted |
| --- | ---: | ---: |
| Shared fixture correct | yes | yes |
| Delivery duration from `agent-log.json` | 125.270s | 600.000s |
| Loop count | 2 | 2 |
| Rework events | 1 | 2 |
| SemaGraph tool calls | 0 | 1 |
| Token usage | not available | not available |

## Shared Fixture

Input:

```json
["S64-000000", "S64-100000", "S64-101000", "S64-101010"]
```

Expected comparable output:

```json
{
  "sourceStateId": "S64-000000",
  "targetStateId": "S64-101010",
  "states": [
    "S64-000000",
    "S64-100000",
    "S64-101000",
    "S64-101010"
  ],
  "transitionCount": 3,
  "changedMasks": [
    "M64-100000",
    "M64-001000",
    "M64-000010"
  ],
  "netMutationMask": "M64-101010",
  "cumulativeDistance": 3
}
```

Both variants matched these comparable fields.

## Observations

- Baseline implementation was correct and concise, but had one rework event from
  TypeScript strict-index checks plus sandboxed build-output writes.
- SemaGraph-assisted implementation was also correct, and its agent log includes
  a deterministic oracle call. Its own smoke fixture used a shorter chain, but
  the shared benchmark harness rebuilt and evaluated it against the common
  four-state fixture successfully.
- The SemaGraph-assisted duration is likely inflated by extra validation and
  delayed finalization. Treat this as a pilot datum, not a statistically useful
  speed measurement.
- Token usage was not available from the sub-agent interface in this run.

## Next Iteration

For a stronger public benchmark:

- run at least 10 paired tasks with randomized but fixed State64 fixtures;
- capture host-level token usage for each agent;
- separate model reasoning time from build/test time;
- require both agents to use the same smoke fixture from the benchmark spec;
- record exact command transcripts or structured event logs.
