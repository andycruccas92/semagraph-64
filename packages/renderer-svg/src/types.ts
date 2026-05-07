export type RenderOptions = {
  width?: number;
  strokeWidth?: number;
  lineGap?: number;
  yinGapRatio?: number;
  stroke?: string;
  movingMarker?: boolean;
};

export type NormalizedRenderOptions = Required<RenderOptions>;

export type RenderableLineValue = "yin" | "yang";

export type RenderableLine = {
  value: RenderableLineValue;
  moving?: boolean;
};

export type RenderableTrigram = {
  label: string;
  lines: readonly [RenderableLineValue, RenderableLineValue, RenderableLineValue];
};

export type RenderableState64 = {
  id: string;
  lines: readonly [
    RenderableLineValue,
    RenderableLineValue,
    RenderableLineValue,
    RenderableLineValue,
    RenderableLineValue,
    RenderableLineValue
  ];
};
