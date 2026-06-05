# SemaGraph AI Kernel Tool

This package exposes SemaGraph v0.6 as a tool layer usable by GPT-style function tools, Claude skills or a local CLI adapter.

The tool boundary is intentionally strict:

- the kernel performs deterministic anchoring, transition lookup and chain compression;
- the LLM does not infer observations or mutate states;
- the LLM may synthesize policy only after the deterministic signature exists.

## Files

- `openai-tools.json`: function-tool schemas for GPT/OpenAI-style integration.
- `claude-skill/SKILL.md`: drop-in skill instruction for Claude-style tool use.
- `src/index.ts`: local TypeScript handler that dispatches tool calls to the SemaGraph State64 kernel.
- `src/cli.ts`: minimal CLI wrapper.

## Example CLI flow

```bash
pnpm --filter @semagraph/ai-kernel-tool build
node ai-tools/semagraph-kernel-tool/dist/cli.js semagraph_compress_chain64 ai-tools/semagraph-kernel-tool/examples/compress-chain.args.json
```

## Integration stance

The tool is not an autonomous analyst. It is a deterministic transition processor plus a policy-context builder. It can be safely used by an LLM only if the host system preserves this boundary.
