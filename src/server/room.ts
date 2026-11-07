import { WebSocket } from "ws";
import { pickLone } from "../lib/signal";
import {
  DEFAULT_CONFIG,
  LONE_SIGNAL,
  MAX_DURATION,
  MAX_INTERVAL,
  MAX_PERIPHERALS,
  MIN_DURATION,
  MIN_INTERVAL,
  MIN_TOTAL,
  clamp,
  otherSignal,
  type DisplayInfo,
  type PlayFrame,
  type PlayPackage,
  type RoomConfig,
  type RoomSnapshot,
  type Signal,
} from "../lib/types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 90 * 60 * 1000;
const CONTROLLER_ID = "controller";

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export type ClientSocket = WebSocket & {
  role?: "controller" | "display";
  deviceId?: string;
  roomCode?: string;
};

interface DisplayClient {
  id: string;
  label: string;
  place: number;
  socket: ClientSocket | null;
}

export class Room {
  code: string;
  config: RoomConfig = { ...DEFAULT_CONFIG };
  displays = new Map<string, DisplayClient>();
  controllers = new Set<ClientSocket>();
  controllerSignal: Signal | null = null;
  loneId: string | null = null;
  frameStartedAt: number | null = null;
  startedAt: number | null = null;
  endsAt: number | null = null;
  finishedAt: number | null = null;
  playPackage: PlayPackage | null = null;
  lastActivity = Date.now();
  rng: () => number = Math.random;

  private signals = new Map<string, Signal>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private packageIndex = 0;

