"use client";

import { placementsFor } from "@/lib/placement";

export function PlacementMap({ total }: { total: number }) {
  const shown = total >= 2 ? total : 3;
  const slots = placementsFor(shown);

  return (
    <div className="placement">
      <div className="placement-ring" aria-hidden="true">
        {slots.map((slot) => {
          const rad = (slot.angle * Math.PI) / 180;
          const left = 50 + Math.sin(rad) * 38;
          const top = 50 - Math.cos(rad) * 38;
          const filled = slot.no <= Math.max(total, 0) || (total < 2 && slot.no === 1);
          return (
            <span
              key={slot.no}
              className={`placement-dot ${slot.controller ? "self" : ""} ${filled ? "filled" : ""}`}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              {slot.controller ? "操" : slot.no}
            </span>
          );
        })}
      </div>
      <p className="muted placement-note">
        {total < 2
          ? "2台なら左右で向かい合えばよいです。"
          : "操がこの端末です。そこから反時計回りに No.2、No.3 と置きます。"}
      </p>
    </div>
  );
}
