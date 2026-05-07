import type {
  NormalizedRenderOptions,
  RenderableLine,
  RenderableLineValue,
  RenderableState64,
  RenderableTrigram,
  RenderOptions
} from "./types.js";

export function normalizeOptions(options: RenderOptions = {}): NormalizedRenderOptions {
  return {
    width: options.width ?? 120,
    strokeWidth: options.strokeWidth ?? 8,
    lineGap: options.lineGap ?? 16,
    yinGapRatio: options.yinGapRatio ?? 0.22,
    stroke: options.stroke ?? "currentColor",
    movingMarker: options.movingMarker ?? true
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderLineValue(value: RenderableLineValue, y: number, options: NormalizedRenderOptions): string {
  const { width, strokeWidth, yinGapRatio, stroke } = options;
  const escapedStroke = escapeAttribute(stroke);

  if (value === "yang") {
    return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${escapedStroke}" stroke-width="${strokeWidth}" stroke-linecap="square" />`;
  }

  const gap = width * yinGapRatio;
  const segment = (width - gap) / 2;

  return [
    `<line x1="0" y1="${y}" x2="${segment}" y2="${y}" stroke="${escapedStroke}" stroke-width="${strokeWidth}" stroke-linecap="square" />`,
    `<line x1="${segment + gap}" y1="${y}" x2="${width}" y2="${y}" stroke="${escapedStroke}" stroke-width="${strokeWidth}" stroke-linecap="square" />`
  ].join("");
}

export function renderLine(line: RenderableLine, y: number, options: NormalizedRenderOptions): string {
  const base = renderLineValue(line.value, y, options);
  if (!line.moving || !options.movingMarker) return base;

  const radius = Math.max(2, options.strokeWidth / 2);
  const cx = options.width + options.strokeWidth * 2;
  return `${base}<circle cx="${cx}" cy="${y}" r="${radius}" fill="${escapeAttribute(options.stroke)}" />`;
}

export function renderTrigram(trigram: RenderableTrigram, options: RenderOptions = {}): string {
  const normalized = normalizeOptions(options);
  const height = normalized.lineGap * 2 + normalized.strokeWidth;
  const viewBoxWidth = normalized.width + normalized.strokeWidth * 5;

  // Visual rendering places the top line first, but input lines are bottom-up.
  const body = [...trigram.lines]
    .reverse()
    .map((value, visualIndex) => renderLineValue(value, visualIndex * normalized.lineGap + normalized.strokeWidth / 2, normalized))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${height}" role="img" aria-label="${escapeAttribute(trigram.label)}">${body}</svg>`;
}

export function renderState64(state: RenderableState64, options: RenderOptions = {}): string {
  const normalized = normalizeOptions(options);
  const height = normalized.lineGap * 5 + normalized.strokeWidth;
  const viewBoxWidth = normalized.width + normalized.strokeWidth * 5;

  const body = [...state.lines]
    .reverse()
    .map((value, visualIndex) => renderLineValue(value, visualIndex * normalized.lineGap + normalized.strokeWidth / 2, normalized))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${height}" role="img" aria-label="${escapeAttribute(state.id)}">${body}</svg>`;
}
