# SemaGraph AI Kernel Tool

This package exposes SemaGraph v0.8 as a tool layer usable by GPT-style function tools, Claude skills, MCP hosts or a local CLI adapter.

The tool boundary is intentionally strict:

- candidate mathematical anchors can be validated but never promoted by a tool;
- registered mathematical anchors formalize observations and project State64 deterministically;
- the finite kernel performs transition lookup and chain compression;
- the LLM does not infer observations or mutate states;
- the LLM may synthesize policy only after the deterministic signature exists.

## Files

- `openai-tools.json`: function-tool schemas for GPT/OpenAI-style integration.
- `claude-skill/SKILL.md`: drop-in skill instruction for Claude-style tool use.
- `src/index.ts`: local TypeScript handler that dispatches tool calls to the SemaGraph State64 kernel.
- `src/cli.ts`: minimal CLI wrapper.
- `src/mcp.ts`: stdio MCP server exposing the deterministic tool schemas.

## Example CLI flow

```bash
pnpm --filter @semagraph/ai-kernel-tool build
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 ai-tools/semagraph-kernel-tool/examples/compress-chain.args.json
```

## MCP flow

```bash
pnpm --filter @semagraph/ai-kernel-tool build
node ai-tools/semagraph-kernel-tool/dist/mcp.js
```

The repository root `.mcp.json` registers this server as `semagraph` for MCP-aware hosts.

## Integration stance

The tool is not an autonomous analyst. It is a deterministic transition processor plus a policy-context builder. It can be safely used by an LLM only if the host system preserves this boundary.

The mathematical operations are:

- `semagraph_validate_math_anchor` — non-authoritative structural validation;
- `semagraph_formalize_observations` — apply an explicitly selected anchor from
  a supplied registry bundle;
- `semagraph_anchor_formalized_state64` — replay-check and project a formalized
  snapshot;
- `semagraph_inspect_anchor_trace` — explain one bit from retained deterministic
  lineage.

A registry bundle may contain only records whose authority is already
`registered`. The tool offers no operation that selects an anchor, resolves an
ambiguous ontology, or turns a candidate into a registered definition.
