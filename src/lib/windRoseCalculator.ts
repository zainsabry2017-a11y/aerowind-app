import type { WindRecord } from "./windDataParser";

// ── Types ──────────────────────────────────────────────

export interface WindRoseBin {
  directionStart: number;
  directionEnd: number;
  directionCenter: number;
  label: string;
  speedBins: SpeedBin[];
  totalFrequency: number;
}

export interface SpeedBin {
  speedMin: number;
  speedMax: number;
  label: string;
  count: number;
  frequency: number;
}

export interface WindRoseResult {
  bins: WindRoseBin[];
  calmFrequency: number;
  calmCount: number;
  totalObservations: number;
  validObservations: number;
  maxFrequency: number;
  speedBinRanges: { min: number; max: number; label: string }[];
}

export interface WindRoseOptions {
  sectorSize: number;          // degrees: 10, 15, 22.5, etc.
  speedBins: number[];         // e.g. [0, 5, 10, 15, 20, 25]
  calmThreshold: number;       // knots
  useGust: boolean;
  monthFilter: number[] | null;   // 1-12, null = all
  seasonFilter: ("winter" | "spring" | "summer" | "fall")[] | null;
}

const SEASON_MONTHS: Record<string, number[]> = {
  winter: [12, 1, 2],
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
};

// ── Direction label helpers ────────────────────────────

function getDirectionLabel(center: number): string {
  const labels = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(center / 22.5) % 16;
  return labels[idx];
}

function getSpeedLabel(min: number, max: number): string {
  if (max === Infinity) return `≥${min} kts`;
  return `${min}–${max} kts`;
}

// ── Month extraction ───────────────────────────────────

function getMonth(record: WindRecord): number | null {
  if (!record.observation_date) return null;
  const d = new Date(record.observation_date);
  if (isNaN(d.getTime())) {
    const m = record.observation_date.match(/(\d{1,2})[/\-](\d{1,2})/);
    if (m) return parseInt(m[1]);
    return null;
  }
  return d.getMonth() + 1;
}

// ── Main wind rose calculator ──────────────────────────

export function calculateWindRose(records: WindRecord[], options: WindRoseOptions): WindRoseResult {
  const { sectorSize, speedBins, calmThreshold, useGust, monthFilter, seasonFilter } = options;

  // Filter records
  let filtered = records.filter((r) => r.isValid);

  if (monthFilter && monthFilter.length > 0) {
    filtered = filtered.filter((r) => {
      const m = getMonth(r);
      return m !== null && monthFilter.includes(m);
    });
  }

  if (seasonFilter && seasonFilter.length > 0) {
    const months = new Set(seasonFilter.flatMap((s) => SEASON_MONTHS[s]));
    filtered = filtered.filter((r) => {
      const m = getMonth(r);
      return m !== null && months.has(m);
    });
  }

  const totalObs = filtered.length;
  let calmCount = 0;
  const nonCalmRecords: WindRecord[] = [];

  for (const r of filtered) {
    const spd = useGust && r.wind_gust_kt !== null ? r.wind_gust_kt : r.wind_speed_kt;
    if (spd <= calmThreshold) {
      calmCount++;
    } else {
      nonCalmRecords.push(r);
    }
  }

  // Build direction bins
  const numSectors = Math.round(360 / sectorSize);
  const halfSector = sectorSize / 2;

  // Build speed bin ranges
  const speedRanges: { min: number; max: number; label: string }[] = [];
  for (let i = 0; i < speedBins.length - 1; i++) {
    speedRanges.push({
      min: speedBins[i],
      max: speedBins[i + 1],
      label: getSpeedLabel(speedBins[i], speedBins[i + 1]),
    });
  }
  speedRanges.push({
    min: speedBins[speedBins.length - 1],
    max: Infinity,
    label: getSpeedLabel(speedBins[speedBins.length - 1], Infinity),
  });

  const bins: WindRoseBin[] = [];

  for (let i = 0; i < numSectors; i++) {
    const center = i * sectorSize;
    const start = (center - halfSector + 360) % 360;
    const end = (center + halfSector) % 360;

    const spdBins: SpeedBin[] = speedRanges.map((sr) => ({
      speedMin: sr.min,
      speedMax: sr.max,
      label: sr.label,
      count: 0,
      frequency: 0,
    }));

    bins.push({
      directionStart: start,
      directionEnd: end,
      directionCenter: center,
      label: getDirectionLabel(center),
      speedBins: spdBins,
      totalFrequency: 0,
    });
  }

  // Assign records to bins
  for (const r of nonCalmRecords) {
    const spd = useGust && r.wind_gust_kt !== null ? r.wind_gust_kt : r.wind_speed_kt;
    const dir = r.wind_direction_deg;

    // Find direction bin
    let binIdx = Math.round(dir / sectorSize) % numSectors;
    const bin = bins[binIdx];

    // Find speed bin
    for (const sb of bin.speedBins) {
      if (spd >= sb.speedMin && (sb.speedMax === Infinity ? true : spd < sb.speedMax)) {
        sb.count++;
        break;
      }
    }
  }

  // Calculate frequencies
  let maxFreq = 0;
  for (const bin of bins) {
    let total = 0;
    for (const sb of bin.speedBins) {
      sb.frequency = totalObs > 0 ? (sb.count / totalObs) * 100 : 0;
      total += sb.frequency;
    }
    bin.totalFrequency = total;
    if (total > maxFreq) maxFreq = total;
  }

  return {
    bins,
    calmFrequency: totalObs > 0 ? (calmCount / totalObs) * 100 : 0,
    calmCount,
    totalObservations: totalObs,
    validObservations: nonCalmRecords.length + calmCount,
    maxFrequency: maxFreq,
    speedBinRanges: speedRanges,
  };
}

export const DEFAULT_WIND_ROSE_OPTIONS: WindRoseOptions = {
  sectorSize: 22.5,
  speedBins: [0, 4, 7, 11, 17, 22],
  calmThreshold: 3,
  useGust: false,
  monthFilter: null,
  seasonFilter: null,
};
