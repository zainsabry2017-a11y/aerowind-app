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
  calmThreshold: number = 3
): RunwayUsabilityResult {
  const reciprocal = (runwayHeading + 180) % 360;
  const validRecords = records.filter((r) => r.isValid);
  const total = validRecords.length;

  let calmObs = 0;
  let exceedances = 0;
  let headwindCount = 0;
  let tailwindCount = 0;

  for (const r of validRecords) {
    if (r.wind_speed_kt <= calmThreshold || r.isCalm) {
      calmObs++;
      continue;
    }

    // Check both runway ends — use the one with lower crosswind
    const comp1 = calculateWindComponents(r.wind_direction_deg, r.wind_speed_kt, runwayHeading);
    const comp2 = calculateWindComponents(r.wind_direction_deg, r.wind_speed_kt, reciprocal);

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
  stepDegrees: number = 1
): OptimizationResult {
  const results: RunwayUsabilityResult[] = [];

  for (let heading = 1; heading <= 180; heading += stepDegrees) {
    const result = calculateRunwayUsability(records, heading, crosswindLimit, calmThreshold);
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