  constructor(code: string) {
    this.code = code;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  isExpired(now = Date.now()) {
    if (this.config.running) return false;
    if (this.controllers.size > 0) return false;
    if ([...this.displays.values()].some((d) => d.socket)) return false;
    return now - this.lastActivity > ROOM_TTL_MS;
  }

  addController(socket: ClientSocket) {
    this.controllers.add(socket);
    this.touch();
    this.sendSnapshot(socket);
  }

  removeController(socket: ClientSocket) {
    this.controllers.delete(socket);
  }

  addDisplay(socket: ClientSocket, deviceId: string, label?: string) {
    this.touch();
    const existing = this.displays.get(deviceId);
    if (existing) {
      existing.socket = socket;
      if (label) existing.label = label;
      this.broadcast();
      return { ok: true as const };
    }
    if (this.displays.size >= MAX_PERIPHERALS) {
      return { ok: false as const, error: "周囲の端末は7台までです" };
    }
    const place = this.displays.size + 2;
    this.displays.set(deviceId, {
      id: deviceId,
      label: label || `No.${place}`,
      place,
      socket,
    });
    this.broadcast();
    return { ok: true as const };
  }

  removeDisplaySocket(socket: ClientSocket) {
    for (const d of this.displays.values()) {
      if (d.socket === socket) {
        d.socket = null;
        break;
      }
    }
    this.broadcast();
  }

  setLabel(deviceId: string, label: string) {
    const d = this.displays.get(deviceId);
    if (d) {
      d.label = label.slice(0, 24);
      this.touch();
      this.broadcast();
    }
  }

  updateConfig(partial: Partial<RoomConfig>) {
    if (this.config.running) {
      this.broadcast();
      return;
    }
    const next = { ...this.config, ...partial, running: false };
    next.intervalSeconds = clamp(Math.round(next.intervalSeconds), MIN_INTERVAL, MAX_INTERVAL);
    next.durationSeconds = clamp(Math.round(next.durationSeconds), MIN_DURATION, MAX_DURATION);
    next.sound = !!next.sound;
    this.config = next;
    this.touch();
    this.broadcast();
  }

  private liveIds(): string[] {
    const ids = [...this.displays.values()]
      .filter((d) => d.socket && d.socket.readyState === WebSocket.OPEN)
      .map((d) => d.id);
    if (this.hasController()) ids.unshift(CONTROLLER_ID);
    return ids;
  }

  private hasController(): boolean {
    return [...this.controllers].some((socket) => socket.readyState === WebSocket.OPEN);
  }

  start() {
    const ids = this.liveIds();
    const peripherals = ids.filter((id) => id !== CONTROLLER_ID);
    if (!this.hasController() || peripherals.length < 1 || ids.length < MIN_TOTAL || this.displays.size > MAX_PERIPHERALS) {
      this.broadcast();
      return;
    }
    if (peripherals.length !== this.displays.size) {
      this.broadcast();
      return;
    }
    this.clearTimer();
    const now = Date.now();
    this.config.running = true;
    this.startedAt = now;
    this.endsAt = now + this.config.durationSeconds * 1000;
    this.finishedAt = null;
    this.loneId = null;
    this.playPackage = this.buildPlayPackage(ids, now, this.endsAt);
    this.packageIndex = 0;
    this.touch();
    const first = this.playPackage.frames[0];
    if (!first) {
      this.finish();
      return;
    }
    this.applyFrame(first);
    this.armPackage();
    this.broadcast();
  }

  stop() {
    this.clearTimer();
    this.config.running = false;
    this.controllerSignal = null;
    this.loneId = null;
    this.signals.clear();
    this.frameStartedAt = null;
    this.finishedAt = null;
    this.playPackage = null;
    this.packageIndex = 0;
    this.touch();
    this.broadcast();
  }

  private buildPlayPackage(ids: string[], startAt: number, endsAt: number): PlayPackage {
    const intervalMs = this.config.intervalSeconds * 1000;
    const rest = otherSignal(LONE_SIGNAL);
    const frames: PlayFrame[] = [];
    let at = startAt;
    let prevLone: string | null = null;
    while (true) {
      const lone = pickLone(ids, prevLone, this.rng);
      prevLone = lone;
      const signals: Record<string, Signal> = {};
      for (const id of ids) signals[id] = id === lone ? LONE_SIGNAL : rest;
      frames.push({ frameStartedAt: at, loneId: lone, signals });
      const frameEnd = at + intervalMs;
      if (frameEnd >= endsAt) break;
      at = frameEnd;
    }
    return { intervalMs, endsAt, frames };
  }

  private applyFrame(frame: PlayFrame) {
    this.loneId = frame.loneId;
    this.signals.clear();
    for (const [id, signal] of Object.entries(frame.signals)) {
      this.signals.set(id, signal);
    }
    this.controllerSignal = this.signals.get(CONTROLLER_ID) ?? null;
    this.frameStartedAt = frame.frameStartedAt;
  }

  private armPackage() {
    this.clearTimer();
    if (!this.playPackage || this.endsAt == null) return;
    const nextIndex = this.packageIndex + 1;
    if (nextIndex >= this.playPackage.frames.length) {
      const wait = Math.max(0, this.endsAt - Date.now());
      this.timer = setTimeout(() => this.finish(), wait);
      return;
    }
    const next = this.playPackage.frames[nextIndex];
    const wait = Math.max(0, next.frameStartedAt - Date.now());
    this.timer = setTimeout(() => {
      this.packageIndex = nextIndex;
      this.applyFrame(next);
      this.armPackage();
      this.broadcast();
    }, wait);
  }

  private finish() {
    this.clearTimer();
    this.config.running = false;
    this.controllerSignal = null;
    this.loneId = null;
    this.signals.clear();
    this.frameStartedAt = null;
    this.finishedAt = Date.now();
    this.playPackage = null;
    this.packageIndex = 0;
    this.touch();
    this.broadcast();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  snapshot(): RoomSnapshot {
    const displays: DisplayInfo[] = [...this.displays.values()].map((d) => ({
      id: d.id,
      label: d.label,
      place: d.place,
      connected: !!d.socket && d.socket.readyState === WebSocket.OPEN,
      signal: this.config.running ? (this.signals.get(d.id) ?? null) : null,
    }));
    return {
      code: this.code,
      config: this.config,
      displays,
      controllerSignal: this.config.running ? this.controllerSignal : null,
      loneId: this.config.running ? this.loneId : null,
      frameStartedAt: this.config.running ? this.frameStartedAt : null,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      finishedAt: this.finishedAt,
      playPackage: this.config.running ? this.playPackage : null,
      serverNow: Date.now(),
    };
  }

  sendSnapshot(socket: ClientSocket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "snapshot", snapshot: this.snapshot() }));
    }
  }

  broadcast() {
    const payload = JSON.stringify({ type: "snapshot", snapshot: this.snapshot() });
    for (const c of this.controllers) {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    }
    for (const d of this.displays.values()) {
      if (d.socket && d.socket.readyState === WebSocket.OPEN) d.socket.send(payload);
    }
  }

  destroy() {
    this.clearTimer();
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  createRoom(): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    const room = this.rooms.get(code.toUpperCase());
    if (room?.isExpired()) {
      room.destroy();
      this.rooms.delete(room.code);
      return undefined;
    }
    return room;
  }

  sweep() {
    for (const [code, room] of this.rooms) {
      if (room.isExpired()) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
