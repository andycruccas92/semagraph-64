# Prompt 10 — v0.6 Rust Core Parity and AI Tooling

You are working in the SemaGraph repo. Do not commit or open PRs.

Goal: harden v0.6 by checking Rust core feasibility, TypeScript numeric parity helpers and the AI kernel tool boundary.

Required checks:

1. Read `docs/13-v06-rust-core-feasibility-adr.md`, `docs/14-v06-ai-tool-boundary-adr.md`, `packages/core-rs/README.md`, and `ai-tools/semagraph-kernel-tool/README.md`.
2. If Rust is available, run `cargo test` in `packages/core-rs`.
3. Run TypeScript typechecks for kernel, state64-adapter, renderer-svg and ai kernel tool.
4. Confirm the OpenAI tool schemas do not allow free-form mutation of states/signatures.
5. Confirm Claude skill wording forbids LLM inference of observations.
6. Summarize modified files and validation results.

Do not change runtime semantics unless a compile failure requires it.
