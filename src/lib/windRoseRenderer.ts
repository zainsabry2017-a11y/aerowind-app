import type { WindRoseResult } from "./windRoseCalculator";
import type { RunwayUsabilityResult } from "./windComponents";

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
