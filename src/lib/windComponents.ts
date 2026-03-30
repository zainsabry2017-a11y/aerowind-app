import type { WindRecord } from "./windDataParser";

// ── Types ──────────────────────────────────────────────

export interface WindComponentResult {
  headwind: number;   // positive = headwind, negative = tailwind
  crosswind: number;  // absolute value
  direction: number;
  speed: number;
  exceedsCrosswind: boolean;
}

export interface RunwayUsabilityResult {
  runwayHeading: number;
  reciprocal: number;
  crosswindLimit: number;
  totalObservations: number;
  calmObservations: number;
  exceedances: number;
  usableObservations: number;
  usabilityPercent: number;
  meets95: boolean;
  componentBreakdown: {
    headwindPct: number;
    tailwindPct: number;
    crosswindExceedPct: number;
  };
}

export interface OptimizationResult {
  headings: RunwayUsabilityResult[];
  bestHeading: number;
  bestUsability: number;
  top5: { heading: number; usability: number }[];
}

// ── Approach / FATO alignment helpers ──────────────────
// Wind direction is reported as where the wind comes FROM. A headwind approach uses the
// same published heading (flying toward that direction), not reciprocal +180°.

export function smallestAngleDifferenceDeg(a: number, b: number): number {
  let d = Math.abs((((a - b) % 360) + 360) % 360);
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Optimizer returns runway/FATO axis as a 1–180° “low” designator. Pick the physical
 * end whose inbound track is closest to wind-from for a headwind approach.
 */
export function inboundHeadingForHeadwind(windFromDeg: number, axisRunwayHeading1to180: number): number {
  const raw = ((Math.round(axisRunwayHeading1to180) % 360) + 360) % 360;
  const low = raw > 180 ? raw - 180 : raw || 360;
  const a = low;
  const b = (low + 180) % 360;
  const w = ((windFromDeg % 360) + 360) % 360;
  return smallestAngleDifferenceDeg(a, w) <= smallestAngleDifferenceDeg(b, w) ? a : b;
}

// ── Wind component calculation ─────────────────────────

export function calculateWindComponents(
  windDirection: number,
  windSpeed: number,
  runwayHeading: number
): WindComponentResult {
  const theta = ((windDirection - runwayHeading) * Math.PI) / 180;

  const headwind = windSpeed * Math.cos(theta);
  const crosswind = Math.abs(windSpeed * Math.sin(theta));

  return { headwind, crosswind, direction: windDirection, speed: windSpeed, exceedsCrosswind: false };
}

// ── Runway usability for a single heading ──────────────

export function calculateRunwayUsability(
  records: WindRecord[],
  runwayHeading: number,
  crosswindLimit: number,
  calmThreshold: number = 3,
  useGust: boolean = false
): RunwayUsabilityResult {
  const reciprocal = (runwayHeading + 180) % 360;
  const validRecords = records.filter((r) => r.isValid);
  const total = validRecords.length;

  let calmObs = 0;
  let exceedances = 0;
  let headwindCount = 0;
  let tailwindCount = 0;

  for (const r of validRecords) {
    const windSpd = useGust && r.wind_gust_kt !== null ? r.wind_gust_kt : r.wind_speed_kt;
    if (windSpd <= calmThreshold) {
      calmObs++;
      continue;
    }

    // Check both runway ends — use the one with lower crosswind
    const comp1 = calculateWindComponents(r.wind_direction_deg, windSpd, runwayHeading);
    const comp2 = calculateWindComponents(r.wind_direction_deg, windSpd, reciprocal);

    const bestComp = comp1.crosswind <= comp2.crosswind ? comp1 : comp2;

    if (bestComp.crosswind > crosswindLimit) {
      exceedances++;
    }

    if (bestComp.headwind >= 0) headwindCount++;
    else tailwindCount++;
  }

  const usable = total - exceedances;
  const usabilityPct = total > 0 ? (usable / total) * 100 : 0;

  return {
    runwayHeading,
    reciprocal,
    crosswindLimit,
    totalObservations: total,
    calmObservations: calmObs,
    exceedances,
    usableObservations: usable,
    usabilityPercent: usabilityPct,
    meets95: usabilityPct >= 95,
    componentBreakdown: {
      headwindPct: total > 0 ? (headwindCount / total) * 100 : 0,
      tailwindPct: total > 0 ? (tailwindCount / total) * 100 : 0,
      crosswindExceedPct: total > 0 ? (exceedances / total) * 100 : 0,
    },
  };
}

// ── Runway orientation optimization ────────────────────

export function optimizeRunwayOrientation(
  records: WindRecord[],
  crosswindLimit: number,
  calmThreshold: number = 3,
  useGust: boolean = false,
  stepDegrees: number = 1
): OptimizationResult {
  const results: RunwayUsabilityResult[] = [];

  for (let heading = 1; heading <= 180; heading += stepDegrees) {
    const result = calculateRunwayUsability(records, heading, crosswindLimit, calmThreshold, useGust);
    results.push(result);
  }

  // Sort by usability descending
  const sorted = [...results].sort((a, b) => b.usabilityPercent - a.usabilityPercent);

  return {
    headings: results,
    bestHeading: sorted[0]?.runwayHeading ?? 0,
    bestUsability: sorted[0]?.usabilityPercent ?? 0,
    top5: sorted.slice(0, 5).map((r) => ({ heading: r.runwayHeading, usability: r.usabilityPercent })),
  };
}
