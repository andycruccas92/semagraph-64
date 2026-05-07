import type { State64Id, SymbolicMemoryRecord, SymbolicTrajectory } from "./types.js";
import { getState64ById } from "./hexagrams.js";
import { state64LineDistance, sharedTrigramScore } from "./similarity.js";

export function createTrajectory(id: string, records: readonly SymbolicMemoryRecord[] = []): SymbolicTrajectory {
  return { id, records: sortRecordsByCreatedAt(records) };
}

export function addRecordToTrajectory(
  trajectory: SymbolicTrajectory,
  record: SymbolicMemoryRecord
): SymbolicTrajectory {
  getState64ById(record.stateId);
  return {
    ...trajectory,
    records: sortRecordsByCreatedAt([...trajectory.records, record])
  };
}

export function sortRecordsByCreatedAt(records: readonly SymbolicMemoryRecord[]): readonly SymbolicMemoryRecord[] {
  return [...records].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function retrieveByExactState(
  records: readonly SymbolicMemoryRecord[],
  stateId: State64Id
): readonly SymbolicMemoryRecord[] {
  getState64ById(stateId);
  return records.filter((record) => record.stateId === stateId);
}

export function retrieveByMaxLineDistance(
  records: readonly SymbolicMemoryRecord[],
  stateId: State64Id,
  maxDistance: number
): readonly SymbolicMemoryRecord[] {
  getState64ById(stateId);
  return records.filter((record) => state64LineDistance(record.stateId, stateId) <= maxDistance);
}

export function retrieveBySharedTrigram(
  records: readonly SymbolicMemoryRecord[],
  stateId: State64Id
): readonly SymbolicMemoryRecord[] {
  getState64ById(stateId);
  return records.filter((record) => sharedTrigramScore(record.stateId, stateId) > 0);
}
