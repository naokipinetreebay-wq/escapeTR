"use client";

import { useEffect } from "react";
import { ColorScreen } from "@/components/ColorScreen";
import { placementsFor } from "@/lib/placement";
import { useKeepPlayView } from "@/lib/playView";
import type { RoomSnapshot } from "@/lib/types";

export function DisplayScreen({ snapshot, deviceId }: { snapshot: RoomSnapshot; deviceId: string; send?: unknown }) {
  const mine = snapshot.displays.find((d) => d.id === deviceId);
  const total = snapshot.displays.length + 1;
  const slot = placementsFor(total).find((item) => item.no === mine?.place);
  const view = useKeepPlayView(snapshot, deviceId);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen");
      } catch {
        /* ignore */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wake?.release().catch(() => undefined);
    };
  }, []);

  return (
    <ColorScreen
      signal={view.signal}
      title={mine?.label || `No.${mine?.place ?? ""}`}
      detail={slot?.clock}
      sound={snapshot.config.sound}
      frameStartedAt={view.frameStartedAt}
      running={view.running}
    />
  );
}
