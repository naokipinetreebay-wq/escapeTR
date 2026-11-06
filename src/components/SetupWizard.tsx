"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { PlacementMap } from "@/components/PlacementMap";
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

const STEPS = ["説明", "設定", "配置", "確認"] as const;

export function SetupWizard({
  snapshot,
  connected,
  send,
  onDone,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const cfg = snapshot.config;
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/${snapshot.code}`;
  }, [snapshot.code]);
  const joined = snapshot.displays.length;
  const online = snapshot.displays.filter((d) => d.connected).length;
  const roster = online + (connected ? 1 : 0);
  const total = joined + 1;
  const slots = placementsFor(total);
  const placeByNo = new Map(slots.map((slot) => [slot.no, slot.clock]));

  const patch = (partial: Partial<RoomConfig>) => {
    send({ type: "updateConfig", config: partial });
  };

  return (
    <div className="wizard">
      <header className="wizard-top">
        <div>
          <p className="eyebrow">Escape · セットアップ</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className="wizard-top-actions">
          <SessionExit compact />
          <div className={`pill ${connected ? "ok" : "bad"}`}>{connected ? "接続中" : "再接続中…"}</div>
        </div>
      </header>

      <ol className="wizard-steps" aria-label="手順">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>
            <span className="n">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="panel wizard-panel">
        {step === 0 ? (
          <div className="wizard-body">
            <h2>エスケープ</h2>
            <ul className="explain-list">
              <li>置き方はドリブルキープと同じです。距離だけ、少し遠めに置きます。</li>
              <li>緑が1台、ほかは赤です。緑は敵がいない場所です。</li>
              <li>緑へボールを逃がしながらドリブルします。</li>
              <li>音ありのときは、赤の端末が切り替わりのたびにブーと鳴ります。</li>
              <li>終わると、この端末はメニューに戻り、ほかの端末は色が消えます。</li>
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-body">
            <h2>時間と音</h2>
            <label className="field">
              <span>切り替え: {cfg.intervalSeconds}秒</span>
              <input
                type="range"
                min={MIN_INTERVAL}
                max={MAX_INTERVAL}
                step={1}
                value={cfg.intervalSeconds}
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
                onChange={(e) => patch({ durationSeconds: Number(e.target.value) })}
              />
            </label>
            <div className="btn-row">
              <button type="button" className={`btn ${cfg.sound ? "primary" : ""}`} onClick={() => patch({ sound: true })}>
                音あり
              </button>
              <button type="button" className={`btn ${cfg.sound ? "" : "primary"}`} onClick={() => patch({ sound: false })}>
                音なし
              </button>
            </div>
            <p className="muted">音は約0.5秒です。各端末で一度タップしないと鳴りません。</p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-body">
            <h2>端末を置く</h2>
            <p className="join-meter">
              {roster < 2 ? `接続中 ${roster} 台。2台そろうまで開始できません。` : `接続中 ${roster} 台。`}
            </p>
            <PlacementMap total={roster >= 2 ? total : 0} />
            <div className="qr-wrap">{displayUrl ? <QRCodeSVG value={displayUrl} size={180} /> : null}</div>
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
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-body">
            <h2>準備完了</h2>
            <ul className="summary-list">
              <li>接続中 {roster} 台</li>
              <li>
                {cfg.intervalSeconds}秒ごと、{cfg.durationSeconds}秒
              </li>
              <li>{cfg.sound ? "音あり" : "音なし"}</li>
              <li>緑が1台、ほかは赤</li>
            </ul>
            <p className="muted">「はじめる」で色が出ます。</p>
          </div>
        ) : null}
      </section>

      <footer className="wizard-nav">
        <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          戻る
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn primary"
            disabled={step === 2 && (roster < 2 || joined > 7)}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 2 && roster < 2 ? "2台そろうまで進めません" : "次へ"}
          </button>
        ) : (
          <button type="button" className="btn primary" disabled={roster < 2} onClick={onDone}>
            {roster < 2 ? "2台そろうまで開始できません" : "はじめる"}
          </button>
        )}
      </footer>
      <SessionExit onStop={() => send({ type: "stop" })} />
    </div>
  );
}
