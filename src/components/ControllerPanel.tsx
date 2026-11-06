"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { SessionExit } from "@/components/SessionExit";
import { placementsFor } from "@/lib/placement";
import {
  MAX_DURATION,
  MAX_INTERVAL,
  MIN_DURATION,
  MIN_INTERVAL,
  type ClientMessage,
  type RoomConfig,
  type RoomSnapshot,
} from "@/lib/types";

export function ControllerPanel({
  snapshot,
  connected,
  send,
  clearSessionKeys,
  onStart,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  clearSessionKeys?: string[];
  onStart: () => void;
}) {
  const cfg = snapshot.config;
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/${snapshot.code}`;
  }, [snapshot.code]);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!cfg.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [cfg.running]);

  const skew = useMemo(() => snapshot.serverNow - Date.now(), [snapshot.serverNow]);
  const leftMs =
    cfg.running && snapshot.endsAt != null ? Math.max(0, snapshot.endsAt - (Date.now() + skew)) : null;
  const online = snapshot.displays.filter((d) => d.connected).length;
  const ready = connected && online >= 1 && online === snapshot.displays.length && snapshot.displays.length <= 7;
  const slots = placementsFor(snapshot.displays.length + 1);
  const placeByNo = new Map(slots.map((slot) => [slot.no, slot.clock]));

  const patch = (partial: Partial<RoomConfig>) => {
    if (cfg.running) return;
    send({ type: "updateConfig", config: partial });
  };

  return (
    <div className="controller">
      <header className="controller-header">
        <div>
          <p className="eyebrow">Escape</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className={`pill ${connected ? "ok" : "bad"}`}>{connected ? "接続中" : "再接続中…"}</div>
      </header>

      <section className="panel">
        <h2>{cfg.running ? "練習中" : snapshot.finishedAt != null ? "終了" : "待機"}</h2>
        <p className="time-read">
          {leftMs != null ? Math.ceil(leftMs / 1000) : cfg.durationSeconds}
          <span className="score-denom">秒</span>
        </p>
        <p className="muted">緑が空きです。そこへボールを逃がします。赤が敵です。</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            disabled={!ready || cfg.running}
            onClick={() => {
              send({ type: "start" });
              onStart();
            }}
          >
            {snapshot.finishedAt != null ? "もう一度" : "開始"}
          </button>
          <button type="button" className="btn danger" onClick={() => send({ type: "stop" })}>
            停止
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>設定</h2>
        <label className="field">
          <span>切り替え: {cfg.intervalSeconds}秒</span>
          <input
            type="range"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            step={1}
            value={cfg.intervalSeconds}
            disabled={cfg.running}
            onChange={(e) => patch({ intervalSeconds: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>練習: {cfg.durationSeconds}秒</span>
          <input
            type="range"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={5}
            value={cfg.durationSeconds}
            disabled={cfg.running}
            onChange={(e) => patch({ durationSeconds: Number(e.target.value) })}
          />
        </label>
        <div className="btn-row">
          <button type="button" className={`btn ${cfg.sound ? "primary" : ""}`} disabled={cfg.running} onClick={() => patch({ sound: true })}>
            音あり
          </button>
          <button type="button" className={`btn ${cfg.sound ? "" : "primary"}`} disabled={cfg.running} onClick={() => patch({ sound: false })}>
            音なし
          </button>
        </div>
        <p className="muted">{ready ? "終わるとこの画面に戻ります。" : "もう1台つながると開始できます。"}</p>
      </section>

      <section className="panel">
        <h2>端末</h2>
        <div className="qr-wrap">{displayUrl ? <QRCodeSVG value={displayUrl} size={160} /> : null}</div>
        <p className="mono url">{displayUrl}</p>
        <ul className="device-list">
          <li>
            <span className="place-badge">1</span>
            <span>この端末</span>
            <span className="clock-label">{placeByNo.get(1) ?? ""}</span>
          </li>
          {snapshot.displays.map((d) => (
            <li key={d.id}>
              <span className="place-badge">{d.place}</span>
              <input
                className="label-input"
                value={d.label}
                onChange={(e) => send({ type: "setLabel", deviceId: d.id, label: e.target.value })}
              />
              <span className="clock-label">{placeByNo.get(d.place) ?? ""}</span>
              <span className={`dot ${d.connected ? "ok" : "bad"}`} />
            </li>
          ))}
        </ul>
      </section>

      <SessionExit onStop={() => send({ type: "stop" })} clearSessionKeys={clearSessionKeys} />
    </div>
  );
}
