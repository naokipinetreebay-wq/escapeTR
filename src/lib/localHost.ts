"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  buildLocalPlayPackage,
  idsFromSnapshot,
  overlayFromPackage,
  type HostOverlay,
} from "./localEngine";
import type { ClientMessage, RoomSnapshot } from "./types";

const CLOCK_MS = 3000;

export function useKeepLocalHost(
  snapshot: RoomSnapshot | null,
  send: (msg: ClientMessage) => void
) {
  const overlayRef = useRef<HostOverlay | null>(null);
  const finishingRef = useRef(false);

  const push = useCallback(
    (overlay: HostOverlay) => {
      overlayRef.current = overlay;
      send({ type: "hostPush", overlay });
    },
    [send]
  );

  useEffect(() => {
    if (!snapshot?.config.running) return;
    const tick = () => {
      const prev = overlayRef.current;
      if (!prev) return;
      push({ ...prev, hostNow: Date.now() });
    };
    const id = setInterval(tick, CLOCK_MS);
    return () => clearInterval(id);
  }, [snapshot?.config.running, push]);

  useEffect(() => {
    if (!snapshot?.config.running) {
      finishingRef.current = false;
      return;
    }
    const endsAt = overlayRef.current?.endsAt ?? snapshot.endsAt;
    if (endsAt == null) return;
    const wait = Math.max(0, endsAt - Date.now());
    const id = setTimeout(() => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      overlayRef.current = null;
      send({ type: "stop", finished: true });
    }, wait);
    return () => clearTimeout(id);
  }, [snapshot?.config.running, snapshot?.endsAt, send]);

  const startLocal = useCallback(() => {
    if (!snapshot) return;
    finishingRef.current = false;
    send({ type: "start", local: true });
    const ids = idsFromSnapshot(snapshot);
    const pkg = buildLocalPlayPackage(ids, snapshot.config);
    push(overlayFromPackage(pkg));
  }, [snapshot, send, push]);

  const stopLocal = useCallback(() => {
    finishingRef.current = true;
    overlayRef.current = null;
    send({ type: "stop" });
  }, [send]);

  return { startLocal, stopLocal };
}
