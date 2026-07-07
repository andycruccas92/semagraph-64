# Round 6 Complex Anchor Choice Reconstruction

This benchmark compares a local JavaScript baseline with the updated Rust MCP
surface on complex observed-state anchoring and deterministic choice
reconstruction.

The fixture intentionally uses:

- numeric, boolean and string observations;
- mixed operators;
- inverted `trueBit` / `falseBit` mappings;
- source and unit metadata;
- an anchored State64 timeline that is later compressed into a transition
  packet.

The target output is not only the final state/transition result. It must also
reconstruct the deterministic choices used to reach the output:

- per-bit anchor decisions;
- consecutive transition choices;
- final output action chosen from deterministic transition volatility.

Run:

```bash
node experiments/agentic-loop-benchmark/round-6-complex-anchor-choice-reconstruction/scripts/evaluate.mjs
```
