import type { AirportReportData, HeliportReportData, WaterReportData } from "@/contexts/AnalysisContext";
import { renderExecutiveWindRose } from "@/lib/windRoseRenderer";

type ReportType = "combined" | "airport" | "heliport" | "water";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const v = (val: unknown, suffix = ""): string => {
  if (val === null || val === undefined || val === "" || Number.isNaN(val as number)) return "—";
  return `${val}${suffix}`;
};

const svgToDataUri = (svg: string) => {
  try {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  } catch {
    return "";
  }
};

const speedDistSvgFromWindRose = (windRose: any) => {
  const speedRows =
    windRose?.speedBinRanges?.map((range: any, i: number) => {
      let count = 0;
      let freq = 0;
      windRose?.bins?.forEach((bin: any) => {
        if (bin.speedBins?.[i]) {
          count += bin.speedBins[i].count;
          freq += bin.speedBins[i].frequency;
        }
      });
      return { label: range.label, count, freq };
    }) ?? [];

  const maxSpeedFreq = Math.max(...speedRows.map((r: any) => r.freq), 0.01);
  const bW = 420;
  const bH = 16;
  const bPad = 8;
  const bLeft = 90;
  const totalH = speedRows.length * (bH + bPad) + 42;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${totalH}" viewBox="0 0 720 ${totalH}">
    <rect x="0" y="0" width="720" height="${totalH}" fill="#ffffff"/>
    <text x="16" y="20" font-size="14" font-weight="700" fill="#0f172a" font-family="Arial">Speed Distribution</text>
    ${speedRows
      .map((r: any, i: number) => {
        const barW = Math.max(3, (r.freq / maxSpeedFreq) * bW);
        const y = 32 + i * (bH + bPad);
        return `
          <text x="${bLeft - 10}" y="${y + 12}" font-size="11" fill="#334155" text-anchor="end" font-family="Arial">${esc(r.label)}</text>
          <rect x="${bLeft}" y="${y}" width="${bW}" height="${bH}" fill="#f1f5f9" stroke="#cbd5e1" />
          <rect x="${bLeft}" y="${y}" width="${barW}" height="${bH}" fill="#0891b2" />
          <text x="${bLeft + bW + 12}" y="${y + 12}" font-size="11" fill="#0f172a" font-family="Arial">${r.freq.toFixed(1)}%</text>
        `;
      })
      .join("")}
  </svg>`;
};

const sourceTypeLabel = (sourceType?: string | null) => {
  if (!sourceType || sourceType === "official") return "Official Meteorological Data";
  if (sourceType === "ogimet") return "Aviation METAR Data (Ogimet)";
  if (sourceType === "meteostat") return "Public Weather Data (Meteostat)";
  return "User Dataset";
};

const kvTable = (rows: Array<[string, string]>) => {
  return `
    <table class="kv">
      <tbody>
        ${rows
          .map(
            ([k, val]) => `
              <tr>
                <td class="k">${esc(k)}</td>
                <td class="v">${esc(val)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
};

const simpleTable = (headers: string[], rows: string[][]) => {
  return `
    <table class="grid">
      <thead>
        <tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
};

function windFiguresHTML(label: string, windRose: any) {
  if (!windRose) return `<p class="muted">No wind data available for ${esc(label)}.</p>`;
  const windRoseSvg = renderExecutiveWindRose(windRose, { size: 520 });
  const windRoseUri = svgToDataUri(windRoseSvg);
  const speedSvg = speedDistSvgFromWindRose(windRose);
  const speedUri = svgToDataUri(speedSvg);

  return `
    <h3>Wind Analysis — ${esc(label)}</h3>
    <div class="figure-row">
      <div class="figure">
        <div class="cap">Wind Rose</div>
        ${windRoseUri ? `<img class="img" src="${windRoseUri}" alt="Wind Rose"/>` : ""}
      </div>
      <div class="figure">
        <div class="cap">Speed Distribution</div>
        ${speedUri ? `<img class="img" src="${speedUri}" alt="Speed Distribution"/>` : ""}
      </div>
    </div>
  `;
}

export function buildProfessionalReportHTML(args: {
  reportType: ReportType;
  todayLabel: string;
  activeTitle: string;
  primaryProjName: string;
  primaryLoc: string;
  opts: { includeAssumptions: boolean; includeWarnings: boolean; includeRegulatory: boolean; includeFigures: boolean };
  airportReportData: AirportReportData | null;
  heliportReportData: HeliportReportData | null;
  waterReportData: WaterReportData | null;
}) {
  const { reportType, todayLabel, activeTitle, primaryProjName, primaryLoc, opts, airportReportData, heliportReportData, waterReportData } = args;

  const includeAirport = (reportType === "combined" || reportType === "airport") && !!airportReportData;
  const includeHeliport = (reportType === "combined" || reportType === "heliport") && !!heliportReportData;
  const includeWater = (reportType === "combined" || reportType === "water") && !!waterReportData;

  let body = "";

  body += `
    <div class="page cover">
      <div class="cover-box">
        <div class="eyebrow">TECHNICAL ENGINEERING REPORT</div>
        <div class="title">${esc(primaryProjName)}</div>
        <div class="subtitle">${esc(primaryLoc)}</div>
        <div class="meta">
          <div><div class="meta-k">Date Generated</div><div class="meta-v">${esc(todayLabel)}</div></div>
          <div><div class="meta-k">Report Profile</div><div class="meta-v">${esc(activeTitle)}</div></div>
        </div>
      </div>
    </div>
  `;

  if (includeAirport && airportReportData) {
    const d: any = airportReportData;
    const prevailingBin = d.windRose?.bins?.reduce((a: any, b: any) => (a.totalFrequency > b.totalFrequency ? a : b), d.windRose?.bins?.[0]);
    body += `<div class="page"><h1>Airport Facility Assessment</h1>`;
    body += `<h2>Meteorological Data Source</h2>`;
    body += kvTable([
      ["Active Source Type", sourceTypeLabel(d.windData?.sourceType)],
      ["Dataset Name", d.windData?.sourceName || "—"],
      ["Recording Station", d.windData?.stationName || "—"],
      ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
      ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ["Parsed Valid Rows", v(d.windData?.validRows?.toLocaleString())],
      ["Rejected Rows", v(d.windData?.invalidRows?.toLocaleString())],
    ]);
    body += `<h2>Project Info & Data Quality</h2>`;
    body += kvTable([
      ["Project", d.projName || "—"],
      ["Location", d.projLoc || "—"],
      ["Elevation", v(d.elevation, " m AMSL")],
      ["Reference Temperature", v(d.refTemp, " °C")],
      ["Effective Gradient", v(d.gradient, "%")],
      ["Aerodrome Code", v(d.aeroCode)],
    ]);
    body += `<h2>Wind Coverage & Runway Orientation</h2>`;
    body += kvTable([
      ["Prevailing Wind", prevailingBin ? `${prevailingBin.label} (${prevailingBin.directionCenter}°)` : "—"],
      ["Calm Frequency", d.windRose ? `${d.windRose.calmFrequency.toFixed(2)}%` : "—"],
      ["Crosswind Limit", v(d.xwLimit, " kt")],
      ["Optimal Orientation", d.optimization ? `${String(d.optimization.bestHeading).padStart(3, "0")}° / ${String((d.optimization.bestHeading + 180) % 360 || 360).padStart(3, "0")}°` : "—"],
      ["Max Usability Achieved", d.optimization ? `${d.optimization.bestUsability.toFixed(2)}%` : "—"],
    ]);
    if (d.candidates?.length) {
      body += `<h3>Runway Candidates</h3>`;
      body += simpleTable(
        ["Heading", "Reciprocal", "Usability", "Meets 95%"],
        d.candidates.map((c: any) => [
          `${String(c.runwayHeading).padStart(3, "0")}°`,
          `${String((c.reciprocal ?? ((c.runwayHeading + 180) % 360)) || 360).padStart(3, "0")}°`,
          `${c.usabilityPercent.toFixed(2)}%`,
          c.meets95 ? "PASS" : "FAIL",
        ])
      );
    }
    body += `<h2>Runway Length Correction</h2>`;
    if (d.rlResult) {
      body += kvTable([
        ["Base Length", v(d.rlResult.baseLength?.toLocaleString(), " m")],
        ["Combined Multiplier", v(d.rlResult.totalMultiplier?.toFixed(3), "×")],
        ["Corrected Length", v(d.rlResult.correctedLength?.toLocaleString(), " m")],
        ["Surface", d.rlInputs?.surface || d.surface || "—"],
        ["Design Aircraft", d.selectedAc ? `${d.selectedAc.manufacturer} ${d.selectedAc.model}` : "—"],
      ]);
    } else {
      body += `<p class="muted">No runway length analysis performed.</p>`;
    }
    if (opts.includeFigures) body += windFiguresHTML("Airport", d.windRose);
    if (d.notes) body += `<h2>Notes</h2><p>${esc(d.notes)}</p>`;
    body += `</div>`;
  }

  if (includeHeliport && heliportReportData) {
    const d: any = heliportReportData;
    body += `<div class="page"><h1>Heliport Facility Assessment</h1>`;
    body += `<h2>Meteorological Data Source</h2>`;
    body += kvTable([
      ["Active Source Type", sourceTypeLabel(d.windData?.sourceType)],
      ["Dataset Name", d.windData?.sourceName || "—"],
      ["Recording Station", d.windData?.stationName || "—"],
      ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
      ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ["Parsed Valid Rows", v(d.windData?.validRows?.toLocaleString())],
    ]);
    body += `<h2>FATO & Approach Orientation</h2>`;
    body += kvTable([
      ["FATO Optimal Heading", d.fatoResult?.optimalHeading != null ? `${String(Math.round(d.fatoResult.optimalHeading)).padStart(3, "0")}° / ${String(Math.round((d.fatoResult.optimalHeading + 180) % 360 || 360)).padStart(3, "0")}°` : "—"],
      ["Usability Achieved", d.fatoResult?.usabilityPercent != null ? `${Number(d.fatoResult.usabilityPercent).toFixed(1)}%` : "—"],
      ["Preferred Approach Direction", d.approachResult?.approachDir != null ? `${String(Math.round(d.approachResult.approachDir)).padStart(3, "0")}°` : "—"],
      ["Prevailing Wind Direction", d.approachResult?.prevailingDir != null ? `${String(Math.round(d.approachResult.prevailingDir)).padStart(3, "0")}°` : "—"],
    ]);
    if (opts.includeFigures) body += windFiguresHTML("Heliport", d.windRose);
    body += `</div>`;
  }

  if (includeWater && waterReportData) {
    const d: any = waterReportData;
    body += `<div class="page"><h1>Water Aerodrome Assessment</h1>`;
    body += `<h2>Meteorological Data Source</h2>`;
    body += kvTable([
      ["Active Source Type", sourceTypeLabel(d.windData?.sourceType)],
      ["Dataset Name", d.windData?.sourceName || "—"],
      ["Recording Station", d.windData?.stationName || "—"],
      ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
      ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ["Parsed Valid Rows", v(d.windData?.validRows?.toLocaleString())],
    ]);
    body += `<h2>Site & Marine Conditions</h2>`;
    body += kvTable([
      ["Water Body Type", v(d.waterType)],
      ["Wave State", d.waveState ? d.waveState.toUpperCase() : "—"],
      ["Water Temperature", v(d.waterTemp, " °C")],
      ["Channel Type", v(d.channelType)],
      ["Available Depth", v(d.availDepth, " m")],
      ["Current Speed", v(d.currentSpeed, " kt")],
    ]);
    if (opts.includeFigures) body += windFiguresHTML("Water Aerodrome", d.windRose);
    body += `</div>`;
  }

  if (opts.includeAssumptions) {
    body += `<div class="page"><h1>Appendix A — Assumptions & Limitations</h1>
      <ul>
        <li>Planning and preliminary engineering assessment only.</li>
        <li>Public/archive meteorological data does not replace official sources.</li>
        <li>Not an operational or regulatory approval document.</li>
      </ul>
    </div>`;
  }

  if (opts.includeRegulatory) {
    body += `<div class="page"><h1>Appendix B — Regulatory Framework</h1>
      <ul>
        <li>ICAO Annex 14 Volume I — Aerodromes</li>
        <li>ICAO Annex 14 Volume II — Heliports</li>
        <li>ICAO Doc 9157 & 9261 — Manuals</li>
      </ul>
    </div>`;
  }

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #0f172a; background: #ffffff; }
        .page { width: 210mm; min-height: 297mm; padding: 12mm; box-sizing: border-box; page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        h1 { font-size: 18pt; margin: 0 0 10pt; }
        h2 { font-size: 12.5pt; margin: 14pt 0 6pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; }
        h3 { font-size: 11pt; margin: 10pt 0 6pt; }
        .muted { color: #475569; font-size: 10.5pt; }
        .kv { width: 100%; border-collapse: collapse; margin: 8pt 0 10pt; }
        .kv td { border: 1px solid #e2e8f0; padding: 6pt 8pt; font-size: 10.5pt; vertical-align: top; }
        .kv td.k { width: 38%; background: #f8fafc; font-weight: 700; }
        .grid { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; }
        .grid th, .grid td { border: 1px solid #e2e8f0; padding: 6pt 8pt; font-size: 10.5pt; }
        .grid th { background: #f8fafc; font-weight: 700; }
        .figure-row { display: grid; grid-template-columns: 1fr; gap: 10pt; }
        .figure { border: 1px solid #e2e8f0; padding: 8pt; }
        .cap { font-size: 10pt; font-weight: 700; margin-bottom: 6pt; color: #0f172a; }
        .img { width: 100%; height: auto; display: block; }
        .cover { display: flex; align-items: center; justify-content: center; }
        .cover-box { width: 100%; border: 1px solid #e2e8f0; padding: 22mm 16mm; }
        .eyebrow { letter-spacing: .18em; font-size: 9pt; color: #0891b2; font-weight: 700; margin-bottom: 10pt; }
        .title { font-size: 28pt; font-weight: 800; margin-bottom: 6pt; }
        .subtitle { font-size: 14pt; color: #475569; margin-bottom: 18pt; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-top: 10pt; border-top: 1px solid #e2e8f0; padding-top: 10pt; }
        .meta-k { font-size: 9pt; color: #64748b; font-weight: 700; text-transform: uppercase; }
        .meta-v { font-size: 11pt; }
      </style>
    </head>
    <body>${body}</body>
  </html>`;

  return html;
}

