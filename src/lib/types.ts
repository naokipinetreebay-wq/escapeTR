export type Role = "controller" | "display";
export type Signal = "red" | "green";

export interface RoomConfig {
  /** 色が変わる間隔。1〜5秒 */
  intervalSeconds: number;
  /** 練習の長さ。10〜60秒 */
  durationSeconds: number;
  sound: boolean;
  running: boolean;
}

export interface DisplayInfo {
  id: string;
  label: string;
  /** 2がNo.2。1はコントローラ */
  place: number;
  connected: boolean;
  signal: Signal | null;
}

/** 開始時に一度配り、端末時計で再生する出題一式 */
export interface PlayFrame {
  frameStartedAt: number;
  loneId: string;
  signals: Record<string, Signal>;
}

export interface PlayPackage {
  intervalMs: number;
  endsAt: number;
  frames: PlayFrame[];
}

export interface RoomSnapshot {
  code: string;
  config: RoomConfig;
  displays: DisplayInfo[];
  controllerSignal: Signal | null;
  /** 今の緑（空き） */
  loneId: string | null;
  frameStartedAt: number | null;
  startedAt: number | null;
  endsAt: number | null;
  finishedAt: number | null;
  /** あるときは端末側再生の正本 */
  playPackage: PlayPackage | null;
  serverNow: number;
}

export type ClientMessage =
  | { type: "hello"; role: Role; deviceId: string; label?: string }
  | { type: "updateConfig"; config: Partial<RoomConfig> }
  | { type: "setLabel"; deviceId: string; label: string }
  | { type: "start"; local?: boolean }
  | { type: "stop"; finished?: boolean }
  | {
      type: "hostPush";
      overlay: {
        playPackage?: PlayPackage | null;
        controllerSignal?: Signal | null;
        loneId?: string | null;
        frameStartedAt?: number | null;
        startedAt?: number | null;
        endsAt?: number | null;
        finishedAt?: number | null;
        signals?: Record<string, Signal>;
        hostNow?: number;
      };
    }
  | {
      type: "signal";
      from: string;
      to: string;
      payload: unknown;
    }
  | { type: "ping" };

export type ServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "pong" }
  | {
      type: "signal";
      from: string;
      to: string;
      payload: unknown;
    }
  | {
      type: "clientEvent";
      event: string;
      deviceId?: string;
      [key: string]: unknown;
    };

export const DEFAULT_CONFIG: RoomConfig = {
  intervalSeconds: 2,
  durationSeconds: 30,
  sound: true,
  running: false,
};

/** コントローラを入れて2台以上。8台まで。 */
export const MIN_TOTAL = 2;
export const MAX_PERIPHERALS = 7;
export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 5;
export const MIN_DURATION = 10;
export const MAX_DURATION = 60;
/** 緑が1台。そこが空き。ほかは敵。 */
export const LONE_SIGNAL: Signal = "green";

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function otherSignal(signal: Signal): Signal {
  return signal === "red" ? "green" : "red";
}
