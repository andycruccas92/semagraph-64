export type RenderOptions = {
  width?: number;
  strokeWidth?: number;
  rowGap?: number;
  zeroGapRatio?: number;
  stroke?: string;
  mutationMarker?: boolean;
};

export type NormalizedRenderOptions = Required<RenderOptions>;
export type RenderableBit = 0 | 1;

export type RenderableBitRow = {
  value: RenderableBit;
  mutated?: boolean;
};

export type RenderableBitModule3 = {
  label: string;
  bits: readonly [RenderableBit, RenderableBit, RenderableBit];
};

export type RenderableBinaryState64 = {
  id: string;
  bits: readonly [RenderableBit, RenderableBit, RenderableBit, RenderableBit, RenderableBit, RenderableBit];
};
