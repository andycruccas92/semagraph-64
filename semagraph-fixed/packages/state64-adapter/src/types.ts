import type { ParameterDefinition, ParameterSnapshot, ParameterValue, Predicate } from "@semagraph/kernel";

export type BinaryBitValue = 0 | 1;
export type BitVector3 = readonly [BinaryBitValue, BinaryBitValue, BinaryBitValue];
export type BitVector6 = readonly [BinaryBitValue, BinaryBitValue, BinaryBitValue, BinaryBitValue, BinaryBitValue, BinaryBitValue];
export type BitPosition = 1 | 2 | 3 | 4 | 5 | 6;
export type State64Id = `S64-${string}`;
export type MutationMask64 = `M64-${string}`;
export type Module3Id = `B3-${string}`;

/** Domain-neutral six-bit state. It carries finite algebraic structure, not inherited symbolic meaning. */
export type BinaryState64 = {
  id: State64Id;
  binary: string;
  bits: BitVector6;
  lowerModule: BitVector3;
  upperModule: BitVector3;
};

export type Module3 = {
  id: Module3Id;
  index: number;
  binary: string;
  bits: BitVector3;
};

export type State64CatalogEntry = BinaryState64 & {
  index: number;
  ordinal: number;
  code: `S${string}`;
  lowerModuleId: Module3Id;
  upperModuleId: Module3Id;
};

export type State64Transition = {
  sourceStateId: State64Id;
  changedPositions: readonly BitPosition[];
  mutationMask: MutationMask64;
  distance: number;
  targetStateId: State64Id;
};

export type State64BitRule = {
  position: BitPosition;
  label: string;
  predicate: Predicate;
  trueValue?: BinaryBitValue;
  falseValue?: BinaryBitValue;
};

export type State64EncodingDefinition = {
  id: string;
  label: string;
  parameterDefinitions: readonly ParameterDefinition[];
  bitRules: readonly [State64BitRule, State64BitRule, State64BitRule, State64BitRule, State64BitRule, State64BitRule];
  lowerModuleLabel?: string;
  upperModuleLabel?: string;
};

export type State64EncodingDecision = {
  position: BitPosition;
  label: string;
  result: boolean;
  value: BinaryBitValue;
};

export type EncodedState64 = {
  definitionId: string;
  parameters: ParameterSnapshot;
  state: BinaryState64;
  decisions: readonly State64EncodingDecision[];
};

export type ObservedMeasurement = {
  key: string;
  value: ParameterValue;
  unit?: string;
  source?: string;
  observedAt?: string;
  tolerance?: number;
  metadata?: Record<string, unknown>;
};

export type ObservedAnchorInput = {
  definition: State64EncodingDefinition;
  measurements: readonly ObservedMeasurement[];
  anchorRuleVersion?: string;
};

export type AnchoredObservedState64 = EncodedState64 & {
  measurements: readonly ObservedMeasurement[];
  anchorMode: "deterministic_observed_parameters";
  anchorRuleVersion?: string;
};
