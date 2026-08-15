# Task

Review every scenario in `fixtures/scenarios.json` under the SemaGraph
mathematical-anchor boundary.

Return JSON with this shape:

```json
{
  "outcomes": [
    {
      "id": "scenario id",
      "action": "keep_distinct | structurally_comparable | reject | replay | preserve_ambiguity",
      "selectedAnchor": "anchor id or null",
      "authoritativeState": "S64-xxxxxx or null",
      "reasonCode": "stable machine reason"
    }
  ]
}
```

Rules:

- lexical equality is not mathematical-anchor equality;
- structural comparability is not semantic identity;
- incompatible units or assumptions remain distinguishable;
- replay uses the historical immutable anchor version;
- required missing observations/evidence reject authoritative projection;
- a set of plausible candidates remains ambiguous until an external authority
  registers one;
- never infer a missing fact or choose “the best” ontology.
