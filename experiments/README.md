# SemaGraph experiments

The experiments make the paper's research questions executable without moving
experimental policy into the authoritative kernel. They use declared synthetic
fixtures, registered mathematical anchors and the real State64/trajectory APIs.

Run the current baseline from the repository root:

```bash
pnpm test:epistemic-compression
```

The evaluator reports five surfaces:

- [`semantic-collision/`](semantic-collision/) - lexical and structural identity;
- [`anchor-comparison/`](anchor-comparison/) - agreement between registered
  projections over identical admitted evidence;
- [`projection-distortion/`](projection-distortion/) - collision, entropy and
  provenance coverage under `Q6`;
- [`decision-preservation/`](decision-preservation/) - declared task decisions
  and pairwise rankings before and after projection;
- [`trajectory-equivalence/`](trajectory-equivalence/) - collapse at endpoint,
  net-mutation, shape and exact-path identity levels.

Every result is fixture-relative. A passing self-check establishes that the
measurement harness is internally consistent, not that the paper's H1-H5
hypotheses have been empirically confirmed.

The first committed run is summarized in
[`reports/epistemic-compression-baseline.md`](reports/epistemic-compression-baseline.md).
