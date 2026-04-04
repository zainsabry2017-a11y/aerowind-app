/** 16-point compass labels for 22.5° sectors (meteorological wind from). */
export const COMPASS_LABELS_16: readonly string[] = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

/** Human-readable degree band for the sector whose center is `centerDeg` (width = sectorSize). */
export function formatDegreeBand(centerDeg: number, sectorSize: number): string {
  const half = sectorSize / 2;
  const lo = (centerDeg - half + 360) % 360;
  const hi = (centerDeg + half + 360) % 360;
  const f = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
  if (lo > hi) return `${f(lo)}°–360° · 0°–${f(hi)}°`;
  return `${f(lo)}°–${f(hi)}°`;
}

/** Rows for UI: [Compass, Center °, Imported degrees fall in this band] */
export function windDirectionReferenceTableRows(sectorSize: number): string[][] {
  const num = Math.round(360 / sectorSize);
  if (num < 1 || num > 36) return [];
  const rows: string[][] = [];
  for (let i = 0; i < num; i++) {
    const center = i * sectorSize;
    const label =
      num === 16 && Math.abs(sectorSize - 22.5) < 0.001 ? COMPASS_LABELS_16[i] : `Bin ${i + 1}`;
    rows.push([label, `${center}°`, formatDegreeBand(center, sectorSize)]);
  }
  return rows;
}
