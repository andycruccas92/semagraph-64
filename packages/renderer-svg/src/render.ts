import type { NormalizedRenderOptions, RenderableBinaryState64, RenderableBit, RenderableBitModule3, RenderableBitRow, RenderOptions } from "./types.js";

export function normalizeOptions(options: RenderOptions = {}): NormalizedRenderOptions {
  return {
    width: options.width ?? 120,
    strokeWidth: options.strokeWidth ?? 8,
    rowGap: options.rowGap ?? 16,
    zeroGapRatio: options.zeroGapRatio ?? 0.22,
    stroke: options.stroke ?? "currentColor",
    mutationMarker: options.mutationMarker ?? true
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderBitValue(value: RenderableBit, y: number, options: NormalizedRenderOptions): string {
  const { width, strokeWidth, zeroGapRatio, stroke } = options;
  const escapedStroke = escapeAttribute(stroke);

  if (value === 1) {
    return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${escapedStroke}" stroke-width="${strokeWidth}" stroke-linecap="square" />`;
  }

  const gap = width * zeroGapRatio;
  const segment = (width - gap) / 2;

  return [
    `<line x1="0" y1="${y}" x2="${segment}" y2="${y}" stroke="${escapedStroke}" stroke-width="${strokeWidth}" stroke-linecap="square" />`,
    `<line x1="${segment + gap}" y1="${y}" x2="${width}" y2="${y}" stroke="${escapedStroke}" stroke-width="${strokeWidth}" stroke-linecap="square" />`
  ].join("");
}

export function renderBitRow(row: RenderableBitRow, y: number, options: NormalizedRenderOptions): string {
  const base = renderBitValue(row.value, y, options);
  if (!row.mutated || !options.mutationMarker) return base;

  const radius = Math.max(2, options.strokeWidth / 2);
  const cx = options.width + options.strokeWidth * 2;
  return `${base}<circle cx="${cx}" cy="${y}" r="${radius}" fill="${escapeAttribute(options.stroke)}" />`;
}

export function renderBitModule3(module: RenderableBitModule3, options: RenderOptions = {}): string {
  const normalized = normalizeOptions(options);
  const height = normalized.rowGap * 2 + normalized.strokeWidth;
  const viewBoxWidth = normalized.width + normalized.strokeWidth * 5;

  const body = [...module.bits]
    .reverse()
    .map((value, visualIndex) => renderBitValue(value, visualIndex * normalized.rowGap + normalized.strokeWidth / 2, normalized))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${height}" role="img" aria-label="${escapeAttribute(module.label)}">${body}</svg>`;
}

export function renderBinaryState64(state: RenderableBinaryState64, options: RenderOptions = {}): string {
  const normalized = normalizeOptions(options);
  const height = normalized.rowGap * 5 + normalized.strokeWidth;
  const viewBoxWidth = normalized.width + normalized.strokeWidth * 5;

  const body = [...state.bits]
    .reverse()
    .map((value, visualIndex) => renderBitValue(value, visualIndex * normalized.rowGap + normalized.strokeWidth / 2, normalized))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${height}" role="img" aria-label="${escapeAttribute(state.id)}">${body}</svg>`;
}
