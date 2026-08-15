# semagraph — tool description (for LLM agents)

> A deterministic compression layer for state-transition trajectories in complex
> stochastic systems, where sampling cost is the bottleneck and path-dependence
> is structural.

This document is the machine-readable contract for the `semagraph` CLI. It tells
you, an agent, when and how to call the tool, what it does NOT do, and the exact
input/output of every subcommand. Field names under `--json` are stable: treat
them as a public API.

## What this tool is

`semagraph` is a CLI tool that classifies and compresses state-transition
trajectories over a six-bit state alphabet (64 states, 4096 transitions). It is
deterministic: the same input always yields the same output. It performs no
inference, no interpretation, and no network calls. It computes structural facts
(distances, regime classes, run-collapsed shapes, canonical keys) and prints
them; it never explains what they mean for your domain.

## When to call this tool

- Call `semagraph classify <source> <target>` when you need the structural
  classification of one transition between two known six-bit states, without
  reasoning about it yourself.
- Call `semagraph compress <s0> <s1> ... <sN>` when you have a known ordered
  sequence of states and need its canonical signature (shape, dwell, keys).
- Call `semagraph compare <a..> -- <b..>` when you need to know the structural
  relation between two trajectories (equivalent, same form, different pattern,
  or different trajectory).
- Call `semagraph batch` when you have many trajectories to process at once:
  pipe one JSON array per line on stdin, read one result object per line on
  stdout.
- Call `semagraph lookup <index>` when you stored a transition index and need to
  recover its full record.
- Call `semagraph verify` as a post-install health check.

Always pass `--json` when you will parse the output.

## When NOT to call this tool

- Do not call `semagraph` to reconstruct a trajectory from its endpoints alone —
  that is not possible and the tool does not attempt it. Endpoints are a lossy
  projection.
- Do not call `semagraph` to interpret what a regime class (e.g.
  `cross_module_regime_shift`) means for your domain. The tool labels; the
  interpretation is your responsibility.
- Do not use `net_mutation` or `endpoint_code` as a trajectory or form identity.
  They are coarse pre-filters (8 and 64 buckets respectively). Use `shape_key`
  for form identity and `exact_key` for full trajectory identity.
- Do not expect any network, storage, or stateful behaviour. Every call is pure.

## TypeScript mathematical-anchor tool surface

The stable Rust CLI described below remains the domain-neutral finite terminal.
The TypeScript MCP/function-tool adapter additionally exposes the upstream
registered mathematical-anchor layer:

| operation | deterministic role |
|---|---|
| `semagraph_validate_math_anchor` | validate a candidate domain/anchor contract; never register it |
| `semagraph_formalize_observations` | apply one exact registered anchor version to supplied evidence |
| `semagraph_anchor_formalized_state64` | verify replay lineage and apply the registered six-predicate projection |
| `semagraph_inspect_anchor_trace` | return predicate → formal variable/relation → binding → evidence for one bit |

These operations never choose an anchor. Registry bundles contain immutable
definitions already marked `registered` by an external authority. Candidate
generation and ambiguity resolution stay outside the deterministic tool. The
historical `semagraph_anchor_state64` operation remains available as
`deterministic_observed_parameters`; it is not silently reclassified as a
registered mathematical anchor.

## Input constraints

- **Q6 states** (for `classify`) are integers `0..=63`.
- **Q3 states** (for `compress`, `compare`, `batch` trajectories) are integers
  `0..=7`.
- A **trajectory requires at least 2 states**.
- The `--` separator between the two paths in `compare` is **required**.
- A **transition index** (for `lookup`) is an integer `0..=4095`.
- `classify` and `lookup` operate on the Q6 transition space, because the module
  scope and regime class are properties of the 3+3 module structure of a six-bit
  state. `compress`, `compare`, and `batch` operate on Q3 trajectories.

Invalid input is reported on stderr with a non-zero exit code; stdout stays clean.

## Output contract

Data is written to **stdout**; errors to **stderr**; exit code `0` means success,
non-zero means failure (`2` for usage/argument errors, `1` for data/validation
errors). Under `--json`, output is compact single-line JSON (one object; for
`batch`, one object per line).

### `classify` / `lookup` fields

| field | type | range | meaning |
|---|---|---|---|
| `source` | int | 0..63 | source Q6 state |
| `target` | int | 0..63 | target Q6 state |
| `mutation_mask` | int | 0..63 | `source XOR target` |
| `distance` | int | 0..6 | popcount of the mask (Hamming distance) |
| `lower_distance` | int | 0..3 | distance within the high three-bit module |
| `upper_distance` | int | 0..3 | distance within the low three-bit module |
| `module_scope` | string | enum | `none` / `lower_only` / `upper_only` / `both_modules` |
| `regime_class` | string | enum | regime label (see below) |
| `regime_class_code` | int | 0..5 | numeric code of the regime label |
| `index` | int | 0..4095 | `source * 64 + target` |
| `packed` | string | — | the 64-bit FFI word, decimal, as a string |

