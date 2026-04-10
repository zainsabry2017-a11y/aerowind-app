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

/** ICAO-style minimum angular separation between two declared FATO inbound directions (non-collinear preferential axes). */
export const ICAO_MIN_FATO_DUAL_AXIS_SEPARATION_DEG = 135;

export function normalizeCompassDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** Format 0–360° for display (0 shown as 360 to match runway convention). */
export function formatCompassHdg(deg: number): string {
  const d = normalizeCompassDeg(deg) || 360;
  return String(Math.round(d)).padStart(3, "0");
}

export type ParsedFatoAxis =
  | { ok: true; h1: number; h2: number; /** Advisory when two headings are closer than ICAO_MIN_FATO_DUAL_AXIS_SEPARATION_DEG */ icaoSeparationWarning: string | null }
  | { ok: false; error: string };

/**
 * Parse "090", "090/270", "180/360". One value implies reciprocal (+180°).
 * Two values may be any separation; if below ICAO_MIN_FATO_DUAL_AXIS_SEPARATION_DEG, parsing still succeeds with `icaoSeparationWarning`.
 */
export function parseFatoAxisInput(raw: string): ParsedFatoAxis {
  const t = raw.trim().replace(/°/g, "");
  if (!t) return { ok: false, error: "Enter heading(s), e.g. 068 or 180/360." };
  const parts = t.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 2) return { ok: false, error: "Use at most two headings separated by /." };
  const n1 = parseFloat(parts[0]!);
  if (!Number.isFinite(n1)) return { ok: false, error: "Invalid heading." };
  const h1 = normalizeCompassDeg(n1);
  if (parts.length === 1) {
    const h2 = (h1 + 180) % 360;
    return { ok: true, h1, h2, icaoSeparationWarning: null };
  }
  const n2 = parseFloat(parts[1]!);
  if (!Number.isFinite(n2)) return { ok: false, error: "Invalid second heading." };
  const h2 = normalizeCompassDeg(n2);
  const sep = smallestAngleDifferenceDeg(h1, h2);
  const icaoSeparationWarning =
    sep < ICAO_MIN_FATO_DUAL_AXIS_SEPARATION_DEG - 1e-6
      ? `ICAO advisory: angle between directions is ${sep.toFixed(0)}° (often ≥ ${ICAO_MIN_FATO_DUAL_AXIS_SEPARATION_DEG}° is expected for distinct preferential axes). Analysis proceeds.`
      : null;
  return { ok: true, h1, h2, icaoSeparationWarning };
}

/** Second FATO inbound direction: explicit pair or reciprocal of first. */
export function resolvedFatoSecondAxisDeg(first: number, second: number | null | undefined): number {
  if (second != null && Number.isFinite(second)) return normalizeCompassDeg(second);
  return (normalizeCompassDeg(first) + 180) % 360;
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

/** Prefer inbound end of two declared FATO directions closest to wind-from (headwind). */
export function inboundHeadingForHeadwindDual(windFromDeg: number, inboundDeg1: number, inboundDeg2: number): number {
  const w = ((windFromDeg % 360) + 360) % 360;
  const a = normalizeCompassDeg(inboundDeg1);
  const b = normalizeCompassDeg(inboundDeg2);
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
  useGust: boolean = false,
  /** Optional second inbound direction; default is reciprocal (+180°). */
  secondInboundDeg?: number | null
): RunwayUsabilityResult {
  const h1 = normalizeCompassDeg(runwayHeading);
  const h2 =
    secondInboundDeg != null && Number.isFinite(secondInboundDeg)
      ? normalizeCompassDeg(secondInboundDeg)
      : (h1 + 180) % 360;
  const reciprocal = h2;
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

    // Check both declared inbound directions — use the one with lower crosswind
    const comp1 = calculateWindComponents(r.wind_direction_deg, windSpd, h1);
    const comp2 = calculateWindComponents(r.wind_direction_deg, windSpd, h2);

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
    runwayHeading: h1,
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
