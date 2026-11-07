import { useEffect, useRef, useState } from "react";
import type { PlayFrame, RoomSnapshot, Signal } from "./types";

export type KeepPlayView = {
  signal: Signal | null;
  loneId: string | null;
  frameStartedAt: number | null;
  running: boolean;
  usingPackage: boolean;
};

function frameAt(pkg: NonNullable<RoomSnapshot["playPackage"]>, now: number): PlayFrame | null {
  if (!pkg.frames.length) return null;
  if (now >= pkg.endsAt) return null;
  let frame = pkg.frames[0];
  for (const f of pkg.frames) {
    if (f.frameStartedAt <= now) frame = f;
    else break;
  }
  return frame;
}

/** パッケージがあるときは端末時計で信号を進める */
export function useKeepPlayView(
  snapshot: RoomSnapshot | null,
  deviceId: string | "controller"
): KeepPlayView {
  const [tick, setTick] = useState(0);
  const skewRef = useRef(0);
  const pkg = snapshot?.playPackage ?? null;

  useEffect(() => {
    if (!snapshot) return;
    skewRef.current = snapshot.serverNow - Date.now();
  }, [snapshot?.serverNow]);

  useEffect(() => {
    if (!pkg || snapshot?.finishedAt != null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 50);
    return () => window.clearInterval(id);
  }, [pkg, snapshot?.finishedAt]);

  if (!snapshot) {
    return {
      signal: null,
      loneId: null,
      frameStartedAt: null,
      running: false,
      usingPackage: false,
    };
  }

  if (!pkg || snapshot.finishedAt != null || !snapshot.config.running) {
    const signal =
      deviceId === "controller"
        ? snapshot.controllerSignal
        : snapshot.displays.find((d) => d.id === deviceId)?.signal ?? null;
    return {
      signal,
      loneId: snapshot.loneId,
      frameStartedAt: snapshot.frameStartedAt,
      running: snapshot.config.running,
      usingPackage: false,
    };
  }

  void tick;
  const now = Date.now() + skewRef.current;
  if (now >= pkg.endsAt) {
    return {
      signal: null,
      loneId: null,
      frameStartedAt: null,
      running: false,
      usingPackage: true,
    };
  }
  const frame = frameAt(pkg, now);
  if (!frame) {
    return {
      signal: null,
      loneId: null,
      frameStartedAt: null,
      running: false,
      usingPackage: true,
    };
  }
  return {
    signal: frame.signals[deviceId] ?? null,
    loneId: frame.loneId,
    frameStartedAt: frame.frameStartedAt,
    running: true,
    usingPackage: true,
  };
}
