export type {
  AnchoredObservedState64,
  BinaryBitValue,
  BinaryState64,
  BitPosition,
  BitVector3,
  BitVector6,
  EncodedState64,
  Module3,
  Module3Id,
  MutationMask64,
  ObservedAnchorInput,
  ObservedMeasurement,
  State64BitRule,
  State64CatalogEntry,
  State64EncodingDecision,
  State64EncodingDefinition,
  State64Id,
  State64Transition
} from "./types.js";

export type { State64ModuleScope, State64RegimeClass, State64RegimeClassification } from "./regimes.js";
export { STATE64_MODULE_SCOPE_CODE, STATE64_REGIME_CLASS_CODE } from "./regimes.js";
export type { State64TransitionMatrixEntry } from "./matrix.js";
export type { State64ChainCompression } from "./chains.js";
export type { MathematicallyAnchoredState64 } from "./mathematical-anchors.js";

export { assertBitPosition, assertBitValue, binaryStringToBits, bitsToBinaryString, flipBitValue } from "./bits.js";
export { MODULE3_CATALOG, getModule3ByBinary, getModule3ById } from "./modules.js";
export { STATE64_CATALOG, createState64CatalogEntry, generateState64Catalog, getState64ByBinary, getState64ById, getState64ByOrdinal, getStatesByModulePair } from "./catalog.js";
export {
  applyMutationMask64,
  createBinaryState64,
  createMutationMask64,
  createMutationMask64FromBinary,
  elementaryNeighbours,
  hammingDistance64,
  mutationMaskBetween64,
  positionsFromMutationMask64,
  xorMutationMasks64
} from "./hypercube.js";
export { encodeParameterSnapshotToState64 } from "./encoding.js";
export { anchorObservedMeasurementsToState64, measurementsToParameterSnapshot } from "./anchors.js";
export { transformState64 } from "./transformations.js";
export { hammingDistance, sharedModuleScore, simpleStateSimilarity, state64BitDistance } from "./similarity.js";
export { classifyState64RegimePair, classifyState64RegimeTransition } from "./regimes.js";
export { createState64TransitionMatrix, lookupState64Transition } from "./matrix.js";
export { compressState64Chain } from "./chains.js";
export { anchorMathematicalObservationsToState64, projectFormalizedSnapshotToState64 } from "./mathematical-anchors.js";
export { binaryToState64Number, createMutationMask64FromNumber, createState64FromNumber, mutationMask64NumberToId, mutationMask64ToNumber, state64IdToNumber, state64NumberToBinary, state64NumberToId, transitionIndex64Number } from "./numeric.js";
