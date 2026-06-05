# Neutral Binary Visual Grammar

The renderer displays zero and one as row primitives. The visual layer is not a source of semantic authority. It exists only to make six-bit states and three-bit modules inspectable by humans.

A `1` is rendered as a continuous row. A `0` is rendered as a split row. This is a visual encoding choice, not a symbolic claim.

```text
1 = continuous mark
0 = split mark
```

Rows are rendered from the upper visual row downward while bit order remains deterministic in the adapter. Any domain-specific orientation must be declared separately.
