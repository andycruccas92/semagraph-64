# Research Notes

Primary hypothesis:

```text
Observed transformation chains can be compressed into deterministic binary signatures that preserve enough task-relevant structure to reduce repeated simulation, repeated interpretation and repeated policy drafting.
```

Testable questions:

1. Does signature processing reduce computation time versus full trajectory processing?
2. Does policy reuse by signature improve consistency?
3. How much decision-relevant information is lost by compression?
4. Which domains permit deterministic anchoring from observed measurements?
5. Which domains require uncertainty envelopes before anchoring is safe?

Core risk: false equivalence. Two chains may share a compressed signature while differing in causally relevant raw details. Raw chain retention is mandatory.
