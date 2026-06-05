# Prompt 07 — Policy-only LLM boundary

Define or review the boundary where an LLM may consume computed transition signatures to draft policy text. Do not allow the LLM to assign observed states, infer measurements or mutate deterministic transition chains.

Deliverables:

- policy synthesis input contract;
- policy synthesis output contract;
- validation notes;
- fixtures where the LLM output is rejected because it tries to alter the computed signature.