`regime_class` is one of: `no_change` (0), `bit_adjustment` (1),
`module_reconfiguration` (2), `cross_module_regime_shift` (3),
`near_total_inversion` (4), `full_bit_reversal` (5).

### `compress` / `batch` fields

| field | type | meaning |
|---|---|---|
| `path` | int[] | the input trajectory (Q3 states) |
| `length.states` | int | number of states |
| `length.transitions` | int | number of steps (states − 1) |
| `net_mutation` | int 0..7 | XOR-fold of step masks; **8 buckets, coarse filter only** |
| `cumulative_distance` | int | sum of step popcounts (total traversal effort) |
| `endpoint.source` | int 0..7 | first state |
| `endpoint.target` | int 0..7 | last state |
| `endpoint.code` | int 0..63 | oriented endpoint code `first*8 + last` (a T64 edge, **not** a state); **64 buckets, coarse filter only** |
| `shape` | int[] | run-collapsed shape (adjacent duplicates merged) |
| `dwell` | int[] | dwell per run, aligned to `shape` |
| `exact_key` | string | `P3:` + dotted full path — **full trajectory identity** |
| `shape_key` | string | `S3:` + dotted shape — **form identity** |
| `dwell_signature` | string | `D3:` + dotted dwell — **duration identity** |

Run-collapse is adjacent-only: `[0,1,1,3]` → shape `[0,1,3]`, dwell `[1,2,1]`;
`[0,1,0,3]` does NOT collapse (non-adjacent repeat) and stays `[0,1,0,3]`.

### `compare` fields

| field | type | meaning |
|---|---|---|
| `relation` | string | `equivalent` / `same_form_different_duration` / `different_pattern` / `different_trajectory` |
| `same_endpoint` | bool | endpoints equal |
| `same_shape` | bool | run-collapsed shapes equal (the form decision) |
| `same_dwell` | bool | dwell signatures equal |
| `path_a`, `path_b` | object | `exact_key`, `shape_key`, `dwell_signature` for each |

There is **no `rationale` field in JSON output** — that is human-facing only.

### `verify` fields

`{"verified": <int>, "total": 4096, "ok": <bool>}`. Exit 0 iff `ok` is true.

## Collapse factor table

| projection | values | use |
|---|---|---|
| `net_mutation` | 8 | coarse pre-filter only |
| `endpoint_code` | 64 | medium pre-filter only |
| `shape_key` | unbounded, injective on run-collapsed shape | form identity |
| `exact_key` | unbounded, injective on full path | trajectory identity |
| `dwell_signature` | unbounded | duration identity |

No lossy projection (`net_mutation`, `endpoint_code`) may serve as a form key.
`shape_key` decides form; `exact_key` decides full identity.

## Example calls and outputs

### Classify one transition

```bash
semagraph classify 5 2 --json
```
```json
{"source":5,"target":2,"mutation_mask":7,"distance":3,"lower_distance":0,"upper_distance":3,"module_scope":"upper_only","regime_class":"cross_module_regime_shift","regime_class_code":3,"index":322,"packed":"346240610437"}
```

### Compress a trajectory

```bash
semagraph compress 0 1 1 3 --json
```
```json
{"path":[0,1,1,3],"length":{"states":4,"transitions":3},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,1,3],"dwell":[1,2,1],"exact_key":"P3:0.1.1.3","shape_key":"S3:0.1.3","dwell_signature":"D3:1.2.1"}
```

### Process an ensemble (NDJSON in, NDJSON out)

```bash
printf '[0,1,3]\n[0,1,1,3]\n[0,2,3]\n' | semagraph batch
```
```
{"path":[0,1,3],"length":{"states":3,"transitions":2},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,1,3],"dwell":[1,1,1],"exact_key":"P3:0.1.3","shape_key":"S3:0.1.3","dwell_signature":"D3:1.1.1"}
{"path":[0,1,1,3],"length":{"states":4,"transitions":3},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,1,3],"dwell":[1,2,1],"exact_key":"P3:0.1.1.3","shape_key":"S3:0.1.3","dwell_signature":"D3:1.2.1"}
{"path":[0,2,3],"length":{"states":3,"transitions":2},"net_mutation":3,"cumulative_distance":2,"endpoint":{"source":0,"target":3,"code":3},"shape":[0,2,3],"dwell":[1,1,1],"exact_key":"P3:0.2.3","shape_key":"S3:0.2.3","dwell_signature":"D3:1.1.1"}
```

Group an ensemble by `shape_key` to get the empirical distribution over
trajectory forms; trajectories with the same `shape_key` share a form regardless
of dwell.
