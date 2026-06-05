# Prompt 09 — v0.5 State64 compression hardening

Harden the v0.5 mathematical State64 adapter.

Scope:

1. Strengthen tests for deterministic observed anchoring.
2. Verify the `64 x 64` transition matrix contains exactly 4096 entries.
3. Verify ordered chain compression and net mutation are kept distinct.
4. Verify renderer terminology remains binary-neutral.
5. Verify no LLM provider runtime or state-assignment path exists in the adapter.
