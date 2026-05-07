export type {
  BinaryLineValue,
  Line,
  HexagramNumber,
  LineValue,
  MovingLinePosition,
  State64,
  State64Id,
  SymbolicMemoryRecord,
  SymbolicTrajectory,
  Transformation,
  Trigram,
  TrigramId
} from "./types.js";

export {
  assertMovingLinePosition,
  binaryStringToLines,
  binaryToLineValue,
  flipLineValue,
  linesToBinaryString,
  lineValueToBinary
} from "./lines.js";

export { TRIGRAMS, getTrigramByBinary, getTrigramById } from "./trigrams.js";

export {
  STATE64_CATALOG,
  generateState64Catalog,
  getState64ByBinary,
  getState64ById,
  getState64ByNumber,
  getStatesByTrigramPair
} from "./hexagrams.js";

export { transformLines, transformState64 } from "./transformations.js";

export {
  hammingDistance,
  sharedTrigramScore,
  simpleStateSimilarity,
  state64LineDistance
} from "./similarity.js";

export {
  addRecordToTrajectory,
  createTrajectory,
  retrieveByExactState,
  retrieveByMaxLineDistance,
  retrieveBySharedTrigram,
  sortRecordsByCreatedAt
} from "./memory.js";
