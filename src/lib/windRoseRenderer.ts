import type { WindRoseResult } from "./windRoseCalculator";
import { smallestAngleDifferenceDeg, type RunwayUsabilityResult } from "./windComponents";

// ── SVG Wind Rose Renderer (4 styles) ──────────────────
// Premium consultant-grade visuals with high contrast

const SPEED_COLORS = [
  "#34d399", "#22d3ee", "#60a5fa", "#fbbf24", "#f97316", "#ef4444",
];

const BG = "#0a1628";
const GRID = "#1e3a5f";
const TEXT_DIM = "#94a3b8";
const TEXT_BRIGHT = "#f1f5f9";
const CYAN = "#22d3ee";
const ACCENT = "#06b6d4";

interface RenderOptions {
  size?: number;
  title?: string;
  subtitle?: string;
  showLegend?: boolean;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildPetals(data: WindRoseResult, cx: number, cy: number, maxR: number): string {
  const maxFreq = data.maxFrequency || 1;
  let paths = "";

  for (const bin of data.bins) {
    const sectorWidth = (360 / data.bins.length) * 0.85;
    const halfAngle = sectorWidth / 2;
    let cumulativeR = 0;

    for (let si = 0; si < bin.speedBins.length; si++) {
      const sb = bin.speedBins[si];
      if (sb.frequency <= 0) continue;

      const innerR = cumulativeR;
      const outerR = cumulativeR + (sb.frequency / maxFreq) * maxR;
      cumulativeR = outerR;

      const a1 = bin.directionCenter - halfAngle;
      const a2 = bin.directionCenter + halfAngle;
      const p1i = polarToXY(cx, cy, innerR, a1);
      const p2i = polarToXY(cx, cy, innerR, a2);
      const p1o = polarToXY(cx, cy, outerR, a1);
      const p2o = polarToXY(cx, cy, outerR, a2);

      const largeArc = sectorWidth > 180 ? 1 : 0;
      paths += `<path d="M ${p1i.x} ${p1i.y} L ${p1o.x} ${p1o.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2o.x} ${p2o.y} L ${p2i.x} ${p2i.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${p1i.x} ${p1i.y} Z" fill="${SPEED_COLORS[si % SPEED_COLORS.length]}" fill-opacity="0.9" stroke="${BG}" stroke-width="1"/>`;
    }
  }
  return paths;
}

function buildGrid(cx: number, cy: number, maxR: number, maxFreq: number): string {
  let svg = "";
  const rings = [0.25, 0.5, 0.75, 1];
  for (const f of rings) {
    const r = maxR * f;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GRID}" stroke-width="${f === 1 ? '1' : '0.5'}" ${f < 1 ? 'stroke-dasharray="4,4"' : ''}/>`;
    // Frequency label on each ring
    const val = (maxFreq * f).toFixed(1);
    svg += `<text x="${cx + 5}" y="${cy - r + 12}" fill="${TEXT_DIM}" font-size="9" font-family="'IBM Plex Mono', monospace" opacity="0.7">${val}%</text>`;
  }
  // Cross-hairs
  svg += `<line x1="${cx}" y1="${cy - maxR - 5}" x2="${cx}" y2="${cy + maxR + 5}" stroke="${GRID}" stroke-width="0.5" opacity="0.5"/>`;
  svg += `<line x1="${cx - maxR - 5}" y1="${cy}" x2="${cx + maxR + 5}" y2="${cy}" stroke="${GRID}" stroke-width="0.5" opacity="0.5"/>`;
  // Diagonal lines
  for (const a of [45, 135, 225, 315]) {
    const p1 = polarToXY(cx, cy, maxR + 5, a);
    svg += `<line x1="${cx}" y1="${cy}" x2="${p1.x}" y2="${p1.y}" stroke="${GRID}" stroke-width="0.3" opacity="0.3"/>`;
  }

