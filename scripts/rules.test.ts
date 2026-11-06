import { WebSocket } from "ws";
import { placementsFor } from "../src/lib/placement";
import { pickLone } from "../src/lib/signal";
import { Room, type ClientSocket } from "../src/server/room";
import { LONE_SIGNAL } from "../src/lib/types";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function fakeSocket(): ClientSocket {
  return { readyState: WebSocket.OPEN, send() {} } as unknown as ClientSocket;
}

assert(LONE_SIGNAL === "green", "escape marks one open space in green");

const two = placementsFor(2);
assert(two[0]?.controller && two[0].clock === "9時" && two[1]?.clock === "3時", "two phones face each other");
const three = placementsFor(3).map((slot) => slot.clock);
assert(three.join(",") === "12時,8時,4時", "triangle goes counterclockwise from the controller");
const four = placementsFor(4).map((slot) => slot.angle);
assert(four.join(",") === "0,270,180,90", "square goes counterclockwise");

for (let i = 0; i < 30; i++) {
  const next = pickLone(["controller", "a", "b"], "a", Math.random);
  assert(next !== "a", "the enemy moves when another phone exists");
}
assert(pickLone(["only"], "only", () => 0) === "only", "one phone can stay");

const room = new Room("TEST01");
try {
  room.addController(fakeSocket());
  room.start();
  assert(!room.snapshot().config.running, "one phone cannot start");
  room.addDisplay(fakeSocket(), "a");
  room.updateConfig({ intervalSeconds: 2, durationSeconds: 10, sound: false });
  room.start();
  const live = room.snapshot();
  assert(live.config.running, "two phones start");
  const signals = [live.controllerSignal, ...live.displays.map((d) => d.signal)];
  assert(signals.filter((signal) => signal === "green").length === 1, "exactly one green");
  assert(signals.filter((signal) => signal === "red").length === signals.length - 1, "the rest are red");
  assert(live.endsAt != null && live.startedAt != null && live.endsAt - live.startedAt === 10_000, "ten second practice");
  room.updateConfig({ durationSeconds: 30 });
  assert(room.snapshot().config.durationSeconds === 10, "settings lock while running");
  room.stop();
  const stopped = room.snapshot();
  assert(!stopped.config.running && stopped.controllerSignal == null && stopped.displays.every((d) => d.signal == null), "stop clears the colors");
  for (const extra of ["b", "c", "d", "e", "f", "g"]) room.addDisplay(fakeSocket(), extra);
  const rejected = room.addDisplay(fakeSocket(), "h");
  assert(!rejected.ok, "eighth peripheral is rejected");
} finally {
  room.destroy();
}

console.log("escape rules ok");
