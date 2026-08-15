# Decision preservation

The fixture declares a weighted decision score over the richer six-number input.
For each registered projection, the evaluator applies the same weights to the six
projected bits and reports:

- binary decision preservation;
- pairwise ranking preservation;
- examples where compressed and rich decisions disagree.

Pairs tied only after compression count as not ranking-preserved, because the
richer representation distinguished them and the finite projection did not.

This is a deterministic diagnostic fixture, not an optimized classifier or an
empirical adequacy claim.