  // Cardinal labels — larger, bolder
  const cardinals: { l: string; a: number; bold: boolean }[] = [
    { l: "N", a: 0, bold: true }, { l: "NE", a: 45, bold: false },
    { l: "E", a: 90, bold: true }, { l: "SE", a: 135, bold: false },
    { l: "S", a: 180, bold: true }, { l: "SW", a: 225, bold: false },
    { l: "W", a: 270, bold: true }, { l: "NW", a: 315, bold: false },
  ];
  for (const c of cardinals) {
    const p = polarToXY(cx, cy, maxR + (c.bold ? 22 : 18), c.a);
    svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${c.bold ? TEXT_BRIGHT : TEXT_DIM}" font-size="${c.bold ? '14' : '10'}" font-family="'IBM Plex Sans', sans-serif" font-weight="${c.bold ? '700' : '400'}">${c.l}</text>`;
  }
  return svg;
}

function buildLegend(data: WindRoseResult, x: number, y: number): string {
  let svg = `<text x="${x}" y="${y - 8}" fill="${TEXT_DIM}" font-size="9" font-family="'IBM Plex Mono', monospace" font-weight="500">SPEED (kt)</text>`;
  data.speedBinRanges.forEach((sr, i) => {
    const ly = y + i * 20;
    svg += `<rect x="${x}" y="${ly}" width="16" height="12" rx="2" fill="${SPEED_COLORS[i % SPEED_COLORS.length]}"/>`;
    svg += `<text x="${x + 22}" y="${ly + 10}" fill="${TEXT_DIM}" font-size="10" font-family="'IBM Plex Mono', monospace">${sr.label}</text>`;
  });
  const cly = y + data.speedBinRanges.length * 20 + 4;
  svg += `<circle cx="${x + 8}" cy="${cly + 6}" r="6" fill="none" stroke="${CYAN}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
  svg += `<text x="${x + 22}" y="${cly + 10}" fill="${CYAN}" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="500">Calm: ${data.calmFrequency.toFixed(1)}%</text>`;
  return svg;
}

// ── Style 1: Executive ─────────────────────────────────

export function renderExecutiveWindRose(data: WindRoseResult, opts: RenderOptions = {}): string {
  const size = opts.size || 560;
  const margin = 80;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const maxR = size / 2 - margin;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 40}" width="${size}" height="${size + 40}" style="background:${BG};border-radius:4px">
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${CYAN}" stop-opacity="0.08"/><stop offset="100%" stop-color="${BG}" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${maxR + 10}" fill="url(#glow)"/>
    ${buildGrid(cx, cy, maxR, data.maxFrequency)}
    ${buildPetals(data, cx, cy, maxR)}
    <circle cx="${cx}" cy="${cy}" r="18" fill="${BG}" stroke="${CYAN}" stroke-width="2"/>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="central" fill="${CYAN}" font-size="9" font-family="'IBM Plex Mono', monospace" font-weight="600">${data.calmFrequency.toFixed(1)}%</text>
    <text x="${cx}" y="${cy + 9}" text-anchor="middle" fill="${TEXT_DIM}" font-size="6" font-family="'IBM Plex Mono', monospace">CALM</text>
    ${opts.title ? `<text x="${cx}" y="22" text-anchor="middle" fill="${TEXT_BRIGHT}" font-size="16" font-family="'IBM Plex Sans', sans-serif" font-weight="700">${opts.title}</text>` : ""}
    ${opts.subtitle ? `<text x="${cx}" y="40" text-anchor="middle" fill="${TEXT_DIM}" font-size="10" font-family="'IBM Plex Mono', monospace">${opts.subtitle}</text>` : ""}
    <text x="${cx}" y="${size + 30}" text-anchor="middle" fill="${TEXT_DIM}" font-size="8" font-family="'IBM Plex Mono', monospace">${data.totalObservations.toLocaleString()} observations  |  ${data.bins.length} sectors  |  ICAO-Based Assessment</text>
    ${opts.showLegend !== false ? buildLegend(data, 14, size - 140) : ""}
  </svg>`;
}

// ── Style 2: Engineering ───────────────────────────────

