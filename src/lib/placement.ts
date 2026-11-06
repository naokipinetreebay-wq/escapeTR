export interface Placement {
  no: number;
  /** 12時を0度、時計回り */
  angle: number;
  clock: string;
  controller: boolean;
}

function clockFace(ccwDegrees: number): string {
  const hour = 12 - ccwDegrees / 30;
  const normalized = ((hour % 12) + 12) % 12;
  const shown = normalized === 0 ? 12 : normalized;
  const nearest = Math.round(shown * 10) / 10;
  if (Math.abs(nearest - Math.round(nearest)) < 0.05) {
    const whole = Math.round(nearest);
    return `${whole === 0 ? 12 : whole}時`;
  }
  const low = Math.floor(shown);
  const high = low + 1;
  const a = low === 0 ? 12 : low;
  const b = high >= 12 ? high - 12 || 12 : high;
  return `${a}時と${b}時のあいだ`;
}

/**
 * 全員が多角形の頂点。No.1がコントローラで、そこから反時計回りにNo.2、No.3。
 * 2台は左右に向かい合う。
 */
export function placementsFor(total: number): Placement[] {
  const n = Math.max(0, Math.min(8, total));
  if (n === 0) return [];
  if (n === 2) {
    return [
      { no: 1, angle: 270, clock: "9時", controller: true },
      { no: 2, angle: 90, clock: "3時", controller: false },
    ];
  }
  return Array.from({ length: n }, (_, i) => {
    const ccw = (360 / n) * i;
    return {
      no: i + 1,
      angle: (360 - ccw) % 360,
      clock: clockFace(ccw),
      controller: i === 0,
    };
  });
}
