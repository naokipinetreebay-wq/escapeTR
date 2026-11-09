import { pickLone } from "./signal";
import {
  LONE_SIGNAL,
  otherSignal,
  type PlayFrame,
  type PlayPackage,
  type RoomConfig,
  type RoomSnapshot,
  type Signal,
} from "./types";

export const CONTROLLER_ID = "controller";

export type HostOverlay = {
  playPackage: PlayPackage | null;
  controllerSignal: Signal | null;
  loneId: string | null;
  frameStartedAt: number | null;
  startedAt: number | null;
  endsAt: number | null;
  finishedAt: number | null;
  signals: Record<string, Signal>;
  hostNow: number;
};

export function idsFromSnapshot(snapshot: RoomSnapshot): string[] {
  const ids = snapshot.displays.filter((d) => d.connected).map((d) => d.id);
  ids.unshift(CONTROLLER_ID);
  return ids;
}

/** 練習時間ぶんの一括パッケージ。尽きたら終了（ループしない） */
export function buildLocalPlayPackage(
  ids: string[],
  config: RoomConfig,
  opts?: {
    startAt?: number;
    loneSignal?: Signal;
    rng?: () => number;
  }
): PlayPackage {
  const startAt = opts?.startAt ?? Date.now();
  const endsAt = startAt + config.durationSeconds * 1000;
  const intervalMs = config.intervalSeconds * 1000;
  const loneSignal = opts?.loneSignal ?? LONE_SIGNAL;
  const rest = otherSignal(loneSignal);
  const rng = opts?.rng ?? Math.random;
  const frames: PlayFrame[] = [];
  let at = startAt;
  let prevLone: string | null = null;
  while (true) {
    const lone = pickLone(ids, prevLone, rng);
    prevLone = lone;
    const signals: Record<string, Signal> = {};
    for (const id of ids) signals[id] = id === lone ? loneSignal : rest;
    frames.push({ frameStartedAt: at, loneId: lone, signals });
    const frameEnd = at + intervalMs;
    if (frameEnd >= endsAt) break;
    at = frameEnd;
  }
  return { intervalMs, endsAt, frames };
}

export function overlayFromPackage(
  pkg: PlayPackage,
  hostNow = Date.now()
): HostOverlay {
  const first = pkg.frames[0];
  return {
    playPackage: pkg,
    controllerSignal: first?.signals[CONTROLLER_ID] ?? null,
    loneId: first?.loneId ?? null,
    frameStartedAt: first?.frameStartedAt ?? null,
    startedAt: first?.frameStartedAt ?? hostNow,
    endsAt: pkg.endsAt,
    finishedAt: null,
    signals: first?.signals ?? {},
    hostNow,
  };
}
