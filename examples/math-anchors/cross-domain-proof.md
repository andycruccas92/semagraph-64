# Cross-domain mathematical-anchor proof of concept

These examples test one architectural claim only: radically different upstream
formalizations can share the deterministic State64 terminal without changing its
finite algebra. They do not establish semantic or ontological universality.

## 1. Engineering: thermal test rig

**Phenomenon.** A physical test rig moves between operating conditions.

**Semantic labels.** “temperature”, “vibration”, “pressure”, “outage”,
“efficiency”, and “reversibility”. These labels describe the source records; they
do not define the mathematics.

**Chosen structure.** A declared six-coordinate state space
(`structureKind = state_space`).

**Assumptions and scope.** Sensors follow calibration procedure C1; measurements
refer to rig TR-7 at one snapshot boundary; maintenance intervals are excluded.
Temperature is normalized to degrees Celsius, vibration to mm/s, pressure to bar,
and efficiency to a dimensionless ratio.

**Formalization map.** `φ_engineering` performs registered unit conversions and
binds each supplied measurement to its named coordinate. Every coordinate
requires an evidence reference.

**Projection.** In bit order: temperature ≥ 80 °C; vibration > 2 mm/s; pressure ≥
5 bar; outage is true; efficiency < 0.8; intervention is reversible.

| snapshot | observations after normalization | State64 |
|---|---|---|
| `t0` | 75, 1, 4.5, false, 0.85, true | `S64-000001` |
| `t1` | 85, 1, 6, false, 0.75, true | `S64-101011` |

The terminal transition is `S64-000001 → S64-101011` with canonical mutation
`M64-101010`. The kernel knows only those finite values; calibration, units, and
sensor evidence remain in the anchor trace.

## 2. Organizational decision: release feasibility

**Phenomenon.** A review board decides whether a release window satisfies six
independently recorded gates.

**Semantic labels.** “security approval”, “legal approval”, “budget”, “staffing”,
“rollback”, and “owner”. None is treated as a universal meaning of “value” or
“state”.

**Chosen structure.** A Boolean feasibility relation
(`structureKind = feasibility_relation`).

**Assumptions and scope.** Each gate record is final for one named review window;
draft records and later amendments are excluded; no missing gate defaults to
false or true.

**Formalization map.** `φ_decision` binds the six board records to six formal
Boolean variables. Evidence references point to immutable review-register
entries.

**Projection.** Each bit is 1 exactly when its corresponding formal gate is true.
For `[true, true, false, true, true, true]`, the result is `S64-110111`.

This use of a feasibility relation is not interchangeable with economic utility,
cost, or preference ranking even if a stakeholder calls every one of them
“value”.

## 3. Information/probabilistic monitoring

**Phenomenon.** A monitoring process summarizes the measured behaviour of a
declared predictive model.

**Semantic labels.** “error”, “uncertainty”, “information”, “drift”, and
“confidence”. The anchor does not infer what those words should mean.

**Chosen structure.** A declared probability distribution with registered
information relations (`structureKind = probability_distribution`).

**Assumptions and scope.** Samples come from one fixed evaluation window;
probability estimates use a declared estimator; entropy is measured in bits;
divergence is the registered divergence, not an arbitrary distance; incomplete
samples are rejected.

**Formalization map.** `φ_information` binds the observed error probability,
entropy, divergence, conditional probability, interval width, and completeness
flag to formal variables with evidence references to the evaluation artifact.

**Projection.** In bit order: error probability > 0.05; entropy > 0.5 bits;
divergence > 0.1; conditional probability > 0.2; interval width > 0.1; sample is
complete.

For `[0.08, 0.40, 0.12, 0.10, 0.06, true]`, the result is `S64-101001`.
Calling the divergence a “distance” would not make this anchor equal to the
engineering state space, a graph path length, or a decision cost.

## Shared terminal, separate upstream authority

All three examples finish with a canonical six-bit state and can therefore use
the unchanged 64×64 transition basis and trajectory compression. Their domain
definitions, assumptions, units, evidence, and predicate meanings remain
separate, versioned, and replayable upstream. Cross-domain comparison may report
a shared mathematical descriptor; it must not assert semantic identity.
