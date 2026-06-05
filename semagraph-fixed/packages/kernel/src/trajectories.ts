import type { StateId, Trajectory, TransitionResult } from "./types.js";

export function createTrajectory<TStateId extends StateId>(
  id: string,
  initialParameters: Trajectory<TStateId>["initialParameters"],
  initialStateId: TStateId | null
): Trajectory<TStateId> {
  return { id, initialParameters, initialStateId, events: [] };
}

export function appendTransition<TStateId extends StateId>(
  trajectory: Trajectory<TStateId>,
  transition: TransitionResult<TStateId>
): Trajectory<TStateId> {
  if (!transition.accepted) {
    throw new Error("Rejected transitions cannot be committed to an observed trajectory.");
  }
  const lastStateId = trajectory.events.at(-1)?.targetStateId ?? trajectory.initialStateId;
  if (transition.sourceStateId !== lastStateId) {
    throw new Error("Transition source state does not match the trajectory head.");
  }
  return { ...trajectory, events: [...trajectory.events, transition] };
}

export function currentStateId<TStateId extends StateId>(trajectory: Trajectory<TStateId>): TStateId | null {
  return trajectory.events.at(-1)?.targetStateId ?? trajectory.initialStateId;
}

export function retrieveByTransitionAuthority<TStateId extends StateId>(
  trajectories: readonly Trajectory<TStateId>[],
  authority: TransitionResult<TStateId>["authority"]
): readonly Trajectory<TStateId>[] {
  return trajectories.filter((trajectory) => trajectory.events.some((event) => event.authority === authority));
}
