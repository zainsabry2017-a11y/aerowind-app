/** Calendar month number (1–12) and full English name — used for import QA and reports. */
export const CALENDAR_MONTHS: readonly { num: number; name: string }[] = Array.from({ length: 12 }, (_, i) => ({
  num: i + 1,
  name: new Date(2000, i, 1).toLocaleString("en", { month: "long" }),
}));

/**
 * Meteorological / climate-style seasons (Northern Hemisphere).
 * Each lists included calendar months by name for clarity in the UI.
 */
export const METEOROLOGICAL_SEASONS: readonly {
  label: string;
  /** Human-readable month list (matches month indices below). */
  monthsNamed: string;
  /** UTC month indices 0–11 included in this season. */
  months0: readonly number[];
}[] = [
  {
    label: "Winter",
    monthsNamed: "December, January, February",
    months0: [11, 0, 1],
  },
  {
    label: "Spring",
    monthsNamed: "March, April, May",
    months0: [2, 3, 4],
  },
  {
    label: "Summer",
    monthsNamed: "June, July, August",
    months0: [5, 6, 7],
  },
  {
    label: "Fall (Autumn)",
    monthsNamed: "September, October, November",
    months0: [8, 9, 10],
  },
];

export function sumMonthCountsForSeason(monthCounts12: readonly number[], seasonIdx: number): number {
  const s = METEOROLOGICAL_SEASONS[seasonIdx];
  if (!s) return 0;
  return s.months0.reduce((acc, m) => acc + (monthCounts12[m] ?? 0), 0);
}
