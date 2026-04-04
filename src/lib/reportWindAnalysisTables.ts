import type { WindRecord } from "@/lib/windDataParser";
import type { WindRoseResult } from "@/lib/windRoseCalculator";

export interface SpeedDistRow {
  label: string;
  count: number;
  freq: number;
}

export interface CrosswindBinRow {
  label: string;
  min: number;
  max: number;
  count: number;
  freq: number;
}

export interface CrosswindAnalysisResult {
  bins: CrosswindBinRow[];
  coverage: number;
  totalValid: number;
}

export function computeSpeedDistributionRows(windRose: WindRoseResult | null): SpeedDistRow[] {
  if (!windRose) return [];
  return windRose.speedBinRanges.map((range, i) => {
    let count = 0;
    let freq = 0;
    windRose.bins.forEach((bin) => {
      if (bin.speedBins[i]) {
        count += bin.speedBins[i].count;
        freq += bin.speedBins[i].frequency;
      }
    });
    return { label: range.label, count, freq };
  });
}

export function computeCrosswindAnalysis(
  records: WindRecord[],
  orientation: number | null,
  cwLimit: number | null,
  options: {
    mode: "airport" | "heliport" | "water";
    calmThresholdKts?: number;
    useGust?: boolean;
  }
): CrosswindAnalysisResult | null {
  if (orientation === null || cwLimit === null || cwLimit <= 0 || !records.length) return null;

  let within = 0;
  let totalValid = 0;
  const useDynamicCalm =
    options.mode === "heliport" &&
    options.calmThresholdKts !== undefined &&
    Number.isFinite(options.calmThresholdKts);
  const useGust = options.useGust === true;

  const bins: CrosswindBinRow[] = [
    { label: "0-5 kt", min: 0, max: 5, count: 0, freq: 0 },
    { label: "6-10 kt", min: 5, max: 10, count: 0, freq: 0 },
    { label: "11-15 kt", min: 10, max: 15, count: 0, freq: 0 },
    { label: "16-20 kt", min: 15, max: 20, count: 0, freq: 0 },
    { label: "21-25 kt", min: 20, max: 25, count: 0, freq: 0 },
    { label: "25+ kt", min: 25, max: Infinity, count: 0, freq: 0 },
  ];

  records.forEach((r) => {
    if (!r.isValid) return;
    const windSpd = useGust && r.wind_gust_kt !== null ? r.wind_gust_kt : r.wind_speed_kt;
    const isCalmObs = useDynamicCalm ? windSpd <= options.calmThresholdKts! : r.isCalm;
    if (isCalmObs) {
      bins[0].count++;
      within++;
      totalValid++;
      return;
    }
    totalValid++;
    let dirDiff = Math.abs(r.wind_direction_deg - orientation);
    if (dirDiff > 180) dirDiff = 360 - dirDiff;
    const rad = (dirDiff * Math.PI) / 180;
    const cw = Math.abs(windSpd * Math.sin(rad));

    if (cw <= cwLimit) within++;

    // Ensure every valid observation is counted into exactly one bin:
    // - lower bounds are inclusive
    // - upper bounds are exclusive, except for the last bin (Infinity)
    const idx = bins.findIndex((b, i) => {
      const lowerOk = cw >= b.min;
      const upperOk = i === bins.length - 1 ? cw <= b.max : cw < b.max;
      return lowerOk && upperOk;
    });
    if (idx >= 0) bins[idx].count++;
  });

  const freqDenom = totalValid > 0 ? totalValid : 1;
  return {
    bins: bins.map((b) => ({ ...b, freq: (b.count / freqDenom) * 100 })),
    coverage: totalValid > 0 ? (within / totalValid) * 100 : 0,
    totalValid,
  };
}

export function heliportPerfClassDefaultXw(perfClass: string): number {
  return perfClass === "1" ? 17 : perfClass === "2" ? 15 : perfClass === "3" ? 10 : 15;
}