export function renderEngineeringWindRose(data: WindRoseResult, opts: RenderOptions = {}): string {
  const size = opts.size || 640;
  const margin = 90;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const maxR = size / 2 - margin;

  // Degree ticks every 10°
  let ticks = "";
  for (let d = 0; d < 360; d += 10) {
    const isMajor = d % 30 === 0;
    const inner = polarToXY(cx, cy, maxR + 2, d);
    const outer = polarToXY(cx, cy, maxR + (isMajor ? 10 : 5), d);
    ticks += `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="${isMajor ? TEXT_DIM : GRID}" stroke-width="${isMajor ? '1' : '0.5'}"/>`;
    if (d % 30 === 0 && d % 90 !== 0) {
      const labelP = polarToXY(cx, cy, maxR + 16, d);
      ticks += `<text x="${labelP.x}" y="${labelP.y}" text-anchor="middle" dominant-baseline="central" fill="${TEXT_DIM}" font-size="8" font-family="'IBM Plex Mono', monospace">${d}°</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 40}" width="${size}" height="${size + 40}" style="background:${BG};border-radius:4px">
    ${ticks}
    ${buildGrid(cx, cy, maxR, data.maxFrequency)}
    ${buildPetals(data, cx, cy, maxR)}
    <circle cx="${cx}" cy="${cy}" r="20" fill="${BG}" stroke="${CYAN}" stroke-width="2"/>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="central" fill="${CYAN}" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="600">${data.calmFrequency.toFixed(1)}%</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="${TEXT_DIM}" font-size="6" font-family="'IBM Plex Mono', monospace">CALM</text>
    ${opts.title ? `<text x="${cx}" y="22" text-anchor="middle" fill="${TEXT_BRIGHT}" font-size="16" font-family="'IBM Plex Sans', sans-serif" font-weight="700">${opts.title}</text>` : ""}
    ${opts.subtitle ? `<text x="${cx}" y="42" text-anchor="middle" fill="${TEXT_DIM}" font-size="10" font-family="'IBM Plex Mono', monospace">${opts.subtitle}</text>` : ""}
    <text x="${cx}" y="${size + 30}" text-anchor="middle" fill="${TEXT_DIM}" font-size="8" font-family="'IBM Plex Mono', monospace">${data.totalObservations.toLocaleString()} obs  |  ${data.bins.length} sectors  |  Engineering Detail</text>
    ${buildLegend(data, 14, size - 160)}
  </svg>`;
}

// ── Style 3: Runway Overlay ────────────────────────────

export function renderRunwayOverlayWindRose(
  data: WindRoseResult,
  runwayHeadings: number[],
  usabilityResults: RunwayUsabilityResult[],
  crosswindLimit: number,
  opts: RenderOptions = {}
): string {
  const size = opts.size || 580;
  const margin = 80;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const maxR = size / 2 - margin;

  // Runway lines
  let runways = "";
  runwayHeadings.forEach((hdg, i) => {
    const recip = (hdg + 180) % 360;
    const p1 = polarToXY(cx, cy, maxR + 30, hdg);
    const p2 = polarToXY(cx, cy, maxR + 30, recip);
    const color = i === 0 ? CYAN : "#a78bfa";
    // Wider runway line with glow
    runways += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="4" stroke-opacity="0.3"/>`;
    runways += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="2" stroke-dasharray="8,4"/>`;
    // Heading labels with background
    const l1 = polarToXY(cx, cy, maxR + 40, hdg);
    const l2 = polarToXY(cx, cy, maxR + 40, recip);
    runways += `<rect x="${l1.x - 18}" y="${l1.y - 9}" width="36" height="18" rx="2" fill="${BG}" stroke="${color}" stroke-width="1"/>`;
    runways += `<text x="${l1.x}" y="${l1.y + 4}" text-anchor="middle" fill="${color}" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="700">${String(hdg).padStart(3, "0")}°</text>`;
    runways += `<rect x="${l2.x - 18}" y="${l2.y - 9}" width="36" height="18" rx="2" fill="${BG}" stroke="${color}" stroke-width="0.5"/>`;
    runways += `<text x="${l2.x}" y="${l2.y + 4}" text-anchor="middle" fill="${color}" font-size="9" font-family="'IBM Plex Mono', monospace">${String(recip).padStart(3, "0")}°</text>`;
  });

  // Annotation box
  let annotations = "";
  const boxH = usabilityResults.length * 18 + 12;
  annotations += `<rect x="8" y="${size - boxH - 8}" width="${size - 16}" height="${boxH}" rx="3" fill="${BG}" fill-opacity="0.9" stroke="${GRID}" stroke-width="1"/>`;
  usabilityResults.forEach((r, i) => {
    const color = i === 0 ? CYAN : "#a78bfa";
    const y = size - boxH + 6 + i * 18;
    const passLabel = r.meets95 ? "✓ PASS" : "✗ BELOW 95%";
    annotations += `<text x="16" y="${y}" fill="${color}" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="500">RWY ${String(r.runwayHeading).padStart(3, "0")}/${String(r.reciprocal).padStart(3, "0")}  →  ${r.usabilityPercent.toFixed(1)}% usability  @${crosswindLimit} kt XW  ${passLabel}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 20}" width="${size}" height="${size + 20}" style="background:${BG};border-radius:4px">
    ${buildGrid(cx, cy, maxR, data.maxFrequency)}
    ${buildPetals(data, cx, cy, maxR)}
    ${runways}
    <circle cx="${cx}" cy="${cy}" r="16" fill="${BG}" stroke="${CYAN}" stroke-width="2"/>
    <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central" fill="${CYAN}" font-size="8" font-family="'IBM Plex Mono', monospace">${data.calmFrequency.toFixed(1)}%</text>
    ${opts.title ? `<text x="${cx}" y="22" text-anchor="middle" fill="${TEXT_BRIGHT}" font-size="15" font-family="'IBM Plex Sans', sans-serif" font-weight="700">${opts.title}</text>` : ""}
    ${annotations}
  </svg>`;
}

// ── Consultant grid (direction × speed rings, % in cells, hatched runway corridor) ──

export interface ConsultantGridWindRoseOptions extends RenderOptions {
  /** Inbound runway / FATO axis (°); corridor also mirrored at +180° */
  runwayHeadingDeg?: number | null;
  /** Second inbound FATO direction when not reciprocal; optional second hatched corridor */
  runwayHeading2Deg?: number | null;
  crosswindLimitKt?: number;
  /** Half-angle of corridor uses arcsin(L/V); default 25 kt if omitted */
  refSpeedKt?: number;
  /** Tighter layout (smaller margins/notes) */
  compact?: boolean;
}

function annularSectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  centerDeg: number,
  halfSectorDeg: number
): string {
  const a1 = centerDeg - halfSectorDeg;
  const a2 = centerDeg + halfSectorDeg;
  const p1i = polarToXY(cx, cy, rIn, a1);
  const p2i = polarToXY(cx, cy, rIn, a2);
  const p1o = polarToXY(cx, cy, rOut, a1);
  const p2o = polarToXY(cx, cy, rOut, a2);
  const span = a2 - a1;
  const largeArc = span > 180 ? 1 : 0;
  return `M ${p1i.x} ${p1i.y} A ${rIn} ${rIn} 0 ${largeArc} 1 ${p2i.x} ${p2i.y} L ${p2o.x} ${p2o.y} A ${rOut} ${rOut} 0 ${largeArc} 0 ${p1o.x} ${p1o.y} Z`;
}

/** Rectangular corridor band starting at center and extending outward along heading. */
function corridorRectFromCenter(
  cx: number,
  cy: number,
  innerGap: number,
  length: number,
  width: number,
  headingDeg: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  fillOpacity: number
): string {
  const w = Math.max(0, width);
  const gap = Math.max(0, innerGap);
  const len = Math.max(0, length - gap);
  // Draw unrotated pointing "east" from (cx,cy), then rotate around center.
  const x = cx + gap;
  const y = cy - w / 2;
  const compass = ((((headingDeg % 360) + 360) % 360) as number);
  // SVG rotation is relative to +X (east). Compass heading is relative to north.
  const rot = compass - 90;
  return `<rect x="${x}" y="${y}" width="${len}" height="${w}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" transform="rotate(${rot} ${cx} ${cy})"/>`;
}

/** Half-angle (°) of “low crosswind” corridor: |sin θ| ≤ L / V at reference speed V. */
export function crosswindCorridorHalfAngleDeg(crosswindLimitKt: number, refSpeedKt: number): number {
  const v = Math.max(refSpeedKt, crosswindLimitKt, 1e-6);
  const ratio = Math.min(1, crosswindLimitKt / v);
  return (Math.asin(ratio) * 180) / Math.PI;
}

/**
 * Polar table: each cell = % of all observations in that direction sector and speed ring.
 * Optional hatched wedges along runway ± corridor width (from crosswind limit and ref speed).
 */
export function renderConsultantGridWindRose(data: WindRoseResult, opts: ConsultantGridWindRoseOptions = {}): string {
  const size = opts.size || 640;
  const compact = !!opts.compact;
  // Reserve a right-side gutter for the legend so it never overlaps the rim.
  const leftGutter = compact ? 56 : 72;
  const rightGutter = compact ? 170 : 190;
  const topGutter = compact ? 54 : 70;
  const bottomGutter = compact ? 40 : 56;

  const drawW = size - leftGutter - rightGutter;
  const drawH = size - topGutter - bottomGutter;

  const maxR = Math.min(drawW, drawH) / 2;
  const cx = leftGutter + drawW / 2;
  const cy = topGutter + drawH / 2 + 10;
  const outerR = maxR + 2;
  const outerGap = compact ? 14 : 18; // visual breathing room between last ring and rim
  const plotR = Math.max(10, maxR - outerGap);
  const numSectors = data.bins.length;
  const halfSector = 180 / numSectors;
  const numRings = data.speedBinRanges.length;
  const calmR = Math.min(compact ? 24 : 32, plotR * 0.11);
  const ringSpan = (plotR - calmR) / Math.max(1, numRings);

  const PAPER = "#f8fafc";
  const GRID = "#334155";
  const GRID_FAINT = "#cbd5e1";
  const SECTOR_LINE = "#ea580c";
  const TEXT = "#0f172a";
  const FREQ = "#dc2626";
  const HATCH_STROKE = "#64748b";
  const speedRingColor = (i: number, n: number) => {
    // Data-driven palette that works for any number of rings.
    // Green → yellow → orange → red → purple → blue (wrap).
    const stops = [
      "#22c55e",
      "#84cc16",
      "#eab308",
      "#f97316",
      "#ef4444",
      "#a855f7",
      "#0ea5e9",
      "#64748b",
    ];
    if (n <= stops.length) return stops[i] ?? stops[stops.length - 1];
    const t = n <= 1 ? 0 : i / (n - 1);
    const hue = 120 - 220 * t; // 120 (green) → -100 (wraps to 260/purple)
    const h = ((hue % 360) + 360) % 360;
    const s = 80;
    const l = 52;
    return `hsl(${h} ${s}% ${l}%)`;
  };

  // Ring totals (for legend auto emphasis)
  const ringTotals = Array.from({ length: numRings }, () => ({ count: 0, freq: 0 }));
  for (const bin of data.bins) {
    for (let ki = 0; ki < numRings; ki++) {
      const sb = bin.speedBins[ki];
      if (!sb) continue;
      ringTotals[ki].count += sb.count ?? 0;
      ringTotals[ki].freq += sb.frequency ?? 0;
    }
  }

  const hdg = opts.runwayHeadingDeg;
  const hdg2 = opts.runwayHeading2Deg;
  const xwL = opts.crosswindLimitKt;
  const refV = opts.refSpeedKt != null && Number.isFinite(opts.refSpeedKt) ? opts.refSpeedKt : 25;
  const showCorridor =
    hdg != null &&
    Number.isFinite(hdg) &&
    xwL != null &&
    Number.isFinite(xwL) &&
    xwL > 0;
  const halfDelta = showCorridor ? crosswindCorridorHalfAngleDeg(xwL, refV) : 0;

  let defs = `<defs>
    <pattern id="consultantHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${HATCH_STROKE}" stroke-width="1.2"/>
    </pattern>
  </defs>`;

  // Outer circle + tick marks:
  // - Major every 10°
  // - Minor every 1° (9 ticks between 10° marks)
  let degTicks = "";
  degTicks += `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${GRID}" stroke-width="0.9"/>`;

  for (let d = 0; d < 360; d += 1) {
    const isMajor = d % 10 === 0;
    const tIn = polarToXY(cx, cy, outerR, d);
    const tOut = polarToXY(cx, cy, outerR + (isMajor ? 9 : 5), d);
    degTicks += `<line x1="${tIn.x}" y1="${tIn.y}" x2="${tOut.x}" y2="${tOut.y}" stroke="${GRID_FAINT}" stroke-width="${isMajor ? 0.85 : 0.45}"/>`;

    // Compact degree numbers every 10°
    if (isMajor) {
      const lp = polarToXY(cx, cy, outerR + (compact ? 16 : 18), d);
      const label = d === 0 ? "360" : String(d);
      degTicks += `<text x="${lp.x}" y="${lp.y}" text-anchor="middle" dominant-baseline="central" fill="${GRID}" font-size="${compact ? 6 : 7}" font-family="Courier New, Courier, monospace" transform="rotate(${d} ${lp.x} ${lp.y})">${label}</text>`;
    }
  }

  // 16-wind direction labels around the rim (N, NNE, NE, ...)
  const dirLabels = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  for (let i = 0; i < dirLabels.length; i++) {
    const a = i * 22.5;
    const p = polarToXY(cx, cy, outerR + (compact ? 30 : 34), a);
    // Tangential rotation looks best; flip upside-down labels for readability
    const rot = a > 90 && a < 270 ? a + 180 : a;
    degTicks += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${TEXT}" font-size="${compact ? 11 : 13}" font-family="Arial, Helvetica, sans-serif" font-weight="700" transform="rotate(${rot} ${p.x} ${p.y})">${dirLabels[i]}</text>`;
  }

  // Radial sector lines (orange)
  let radials = "";
  for (const bin of data.bins) {
    const a = bin.directionCenter - halfSector;
    const p0 = polarToXY(cx, cy, calmR, a);
    const p1 = polarToXY(cx, cy, plotR, a);
    radials += `<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="${SECTOR_LINE}" stroke-width="0.6" opacity="0.85"/>`;
  }

  // Concentric speed rings
  let rings = "";
  for (let k = 0; k <= numRings; k++) {
    const r = calmR + k * ringSpan;
    rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${k === numRings ? GRID : GRID_FAINT}" stroke-width="${k === numRings ? 1.2 : 0.55}"/>`;
  }

  // Hatched corridors: rectangular bands from center along each declared inbound direction
  let corridor = "";
  if (showCorridor) {
    const h = ((((hdg as number) % 360) + 360) % 360);
    const h2 =
      hdg2 != null && Number.isFinite(hdg2)
        ? ((((hdg2 as number) % 360) + 360) % 360)
        : (h + 180) % 360;
    const sep = smallestAngleDifferenceDeg(h, h2);
    // Convert half-angle to corridor full width at outer radius.
    // width ≈ 2 * r * sin(halfDelta)
    const bandW = Math.max(10, 2 * plotR * Math.sin((halfDelta * Math.PI) / 180));
    const pushBand = (centerDeg: number) => {
      corridor += corridorRectFromCenter(
        cx,
        cy,
        calmR + 1,
        plotR,
        bandW,
        centerDeg,
        "url(#consultantHatch)",
        GRID,
        0.5,
        0.42,
        0.85
      );
    };
    if (sep <= 1) {
      pushBand(h);
    } else {
      pushBand(h);
      pushBand(h2);
    }
  }

  // Cells + frequency labels
  let cells = "";
  for (const bin of data.bins) {
    for (let ki = 0; ki < numRings; ki++) {
      const rIn = calmR + ki * ringSpan;
      const rOut = calmR + (ki + 1) * ringSpan;
      const sb = bin.speedBins[ki];
      const freq = sb?.frequency ?? 0;
      const path = annularSectorPath(cx, cy, rIn, rOut, bin.directionCenter, halfSector - 0.15);
      const ringColor = speedRingColor(ki, numRings);
      const fillOp = freq > 0 ? 0.08 + Math.min(0.45, freq / (data.maxFrequency * 1.6 || 1)) : 0.018;
      cells += `<path d="${path}" fill="${ringColor}" fill-opacity="${fillOp}" stroke="${GRID_FAINT}" stroke-width="0.35"/>`;
      const midR = (rIn + rOut) / 2;
      const tp = polarToXY(cx, cy, midR, bin.directionCenter);
      const t = freq < 0.005 ? "0" : freq.toFixed(2);
      cells += `<text x="${tp.x}" y="${tp.y}" text-anchor="middle" dominant-baseline="central" fill="${FREQ}" font-size="${numSectors > 20 ? 6 : 7}" font-family="Courier New, Courier, monospace" font-weight="500">${t}</text>`;
    }
  }

  // Cardinal labels are handled by rim 16-wind labels above (more compact and consistent)
  const cardinals = "";

  // Speed ring legend (right gutter)
  const legendX0 = size - rightGutter + 18;
  let legY = topGutter + 18;
  const sw = compact ? 8 : 10;
  const lh = compact ? 12 : 14;
  const legendBoxW = rightGutter - 26;
  const legendBoxH = (data.speedBinRanges.length + 1) * lh + 10;
  let legend = `<rect x="${size - rightGutter + 10}" y="${topGutter + 6}" width="${legendBoxW}" height="${legendBoxH}" rx="3" fill="${PAPER}" stroke="${GRID_FAINT}" stroke-width="0.8"/>`;
  legend += `<text x="${legendX0}" y="${legY}" text-anchor="start" fill="${GRID}" font-size="${compact ? 7 : 8}" font-family="Courier New, Courier, monospace" font-weight="600">SPEED (kt)</text>`;
  data.speedBinRanges.forEach((sr, i) => {
    const c = speedRingColor(i, numRings);
    const freq = ringTotals[i]?.freq ?? 0;
    const count = ringTotals[i]?.count ?? 0;
    // Auto-emphasis: rings with no data become muted
    const muted = count === 0;
    const swOpacity = muted ? 0.18 : 0.9;
    const txtOpacity = muted ? 0.45 : 1;
    legY += lh;
    // swatch + label (right aligned)
    legend += `<rect x="${legendX0}" y="${legY - (sw - 1)}" width="${sw}" height="${sw}" rx="1" fill="${c}" opacity="${swOpacity}" stroke="${GRID_FAINT}" stroke-width="0.5"/>`;
    legend += `<text x="${legendX0 + sw + 8}" y="${legY}" text-anchor="start" dominant-baseline="central" fill="${GRID}" fill-opacity="${txtOpacity}" font-size="${compact ? 6.5 : 7}" font-family="Courier New, Courier, monospace">${sr.label.replace(" kts", " kt")}${muted ? " (0)" : ""}</text>`;
    // tiny frequency indicator (auto, from drawing result)
    if (!compact) {
      legend += `<text x="${size - 12}" y="${legY}" text-anchor="end" dominant-baseline="central" fill="${GRID}" fill-opacity="${txtOpacity}" font-size="7" font-family="Courier New, Courier, monospace">${freq.toFixed(1)}%</text>`;
    }
  });

  const calmTxt = data.calmFrequency.toFixed(2);
  const note = showCorridor
    ? `Corridor width scales with L/V @ ref ${refV} kt.`
    : "Add runway heading + crosswind limit to show corridor";

  const extraH = compact ? 18 : 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + extraH}" width="${size}" height="${size + extraH}" style="background:${PAPER};border-radius:4px;border:1px solid ${GRID_FAINT}">
    ${defs}
    ${degTicks}
    ${rings}
    ${radials}
    ${cells}
    ${corridor}
    <circle cx="${cx}" cy="${cy}" r="${calmR}" fill="${PAPER}" stroke="${GRID}" stroke-width="1.2"/>
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" dominant-baseline="central" fill="${FREQ}" font-size="9" font-family="Courier New, Courier, monospace" font-weight="600">${calmTxt}%</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="${GRID}" font-size="6" font-family="Courier New, Courier, monospace">CALM</text>
    ${cardinals}
    ${opts.title ? `<text x="${cx}" y="20" text-anchor="middle" fill="${TEXT}" font-size="${compact ? 13 : 15}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${opts.title}</text>` : ""}
    ${opts.subtitle ? `<text x="${cx}" y="${compact ? 34 : 36}" text-anchor="middle" fill="${GRID}" font-size="${compact ? 8 : 9}" font-family="Courier New, Courier, monospace">${opts.subtitle}</text>` : ""}
    ${legend}
    ${compact ? "" : `<text x="${cx}" y="${size + 22}" text-anchor="middle" fill="${GRID}" font-size="7" font-family="Courier New, Courier, monospace">${data.totalObservations.toLocaleString()} obs · ${numSectors} sectors · % per cell (all wind)</text>`}
    <text x="${cx}" y="${size + (compact ? 14 : 32)}" text-anchor="middle" fill="${GRID}" font-size="${compact ? 6 : 7}" font-family="Courier New, Courier, monospace">${note}</text>
  </svg>`;
}

// ── Style 4: Comparison ────────────────────────────────

export function renderComparisonWindRose(
  data: WindRoseResult,
  heading1: number,
  heading2: number,
  result1: RunwayUsabilityResult,
  result2: RunwayUsabilityResult,
  crosswindLimit: number,
  opts: RenderOptions = {}
): string {
  const size = opts.size || 580;
  const margin = 80;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const maxR = size / 2 - margin;

  const recip1 = (heading1 + 180) % 360;
  const recip2 = (heading2 + 180) % 360;

  const p1a = polarToXY(cx, cy, maxR + 30, heading1);
  const p1b = polarToXY(cx, cy, maxR + 30, recip1);
  const p2a = polarToXY(cx, cy, maxR + 30, heading2);
  const p2b = polarToXY(cx, cy, maxR + 30, recip2);

  const better = result1.usabilityPercent >= result2.usabilityPercent ? 1 : 2;

  // Heading labels with boxed backgrounds
  let headingLabels = "";
  [[p1a, heading1, CYAN], [p1b, recip1, CYAN], [p2a, heading2, "#a78bfa"], [p2b, recip2, "#a78bfa"]].forEach(([p, h, c]: any) => {
    const lp = polarToXY(cx, cy, maxR + 40, h as number);
    headingLabels += `<rect x="${lp.x - 18}" y="${lp.y - 9}" width="36" height="18" rx="2" fill="${BG}" stroke="${c}" stroke-width="1"/>`;
    headingLabels += `<text x="${lp.x}" y="${lp.y + 4}" text-anchor="middle" fill="${c}" font-size="10" font-family="'IBM Plex Mono', monospace" font-weight="600">${String(h).padStart(3, "0")}°</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 20}" width="${size}" height="${size + 20}" style="background:${BG};border-radius:4px">
    ${buildGrid(cx, cy, maxR, data.maxFrequency)}
    ${buildPetals(data, cx, cy, maxR)}
    <line x1="${p1a.x}" y1="${p1a.y}" x2="${p1b.x}" y2="${p1b.y}" stroke="${CYAN}" stroke-width="4" stroke-opacity="0.3"/>
    <line x1="${p1a.x}" y1="${p1a.y}" x2="${p1b.x}" y2="${p1b.y}" stroke="${CYAN}" stroke-width="2"/>
    <line x1="${p2a.x}" y1="${p2a.y}" x2="${p2b.x}" y2="${p2b.y}" stroke="#a78bfa" stroke-width="4" stroke-opacity="0.3"/>
    <line x1="${p2a.x}" y1="${p2a.y}" x2="${p2b.x}" y2="${p2b.y}" stroke="#a78bfa" stroke-width="2"/>
    ${headingLabels}
    <circle cx="${cx}" cy="${cy}" r="16" fill="${BG}" stroke="${CYAN}" stroke-width="2"/>

    <rect x="8" y="${size - 70}" width="${size - 16}" height="62" rx="3" fill="${BG}" fill-opacity="0.9" stroke="${GRID}" stroke-width="1"/>
    <text x="20" y="${size - 48}" fill="${CYAN}" font-size="11" font-family="'IBM Plex Mono', monospace" font-weight="600">RWY ${String(heading1).padStart(3, "0")}/${String(recip1).padStart(3, "0")}: ${result1.usabilityPercent.toFixed(2)}% ${result1.meets95 ? "✓" : "✗"} ${better === 1 ? " ◄ BETTER" : ""}</text>
    <text x="20" y="${size - 30}" fill="#a78bfa" font-size="11" font-family="'IBM Plex Mono', monospace" font-weight="600">RWY ${String(heading2).padStart(3, "0")}/${String(recip2).padStart(3, "0")}: ${result2.usabilityPercent.toFixed(2)}% ${result2.meets95 ? "✓" : "✗"} ${better === 2 ? " ◄ BETTER" : ""}</text>
    <text x="20" y="${size - 14}" fill="${TEXT_DIM}" font-size="8" font-family="'IBM Plex Mono', monospace">Crosswind limit: ${crosswindLimit} kt  |  Δ = ${Math.abs(result1.usabilityPercent - result2.usabilityPercent).toFixed(2)}%  |  ICAO-Based</text>
    ${opts.title ? `<text x="${cx}" y="22" text-anchor="middle" fill="${TEXT_BRIGHT}" font-size="15" font-family="'IBM Plex Sans', sans-serif" font-weight="700">${opts.title}</text>` : ""}
  </svg>`;
}
