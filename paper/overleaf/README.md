# SemaGraph paper (Overleaf)

`main.tex` is the explanatory SemaGraph paper. Upload it to Overleaf and compile
with pdfLaTeX (or run `pdflatex main.tex` twice locally for the table of contents
and references).

The paper is written in English with an extended Italian *sommario* near the
front, so it serves both a general overview and a detailed evaluation by
mathematicians, engineers and physicists. It defines the formal model (with short
proofs), the branchless/cache-resident and struct-of-arrays computational
architecture, the exhaustive cross-implementation parity methodology, the
evaluation hypotheses, the limits, and explicit non-claims. It states performance
expectations rather than fabricated numbers; measured figures live in
`packages/core-rs/BENCHMARKS.md`.

A compiled copy is kept at `../compiled/semagraph-v0.7-paper.pdf`.
