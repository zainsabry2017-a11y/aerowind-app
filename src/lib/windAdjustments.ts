import type { WindRecord } from "./windDataParser";

export interface WindAdjustments {
  enabled: boolean;
  directionOffsetDeg: number; // added to direction, wrapped to 0-359
  speedOffsetKt: number; // added to sustained & gust
  clampSpeedMinKt?: number; // default 0
}

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

export function applyWindAdjustments(records: WindRecord[], calmThreshold: number, adj: WindAdjustments): WindRecord[] {
  if (!adj.enabled) return records;
  const minSpd = adj.clampSpeedMinKt ?? 0;

  return records.map((r) => {
    if (!r.isValid) return r;

    const newDir = wrap360(r.wind_direction_deg + (adj.directionOffsetDeg || 0));

    const newSpd = Math.max(minSpd, r.wind_speed_kt + (adj.speedOffsetKt || 0));
    const newGust = r.wind_gust_kt === null ? null : Math.max(minSpd, r.wind_gust_kt + (adj.speedOffsetKt || 0));

    const isCalm = newSpd <= calmThreshold;

    return {
      ...r,
      wind_direction_deg: newDir,
      wind_speed_kt: newSpd,
      wind_gust_kt: newGust,
      isCalm,
    };
  });
}

