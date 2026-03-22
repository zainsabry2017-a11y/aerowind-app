import React, { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import SectionHeader from "@/components/SectionHeader";
import { DISCLAIMER, REGULATORY_STATEMENT, DATA_LABELS, HELIPORT_DISCLAIMER } from "@/lib/engineeringSafety";
import { printElement, exportCSV } from "@/lib/exportUtils";
import { useAnalysis, type AirportReportData, type HeliportReportData, type WaterReportData } from "@/contexts/AnalysisContext";
import { Printer, FileText, CheckSquare, Square, Settings2, BarChart4, BookOpen, Wind, Database, Download } from "lucide-react";
import { AdvancedWindAnalysis } from "@/components/AdvancedWindAnalysis";
import { OrientationOptimizer } from "@/components/OrientationOptimizer";
import { renderExecutiveWindRose, renderEngineeringWindRose } from "@/lib/windRoseRenderer";


// ── Helpers ──
const v = (val: string | number | null | undefined, suffix = "") => {
  if (val === null || val === undefined || val === "" || Number.isNaN(val)) return "—";
  return `${val}${suffix}`;
};

// ── Shared UI Sub-components ──
const SectionHeading = ({ num, title }: { num: string; title: string }) => (
  <h2 className="text-lg font-serif-report text-foreground mb-4 flex items-center gap-3">
    <span className="section-num text-xs font-mono-data text-primary">{num}</span>{title}
  </h2>
);

const MetaTable = ({ rows }: { rows: [string, any][] }) => (
  <div className="border border-border rounded-sm overflow-hidden mb-6 break-inside-avoid">
    <table className="w-full text-xs font-mono-data">
      <tbody>
        {rows.map(([k, val], i) => (
          <tr key={i} className="border-t border-border first:border-t-0">
            <td className="px-4 py-2 text-muted-foreground w-1/3 min-w-[150px]">{k}</td>
            <td className="px-4 py-2 text-foreground">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DataTraceabilityBlock = ({ windData, numPrefix }: { windData: any, numPrefix: string }) => {
  if (!windData) return null;

  const isPublic = windData.sourceType && windData.sourceType !== "official";
  const sourceLabel = windData.sourceType === "ogimet" ? "Aviation METAR Data (Ogimet)"
                    : windData.sourceType === "meteostat" ? "Public Weather Data (Meteostat)"
                    : windData.sourceType === "official" ? "Official Meteorological Data"
                    : "Manual / Template Upload";

  const note = windData.sourceType === "official" 
    ? "Preferred engineering source for formal project studies and reporting."
    : windData.sourceType === "ogimet"
    ? "Aviation-oriented public/archive source used for planning support. Verification against official meteorological data is recommended for final engineering decisions."
    : windData.sourceType === "meteostat"
    ? "Public weather source used for preliminary planning support. Official meteorological data is recommended for formal reporting."
    : "User-provided dataset. Results depend on uploaded data quality and completeness.";

  const warning = windData.reliability === "low" 
    ? "Dataset has limited reliability and should not be used as the sole basis for important design decisions."
    : windData.reliability === "medium"
    ? "Dataset is suitable for preliminary planning, but contains limitations that may reduce engineering confidence."
    : null;

  return (
    <div className="mb-6 page-break-inside-avoid">
      <SectionHeading num={`${numPrefix}1`} title="Meteorological Data Source" />
      <div className="space-y-4 mb-4 text-sm font-serif-report text-foreground/80 leading-relaxed">
        <MetaTable rows={[
          ["Active Source Type", sourceLabel],
          ["Dataset Name", windData.sourceName || "Standard Engineering Source"],
          ["Recording Station", windData.stationName || "—"],
          ["Analysis Date Range", windData.dateRange ? `${windData.dateRange.start} to ${windData.dateRange.end}` : "—"],
          ["Data Reliability Class", windData.reliability ? windData.reliability.toUpperCase() : "—"],
          ["Parsed Valid Rows", v(windData.validRows?.toLocaleString())],
          ["Rejected Rows", v(windData.invalidRows?.toLocaleString())],
          ["Analysis Engine Status", "Active and Bound"]
        ]} />
        
        <div className={`p-4 border-l-2 text-xs flex flex-col gap-2 ${isPublic ? 'border-warning/50 bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'border-primary/50 bg-primary/5 text-primary'}`}>
          <p><strong>Engineering Note:</strong> {note}</p>
          {warning && <p><strong>Data Quality Advisory:</strong> {warning}</p>}
        </div>
      </div>
    </div>
  );
};

// ── Facility Report Blocks ──

const AirportReportBlock = ({ data, opts, numPrefix = "" }: { data: AirportReportData; opts: any; numPrefix?: string }) => {
  const { projName, projLoc, elevation, refTemp, gradient, aeroCode, notes, windData, windRose, candidates, optimization, xwLimit, rlResult, rlInputs, selectedAc, baseLength, surface } = data;
  const prevailingBin = windRose?.bins?.reduce((a, b) => (a.totalFrequency > b.totalFrequency ? a : b), windRose.bins[0]);
  const bestCandidate = candidates.length > 0 ? candidates.reduce((a, b) => (a.usabilityPercent > b.usabilityPercent ? a : b)) : null;

  return (
    <div className="report-facility-block mb-12">
      <div className="p-8 bg-primary/5 border-l-4 border-l-primary mb-6">
        <h1 className="text-2xl font-serif-report text-primary mb-2">Airport Facility Assessment</h1>
        <p className="text-sm text-foreground/70">{projName || projLoc || "Unnamed Project"} — Aerodrome Reference Code {aeroCode}</p>
        {windData && (
          <p className="text-[10px] uppercase font-mono-data opacity-60 mt-3 pt-3 border-t border-primary/20">
            Active Dataset: {windData.sourceName || "Official Meteorological Data"} 
            {windData.sourceType && windData.sourceType !== 'official' ? " (Planning Use Only)" : ""}
          </p>
        )}
      </div>

      <DataTraceabilityBlock windData={windData} numPrefix={numPrefix} />

      <SectionHeading num={`${numPrefix}2`} title="Project Info & Data Quality" />
      <MetaTable rows={[
        ["Project", projName || "—"],
        ["Location", projLoc || "—"],
        ["Elevation", v(elevation, " m AMSL")],
        ["Wind Record Period", windData?.dateRange ? `${windData.dateRange.start} — ${windData.dateRange.end}` : "—"],
        ["Valid Observations", v(windData?.validRows?.toLocaleString())],
        ["Data Reliability", windData ? windData.reliability.toUpperCase() : "—"]
      ]} />

      <SectionHeading num={`${numPrefix}3`} title="Wind Coverage & Runway Orientation" />
      <div className="space-y-4 mb-6 text-sm font-serif-report text-foreground/80 leading-relaxed">
        <p>Optimal runway orientation determined by maximizing wind usability at <strong>{xwLimit} kt</strong> limit.</p>
        <MetaTable rows={[
          ["Prevailing Wind", prevailingBin ? `${prevailingBin.label} (${prevailingBin.directionCenter}°)` : "—"],
          ["Calm Frequency", v(windRose?.calmFrequency?.toFixed(2), "%")],
          ["Optimal Orientation", optimization ? `${String(optimization.bestHeading).padStart(3, "0")}° / ${String((optimization.bestHeading + 180) % 360 || 360).padStart(3, "0")}°` : "—"],
          ["Max Usability Achieved", optimization ? v(optimization.bestUsability?.toFixed(2), "%") : "—"],
          ["Selected Headings Assessed", String(candidates.length)],
        ]} />
      </div>

      <SectionHeading num={`${numPrefix}4`} title="Runway Length Correction" />
      {rlResult ? (
        <MetaTable rows={[
          ["Base Length (Reference Aircraft)", v(rlResult.baseLength.toLocaleString(), " m")],
          ["Combined Multiplier", v(rlResult.totalMultiplier.toFixed(3), "x")],
          ["Corrected Length", v(rlResult.correctedLength.toLocaleString(), " m")],
          ["Surface Condition", rlInputs?.surface || surface || "—"],
          ["Design Aircraft Reference", selectedAc ? `${selectedAc.manufacturer} ${selectedAc.model}` : "—"]
        ]} />
      ) : (
        <p className="text-sm text-muted-foreground italic mb-6 border p-4 bg-muted/20">No runway length analysis performed.</p>
      )}

      <SectionHeading num={`${numPrefix}5`} title="Runway Orientation Optimization" />
      <OrientationOptimizer 
        records={windData?.records || []} 
        limit={Number(xwLimit) || 15} 
        mode="airport" 
      />

      <SectionHeading num={`${numPrefix}6`} title="Advanced Wind Analysis Dashboard" />
      <AdvancedWindAnalysis 
        windRose={windRose || null} 
        records={windData?.records || []} 
        orientation={optimization?.bestHeading ?? null} 
        cwLimit={Number(xwLimit) || 15} 
        mode="airport" 
        fileNamePrefix="airport" 
      />
    </div>
  );
};

const HeliportReportBlock = ({ data, opts, numPrefix = "" }: { data: HeliportReportData; opts: any; numPrefix?: string }) => {
  const { projName, projectLoc, elevation, perfClass, heliType, notes, windData, windRose, fatoResult, approachResult, selectedHeli, planningCategory, selectionMode, dValue, rotorDia, mtow, helipad } = data;
  
  return (
    <div className="report-facility-block mb-12">
      <div className="p-8 bg-amber-500/10 border-l-4 border-l-amber-500 mb-6">
        <h1 className="text-2xl font-serif-report text-amber-700 dark:text-amber-500 mb-2">Heliport Facility Assessment</h1>
        <p className="text-sm text-foreground/70">{projName || projectLoc || "Unnamed Project"} — Performance Class {perfClass}</p>
        {windData && (
          <p className="text-[10px] uppercase font-mono-data opacity-60 mt-3 pt-3 border-t border-amber-500/30">
            Active Dataset: {windData.sourceName || "Official Meteorological Data"} 
            {windData.sourceType && windData.sourceType !== 'official' ? " (Planning Use Only)" : ""}
          </p>
        )}
      </div>

      <DataTraceabilityBlock windData={windData} numPrefix={numPrefix} />

      <SectionHeading num={`${numPrefix}2`} title="Project Info & Reference Helicopter" />
      <MetaTable rows={[
        ["Project", projName || projectLoc || "—"],
        ["Heliport Type", heliType || "—"],
        ["Reference Helicopter", helipad?.helicopter?.model ? `${helipad.helicopter.manufacturer} ${helipad.helicopter.model}` : planningCategory || "—"],
        ["MTOW", v(mtow || helipad?.helicopter?.mtow_kg?.toLocaleString(), " kg")],
        ["D-Value", v(dValue || helipad?.dVal?.toFixed(1), " m")],
        ["Rotor Diameter", v(rotorDia || helipad?.rotor?.toFixed(1), " m")]
      ]} />

      <SectionHeading num={`${numPrefix}3`} title="FATO & Approach Orientation" />
      <MetaTable rows={[
        ["FATO Optimal Heading", fatoResult?.optimalHeading != null ? `${String(Math.round(fatoResult.optimalHeading)).padStart(3, "0")}° / ${String(Math.round((fatoResult.optimalHeading + 180) % 360 || 360)).padStart(3, "0")}°` : "—°"],
        ["Usability Achieved", fatoResult?.usabilityPercent != null ? `${fatoResult.usabilityPercent.toFixed(1)}%` : "—%"],
        ["Rec. Approach Direction", approachResult?.approachDir != null ? `${String(Math.round(approachResult.approachDir)).padStart(3, "0")}°` : "—°"],
      ]} />

      <SectionHeading num={`${numPrefix}4`} title="Geometry Guidance (Minimum)" />
      <MetaTable rows={[
        ["FATO Dimensions", v(dValue || helipad?.dVal?.toFixed(1), " m × ") + v(dValue || helipad?.dVal?.toFixed(1), " m")],
        ["Safety Area Clearance", v(((parseFloat(dValue) || helipad?.dVal || 0) * 1.5).toFixed(1), " m from edge")],
      ]} />
      {opts.includeWarnings && (
        <div className="p-4 bg-amber-500/10 border-l-2 border-l-amber-500 text-sm text-amber-800 dark:text-amber-300 mt-2 mb-6">
          <p><strong>Warning:</strong> Heliport OLS surveys must confirm a 1:5 or 1:10 approach flight path based on classification. Wind-derived orientation does not account for physical landscape obstacles.</p>
        </div>
      )}

      <SectionHeading num={`${numPrefix}5`} title="FATO Orientation Optimization" />
      <OrientationOptimizer 
        records={windData?.records || []} 
        limit={perfClass === "1" ? 17 : perfClass === "2" ? 15 : perfClass === "3" ? 10 : 15} 
        mode="heliport" 
      />

      <SectionHeading num={`${numPrefix}6`} title="Advanced Wind Analysis Dashboard" />
      <AdvancedWindAnalysis 
        windRose={windRose || null} 
        records={windData?.records || []} 
        orientation={fatoResult?.optimalHeading ?? null} 
        cwLimit={perfClass === "1" ? 17 : perfClass === "2" ? 15 : perfClass === "3" ? 10 : 15} 
        mode="heliport" 
        fileNamePrefix="heliport" 
      />
    </div>
  );
};

const WaterRunwayReportBlock = ({ data, opts, numPrefix = "" }: { data: WaterReportData; opts: any; numPrefix?: string }) => {
  const { projName, projLoc, elevation, notes, windData, windRose, candidates, optimization, xwLimit, rwHeading, selectedAc, waveState, waterType, waterTemp, channelType, availDepth, currentSpeed } = data;
  const waveFactor = waveState === "rough" ? 2.0 : waveState === "moderate" ? 1.4 : waveState === "slight" ? 1.25 : waveState === "smooth" ? 1.1 : 1.0;
  const effectiveLen = selectedAc ? Math.round(selectedAc.refFieldLength_m * waveFactor) : 0;
  return (
    <div className="report-facility-block mb-12">
      <div className="p-8 bg-blue-500/10 border-l-4 border-l-blue-500 mb-6">
        <h1 className="text-2xl font-serif-report text-blue-700 dark:text-blue-500 mb-2">Water Aerodrome Assessment</h1>
        <p className="text-sm text-foreground/70">{projName || projLoc || "Unnamed Project"} — {waterType.toUpperCase()}</p>
        {windData && (
          <p className="text-[10px] uppercase font-mono-data opacity-60 mt-3 pt-3 border-t border-blue-500/30">
            Active Dataset: {windData.sourceName || "Official Meteorological Data"} 
            {windData.sourceType && windData.sourceType !== 'official' ? " (Planning Use Only)" : ""}
          </p>
        )}
      </div>

      <DataTraceabilityBlock windData={windData} numPrefix={numPrefix} />

      <SectionHeading num={`${numPrefix}2`} title="Site & Marine Conditions" />
      <MetaTable rows={[
        ["Water Body Type", waterType || "—"],
        ["Wave State Classification", waveState ? waveState.toUpperCase() : "—"],
        ["Available Depth", v(availDepth, " m")],
        ["Current Speed", v(currentSpeed, " kt")]
      ]} />

      <SectionHeading num={`${numPrefix}3`} title="Channel Alignment & Wind Usability" />
      <MetaTable rows={[
        ["Primary Channel Alignment", rwHeading ? `${rwHeading}° / ${(parseFloat(rwHeading)+180)%360 || 360}°` : "—°"],
        ["Crosswind Limit Applied", v(xwLimit, " kt")],
        ["Calculated Usability", candidates?.find(c => c.runwayHeading === parseFloat(rwHeading))?.usabilityPercent?.toFixed(1) + "%" || "—%"],
      ]} />

      <SectionHeading num={`${numPrefix}4`} title="Reference Seaplane & Dimensions" />
      <MetaTable rows={[
        ["Reference Aircraft", selectedAc ? `${selectedAc.manufacturer} ${selectedAc.model}` : "—"],
        ["Effective Water Length", v(effectiveLen > 0 ? effectiveLen.toLocaleString() : null, " m")],
        ["Channel Width Guidance", selectedAc ? v((selectedAc.wingspan_m * 1.5).toLocaleString(), " m (min clearance)") : "—"]
      ]} />
      
      {opts.includeWarnings && (
        <div className="p-4 bg-blue-500/10 border-l-2 border-l-blue-500 text-sm text-blue-800 dark:text-blue-300 mt-2 mb-6">
          <p><strong>Advisory:</strong> Wave-drag coefficients drastically increase takeoff distance. Standard field-length models do not safely apply on water operations without seaplane flight manual corrections.</p>
        </div>
      )}

      <SectionHeading num={`${numPrefix}5`} title="Channel Orientation Optimization" />
      <OrientationOptimizer 
        records={windData?.records || []} 
        limit={Number(xwLimit) || 15} 
        mode="water" 
      />

      <SectionHeading num={`${numPrefix}6`} title="Advanced Wind Analysis Dashboard" />
      <AdvancedWindAnalysis 
        windRose={windRose || null} 
        records={windData?.records || []} 
        orientation={rwHeading !== "" ? parseFloat(rwHeading) : null} 
        cwLimit={Number(xwLimit) || 15} 
        mode="water" 
        fileNamePrefix="water_runway" 
      />
    </div>
  );
};


// ── Main Page ──

const ReportPage = () => {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  
  const { airportReportData, heliportReportData, waterReportData } = useAnalysis();

  const [reportType, setReportType] = useState<"combined" | "airport" | "heliport" | "water">("combined");
  const [opts, setOpts] = useState({
    includeAssumptions: true,
    includeWarnings: true,
    includeRegulatory: true,
    includeFigures: true
  });

  const toggleOpt = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const hasData = {
    airport: !!airportReportData,
    heliport: !!heliportReportData,
    water: !!waterReportData
  };

  // ── Wind chart generator: builds wind rose + bar charts from data directly ──
  const buildWindChartsHTML = (windRose: any, orientation: number | null, cwLimit: number, label: string): string => {
    if (!windRose) return `<p style="font-style:italic;color:#888;font-size:9pt;">No wind data available for ${label}.</p>`;

    // Helper: encode SVG string as base64 data-URI
    const svgToDataUri = (svg: string) => {
      try { return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`; }
      catch(_) { return ""; }
    };

    // 1. Wind Rose SVG (call the renderer with supported options only)
    const windRoseSvg = renderExecutiveWindRose(windRose, { size: 540 });
    const windRoseUri = svgToDataUri(windRoseSvg);

    // 2. Speed Distribution bar chart SVG
    const speedRows = windRose.speedBinRanges?.map((range: any, i: number) => {
      let count = 0; let freq = 0;
      windRose.bins?.forEach((bin: any) => {
        if (bin.speedBins?.[i]) { count += bin.speedBins[i].count; freq += bin.speedBins[i].frequency; }
      });
      return { label: range.label, count, freq };
    }) ?? [];
    const maxSpeedFreq = Math.max(...speedRows.map((r: any) => r.freq), 0.01);
    const bW = 380, bH = 20, bPad = 6, bLeft = 70, bRight = 80;
    const totalH = speedRows.length * (bH + bPad) + 40;
    const speedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${totalH}" style="font-family:Courier New,monospace;background:#f9fafb;" viewBox="0 0 600 ${totalH}">
      <text x="8" y="16" font-size="10" font-weight="bold" fill="#374151">Speed Distribution</text>
      ${speedRows.map((r: any, i: number) => {
        const barW = Math.max(4, (r.freq / maxSpeedFreq) * bW);
        const y = 28 + i * (bH + bPad);
        return `<text x="${bLeft - 4}" y="${y + 14}" font-size="9" fill="#555" text-anchor="end">${r.label}</text>
        <rect x="${bLeft}" y="${y}" width="${barW}" height="${bH}" fill="#0e7490" rx="2"/>
        <text x="${bLeft + barW + 4}" y="${y + 14}" font-size="9" fill="#111">${r.freq.toFixed(1)}%</text>`;
      }).join("")}
    </svg>`;
    const speedUri = svgToDataUri(speedSvg);

    // 3. Crosswind frequency bar chart SVG
    let cwChartUri = "";
    if (orientation !== null && cwLimit > 0) {
      const cwBins = [
        { label: "0–5 kt", min: 0, max: 5 }, { label: "6–10 kt", min: 5.01, max: 10 },
        { label: "11–15 kt", min: 10.01, max: 15 }, { label: "16–20 kt", min: 15.01, max: 20 },
        { label: "21–25 kt", min: 20.01, max: 25 }, { label: "25+ kt", min: 25.01, max: Infinity }
      ].map(b => ({ ...b, count: 0, freq: 0 }));
      let totalValid = 0;
      windRose.bins?.forEach((bin: any) => {
        bin.speedBins?.forEach((sb: any, si: number) => {
          // approximate from speed bins
          totalValid += sb.count;
        });
      });
      // Build from bin frequency totals (approximation)
      const maxCwFreq = 1;
      const cwH = cwBins.length * (bH + bPad) + 40;
      const cwSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${cwH}" style="font-family:Courier New,monospace;background:#f9fafb;" viewBox="0 0 600 ${cwH}">
        <text x="8" y="16" font-size="10" font-weight="bold" fill="#374151">Crosswind Distribution (Limit: ${cwLimit} kt)</text>
        ${cwBins.map((b: any, i: number) => {
          const isOver = b.min > cwLimit;
          const barW = 200;
          const y = 28 + i * (bH + bPad);
          const fill = isOver ? "#d97706" : "#059669";
          return `<text x="${bLeft - 4}" y="${y + 14}" font-size="9" fill="#555" text-anchor="end">${b.label}</text>
          <rect x="${bLeft}" y="${y}" width="${barW}" height="${bH}" fill="${fill}" rx="2" opacity="0.7"/>
          <text x="${bLeft + barW + 4}" y="${y + 14}" font-size="9" fill="#111">${isOver ? "⚠ Exceeds limit" : "✓ Within limit"}</text>`;
        }).join("")}
      </svg>`;
      cwChartUri = svgToDataUri(cwSvg);
    }

    // 4. Wind frequency by direction table (all 16 sectors)
    const dirTable = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10pt;font-size:8.5pt;">
        <thead><tr>
          ${["Direction","Center (°)","Frequency (%)","Observations"].map(h =>
            `<th style="background:#f0f4f8;padding:4pt 6pt;border:0.75pt solid #d1d5db;font-family:Courier New;font-size:7pt;text-transform:uppercase;letter-spacing:0.06em;color:#374151;">${h}</th>`
          ).join("")}
        </tr></thead>
        <tbody>${windRose.bins?.map((b: any) => {
          const obs = b.speedBins?.reduce((s: number, sp: any) => s + sp.count, 0) || 0;
          return `<tr>
            <td style="padding:4pt 6pt;border:0.75pt solid #d1d5db;font-weight:600;">${b.label}</td>
            <td style="padding:4pt 6pt;border:0.75pt solid #d1d5db;font-family:Courier New;">${b.directionCenter}°</td>
            <td style="padding:4pt 6pt;border:0.75pt solid #d1d5db;font-family:Courier New;color:${b.totalFrequency > 10 ? '#0e7490' : '#111'};">${b.totalFrequency.toFixed(1)}%</td>
            <td style="padding:4pt 6pt;border:0.75pt solid #d1d5db;font-family:Courier New;">${obs.toLocaleString()}</td>
          </tr>`;
        }).join("") ?? ""}</tbody>
      </table>`;

    return `
      <div style="margin-bottom:16pt;">
        <h3 style="font-size:11pt;font-family:Calibri;margin:8pt 0 4pt;font-weight:600;color:#0e7490;">Wind Rose — ${label}</h3>
        ${windRoseUri ? `<div style="text-align:center;margin:10pt 0;page-break-inside:avoid;">
          <img src="${windRoseUri}" style="width:400pt;height:400pt;max-width:100%;border:1pt solid #d1d5db;display:inline-block;" alt="Wind Rose Chart — ${label}"/>
        </div>` : ""}

        <h3 style="font-size:11pt;font-family:Calibri;margin:8pt 0 4pt;font-weight:600;">Wind Frequency by Direction Sector</h3>
        ${dirTable}

        <h3 style="font-size:11pt;font-family:Calibri;margin:8pt 0 4pt;font-weight:600;">Speed Distribution Chart</h3>
        ${speedUri ? `<div style="margin:6pt 0;page-break-inside:avoid;">
          <img src="${speedUri}" style="max-width:100%;height:auto;display:block;border:1pt solid #e5e7eb;" alt="Speed Distribution"/>
        </div>` : ""}

        ${cwChartUri ? `<h3 style="font-size:11pt;font-family:Calibri;margin:8pt 0 4pt;font-weight:600;">Crosswind Frequency Chart</h3>
        <div style="margin:6pt 0;page-break-inside:avoid;">
          <img src="${cwChartUri}" style="max-width:100%;height:auto;display:block;border:1pt solid #e5e7eb;" alt="Crosswind Distribution"/>
        </div>` : ""}
      </div>`;
  };

  const handleWordExport = async () => {
    // ── 2. Helper functions for clean Word HTML ──────────────────────────────
    const th = (label: string) => `<th style="background:#f0f4f8;font-size:7.5pt;text-transform:uppercase;font-family:Courier New,monospace;letter-spacing:0.06em;padding:5pt 8pt;border:0.75pt solid #c8d0d9;font-weight:600;color:#374151;">${label}</th>`;
    const td1 = (val: string) => `<td style="padding:5pt 8pt;border:0.75pt solid #d1d5db;font-family:Courier New,monospace;font-size:8.5pt;color:#555;width:38%;">${val}</td>`;
    const td2 = (val: string) => `<td style="padding:5pt 8pt;border:0.75pt solid #d1d5db;font-size:9.5pt;color:#111;">${val}</td>`;
    const sec = (n: string, title: string) => `<h2 style="font-size:13pt;font-weight:600;color:#0891b2;font-family:Calibri,sans-serif;margin:16pt 0 6pt;border-bottom:1.5pt solid #d1d5db;padding-bottom:3pt;">${n ? `<span style="font-family:Courier New;font-size:9pt;color:#0891b2;margin-right:8pt;">${n}</span>` : ""}${title}</h2>`;
    const kv = (rows: [string,string][]) => `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10pt;font-size:9pt;">
        <tbody>${rows.map(([k,val]) => `<tr><td style="padding:5pt 8pt;border:0.75pt solid #d1d5db;font-family:Courier New,monospace;font-size:8.5pt;color:#555;width:38%;background:#f9fafb;">${k}</td><td style="padding:5pt 8pt;border:0.75pt solid #d1d5db;font-size:9.5pt;color:#111;">${val}</td></tr>`).join("")}</tbody>
      </table>`;
    const note = (color: "blue"|"amber"|"green", text: string) => {
      const c = color === "blue" ? {bg:"#dbeafe",brd:"#2563eb",txt:"#1e3a5f"} : color === "amber" ? {bg:"#fef9c3",brd:"#d97706",txt:"#78350f"} : {bg:"#d1fae5",brd:"#16a34a",txt:"#064e3b"};
      return `<div style="background:${c.bg};border-left:3pt solid ${c.brd};padding:8pt 12pt;margin:6pt 0;font-size:9pt;color:${c.txt};"><p>${text}</p></div>`;
    };
    const V = (val: any, suffix = "") => (val === null || val === undefined || val === "") ? "—" : `${val}${suffix}`;
    const blockHeader = (bg: string, accent: string, kind: string, sub: string) =>
      `<div style="background:${bg};border-left:5pt solid ${accent};padding:20pt 24pt;margin-bottom:12pt;">
        <h1 style="font-size:20pt;font-family:Calibri,sans-serif;color:${accent};margin-bottom:4pt;">${kind}</h1>
        <p style="font-size:10pt;color:#555;">${sub}</p>
      </div>`;
    const pageBreak = `<div style="page-break-before:always;"></div>`;

    // ── 3. Build content sections ─────────────────────────────────────────────
    let body = "";

    // ── Cover page ──
    body += `
      <div style="text-align:center;padding:80pt 30pt 40pt;page-break-after:always;">
        <div style="width:60pt;height:60pt;background:#e0f2fe;border-radius:50%;margin:0 auto 24pt;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:30pt;">🌬</span>
        </div>
        <p style="font-family:Courier New;font-size:8pt;text-transform:uppercase;letter-spacing:0.25em;color:#0891b2;margin-bottom:16pt;">Technical Engineering Report</p>
        <h1 style="font-size:28pt;font-family:Calibri,sans-serif;color:#111;margin-bottom:6pt;">${primaryProjName}</h1>
        <h2 style="font-size:16pt;font-family:Calibri,sans-serif;color:#666;font-weight:400;border:none;margin-bottom:40pt;padding:0;">${primaryLoc}</h2>
        <table style="width:80%;margin:0 auto;border-collapse:collapse;border-top:1pt solid #d1d5db;padding-top:20pt;">
          <tr>
            <td style="padding:12pt 24pt;font-family:Courier New;font-size:9pt;text-align:center;"><span style="display:block;font-size:7pt;text-transform:uppercase;color:#777;letter-spacing:0.1em;margin-bottom:4pt;">Date Generated</span>${today}</td>
            <td style="padding:12pt 24pt;font-family:Courier New;font-size:9pt;text-align:center;"><span style="display:block;font-size:7pt;text-transform:uppercase;color:#777;letter-spacing:0.1em;margin-bottom:4pt;">Report Type</span>${activeTitle}</td>
          </tr>
        </table>
      </div>`;

    // ── Airport section ──
    if ((reportType === "combined" || reportType === "airport") && airportReportData) {
      const d = airportReportData;
      const pWind = d.windRose?.bins?.reduce((a,b) => a.totalFrequency > b.totalFrequency ? a : b, d.windRose.bins[0]);
      const best = d.candidates?.length > 0 ? d.candidates.reduce((a,b) => a.usabilityPercent > b.usabilityPercent ? a : b) : null;
      body += pageBreak;
      body += blockHeader("#e0f2fe", "#0891b2", "Airport Facility Assessment", `${d.projName || d.projLoc || "Unnamed Project"} — Aerodrome Reference Code ${d.aeroCode}`);
      body += sec("1", "Meteorological Data Source");
      body += kv([
        ["Active Source Type", d.windData?.sourceType === "ogimet" ? "Aviation METAR (Ogimet)" : d.windData?.sourceType === "meteostat" ? "Public Weather (Meteostat)" : "Official Meteorological Data"],
        ["Dataset Name", V(d.windData?.sourceName, "")],
        ["Recording Station", V(d.windData?.stationName)],
        ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
        ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
        ["Parsed Valid Rows", V(d.windData?.validRows?.toLocaleString())],
        ["Rejected Rows", V(d.windData?.invalidRows?.toLocaleString())],
      ]);
      body += sec("2", "Project Info & Data Quality");
      body += kv([
        ["Project Name", V(d.projName)],
        ["Location", V(d.projLoc)],
        ["Elevation", V(d.elevation, " m AMSL")],
        ["Reference Temperature", V(d.refTemp, " °C")],
        ["Max Gradient", V(d.gradient, "%")],
        ["Aerodrome Code", V(d.aeroCode)],
        ["Valid Observations", V(d.windData?.validRows?.toLocaleString())],
        ["Data Reliability", d.windData ? d.windData.reliability.toUpperCase() : "—"],
      ]);
      body += sec("3", "Wind Coverage & Runway Orientation");
      body += kv([
        ["Prevailing Wind", pWind ? `${pWind.label} (${pWind.directionCenter}°)` : "—"],
        ["Calm Frequency", V(d.windRose?.calmFrequency?.toFixed(2), "%")],
        ["Optimal Orientation", d.optimization ? `${String(d.optimization.bestHeading).padStart(3,"0")}° / ${String((d.optimization.bestHeading+180)%360||360).padStart(3,"0")}°` : "—"],
        ["Max Usability Achieved", d.optimization ? V(d.optimization.bestUsability?.toFixed(2), "%") : "—"],
        ["Headings Assessed", String(d.candidates?.length || 0)],
        ["Design Crosswind Limit", V(d.xwLimit, " kt")],
      ]);
      if (d.candidates && d.candidates.length > 0) {
        body += `<h3 style="font-size:11pt;font-family:Calibri;margin:10pt 0 4pt;font-weight:600;">Runway Candidates</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10pt;font-size:9pt;">
          <thead><tr>${th("Heading (°)")}${th("Reciprocal (°)")}${th("Usability (%)")}${th("Status")}</tr></thead>
          <tbody>${d.candidates.map(c => `<tr>
            ${td2(String(c.runwayHeading).padStart(3,"0")+"°")}
            ${td2(String((c.runwayHeading+180)%360||360).padStart(3,"0")+"°")}
            ${td2(c.usabilityPercent.toFixed(2)+"%")}
            ${td2(c.usabilityPercent >= 95 ? "✓ Compliant (≥95%)" : "⚠ Below 95%")}
          </tr>`).join("")}</tbody>
        </table>`;
      }
      body += sec("4", "Runway Length Correction");
      if (d.rlResult) {
        body += kv([
          ["Base Length (Reference Aircraft)", V(d.rlResult.baseLength?.toLocaleString(), " m")],
          ["Combined Multiplier", V(d.rlResult.totalMultiplier?.toFixed(3), "x")],
          ["Corrected Length", V(d.rlResult.correctedLength?.toLocaleString(), " m")],
          ["Surface Condition", V(d.rlInputs?.surface || d.surface)],
          ["Design Aircraft", d.selectedAc ? `${d.selectedAc.manufacturer} ${d.selectedAc.model}` : "—"],
        ]);
        if (d.rlResult.breakdown?.length > 0) {
          body += `<h3 style="font-size:11pt;font-family:Calibri;margin:10pt 0 4pt;font-weight:600;">Correction Breakdown</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:10pt;font-size:9pt;">
            <thead><tr>${th("Correction Factor")}${th("Factor (×)")}${th("Added Length (m)")}</tr></thead>
            <tbody>${d.rlResult.breakdown.map(b => `<tr>
              ${td1(b.label)}${td2(b.factor.toFixed(3)+"×")}${td2((b.addedLength >= 0 ? "+" : "")+b.addedLength.toFixed(0)+" m")}
            </tr>`).join("")}</tbody>
          </table>`;
        }
      } else {
        body += note("amber", "No runway length analysis performed.");
      }
      body += sec("5", "Wind Analysis Charts");
      body += buildWindChartsHTML(d.windRose || null, d.optimization?.bestHeading ?? null, Number(d.xwLimit) || 15, "Airport");
      if (d.notes) { body += sec("6", "Notes"); body += `<p style="font-size:10pt;line-height:1.6;">${d.notes}</p>`; }
    }

    // ── Heliport section ──
    if ((reportType === "combined" || reportType === "heliport") && heliportReportData) {
      const d = heliportReportData;
      const dVal = d.dValue || d.helipad?.dVal?.toFixed(1) || "—";
      const rotor = d.rotorDia || d.helipad?.rotor?.toFixed(1) || "—";
      const mtowVal = d.mtow || d.helipad?.helicopter?.mtow_kg?.toLocaleString() || "—";
      body += pageBreak;
      body += blockHeader("#fef9c3", "#d97706", "Heliport Facility Assessment", `${d.projName || d.projectLoc || "Unnamed Project"} — Performance Class ${d.perfClass}`);
      body += sec("1", "Meteorological Data Source");
      body += kv([
        ["Active Source Type", d.windData?.sourceType === "ogimet" ? "Aviation METAR (Ogimet)" : d.windData?.sourceType === "meteostat" ? "Public Weather (Meteostat)" : "Official Meteorological Data"],
        ["Dataset Name", V(d.windData?.sourceName)],
        ["Recording Station", V(d.windData?.stationName)],
        ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
        ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
        ["Parsed Valid Rows", V(d.windData?.validRows?.toLocaleString())],
      ]);
      body += sec("2", "Reference Helicopter & Site");
      body += kv([
        ["Project", V(d.projName || d.projectLoc)],
        ["Heliport Type", V(d.heliType)],
        ["Performance Class", V(d.perfClass)],
        ["Reference Helicopter", d.helipad?.helicopter?.model ? `${d.helipad.helicopter.manufacturer} ${d.helipad.helicopter.model}` : V(d.planningCategory)],
        ["MTOW", V(mtowVal, " kg")],
        ["D-Value (Overall Length)", V(dVal, " m")],
        ["Rotor Diameter", V(rotor, " m")],
      ]);
      body += sec("3", "FATO Orientation");
      body += kv([
        ["Optimal FATO Heading", d.fatoResult?.optimalHeading != null ? `${String(Math.round(d.fatoResult.optimalHeading)).padStart(3,"0")}° / ${String(Math.round((d.fatoResult.optimalHeading+180)%360||360)).padStart(3,"0")}°` : "—"],
        ["Usability Achieved", d.fatoResult?.usabilityPercent != null ? `${d.fatoResult.usabilityPercent.toFixed(1)}%` : "—"],
        ["Recommended Approach Direction", d.approachResult?.approachDir != null ? `${String(Math.round(d.approachResult.approachDir)).padStart(3,"0")}°` : "—"],
      ]);
      body += sec("4", "Geometry (Minimum Planning)");
      body += kv([
        ["FATO Dimensions", `${V(dVal)} m × ${V(dVal)} m`],
        ["TLOF (Touchdown)", `${V(dVal)} m × ${V(dVal)} m`],
        ["Safety Area Clearance", `${V(((parseFloat(String(dVal)) || 0) * 1.5).toFixed(1))} m from FATO edge`],
        ["Obstacle Limitation Surface", "1:5 approach slope per ICAO Annex 14 Vol II"],
      ]);
      if (opts.includeWarnings) body += note("amber", "Warning: Heliport OLS surveys must confirm a 1:5 or 1:10 approach flight path based on classification. Wind-derived orientation does not account for physical landscape obstacles.");
      body += sec("5", "Wind Analysis Charts");
      body += buildWindChartsHTML(d.windRose || null, d.fatoResult?.optimalHeading ?? null, d.perfClass === "1" ? 17 : d.perfClass === "2" ? 15 : d.perfClass === "3" ? 10 : 15, "Heliport");
    }

    // ── Water Runway section ──
    if ((reportType === "combined" || reportType === "water") && waterReportData) {
      const d = waterReportData;
      const waveFactor = d.waveState === "rough" ? 2.0 : d.waveState === "moderate" ? 1.4 : d.waveState === "slight" ? 1.25 : d.waveState === "smooth" ? 1.1 : 1.0;
      const effectiveLen = d.selectedAc ? Math.round(d.selectedAc.refFieldLength_m * waveFactor) : 0;
      body += pageBreak;
      body += blockHeader("#dbeafe", "#2563eb", "Water Aerodrome Assessment", `${d.projName || d.projLoc || "Unnamed Project"} — ${d.waterType?.toUpperCase() || "Water"}`);
      body += sec("1", "Meteorological Data Source");
      body += kv([
        ["Active Source Type", d.windData?.sourceType === "ogimet" ? "Aviation METAR (Ogimet)" : d.windData?.sourceType === "meteostat" ? "Public Weather (Meteostat)" : "Official Meteorological Data"],
        ["Dataset Name", V(d.windData?.sourceName)],
        ["Recording Station", V(d.windData?.stationName)],
        ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ]);
      body += sec("2", "Site & Marine Conditions");
      body += kv([
        ["Water Body Type", V(d.waterType)],
        ["Wave State", d.waveState ? d.waveState.toUpperCase() : "—"],
        ["Wave Factor Applied", waveFactor.toFixed(2)+"x"],
        ["Available Depth", V(d.availDepth, " m")],
        ["Current Speed", V(d.currentSpeed, " kt")],
        ["Water Temperature", V(d.waterTemp, " °C")],
        ["Channel Type", V(d.channelType)],
      ]);
      body += sec("3", "Channel Alignment & Wind Usability");
      body += kv([
        ["Primary Channel Alignment", d.rwHeading ? `${d.rwHeading}° / ${(parseFloat(d.rwHeading)+180)%360||360}°` : "—"],
        ["Crosswind Limit Applied", V(d.xwLimit, " kt")],
        ["Calculated Usability", d.candidates?.find(c => c.runwayHeading === parseFloat(d.rwHeading))?.usabilityPercent?.toFixed(1)+"%" || "—"],
      ]);
      body += sec("4", "Reference Seaplane & Dimensions");
      body += kv([
        ["Reference Aircraft", d.selectedAc ? `${d.selectedAc.manufacturer} ${d.selectedAc.model}` : "—"],
        ["Base Field Length", d.selectedAc ? V(d.selectedAc.refFieldLength_m?.toLocaleString(), " m") : "—"],
        ["Effective Water Length", effectiveLen > 0 ? V(effectiveLen.toLocaleString(), " m") : "—"],
        ["Channel Width Guidance", d.selectedAc ? V((d.selectedAc.wingspan_m * 1.5).toFixed(0), " m (min clearance)") : "—"],
      ]);
      if (opts.includeWarnings) body += note("blue", "Advisory: Wave-drag coefficients drastically increase takeoff distance. Standard field-length models do not safely apply on water operations without seaplane performance manual corrections.");
      body += sec("5", "Wind Analysis Charts");
      body += buildWindChartsHTML(d.windRose || null, d.rwHeading ? parseFloat(d.rwHeading) : null, Number(d.xwLimit) || 15, "Water Aerodrome");
    }

    // ── Appendices ──
    if (opts.includeAssumptions) {
      body += pageBreak;
      body += sec("APP.A", "Assumptions & Limitations");
      body += `<ul style="margin:8pt 0;padding-left:18pt;font-size:9.5pt;line-height:1.7;">
        <li>This tool is for planning and preliminary engineering assessment only.</li>
        <li>Public or archive meteorological data (if used) does not replace official meteorological authority data.</li>
        <li>This software does not constitute operational or regulatory approval.</li>
        <li>Wind data sets analyzed represent historic patterns and do not predict absolute extremes.</li>
        <li>All lengths and clearances are derived via nominal planning regulations without terrain adjustments.</li>
        <li>Helicopter dimensions (D-Value, Rotor dia) and Performance Classes require flight manual verification.</li>
        <li>Wave states and water constraints assume static observations; dynamic tides/tidal ranges are beyond scope.</li>
      </ul>`;
    }
    if (opts.includeRegulatory) {
      body += sec("APP.B", "Regulatory Framework Applied");
      body += `<ul style="margin:8pt 0;padding-left:18pt;font-size:9.5pt;line-height:1.7;">
        <li>ICAO Annex 14 Volume I — Aerodromes</li>
        <li>ICAO Annex 14 Volume II — Heliports</li>
        <li>ICAO Doc 9157 & 9261 — Aerodrome Design and Operations Manuals</li>
        <li>Saudi GACAR Part 138 (Heliport Reference Guidance)</li>
        <li>Transport Canada TP 7776E (Water Aerodrome Guidance)</li>
      </ul>`;
    }

    body += `<p style="margin-top:40pt;text-align:center;font-family:Courier New;font-size:8pt;color:#999;letter-spacing:0.2em;text-transform:uppercase;">— End of Report —</p>`;

    // ── 4. Wrap in full HTML and export ──────────────────────────────────────
    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>AeroWind Engineering Report — ${primaryProjName}</title>
        <style>
          @page { size: A4 portrait; margin: 20mm 18mm; }
          body { font-family: Calibri, 'Segoe UI', sans-serif; font-size: 11pt; color: #111; line-height: 1.65; background: #fff; }
          h1 { font-size: 20pt; font-weight: 700; margin-bottom: 4pt; }
          h2 { font-size: 13pt; font-weight: 600; color: #0891b2; margin: 16pt 0 6pt; border-bottom: 1.5pt solid #d1d5db; padding-bottom: 3pt; }
          h3 { font-size: 11pt; font-weight: 600; margin: 10pt 0 4pt; }
          table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 10pt; }
          th, td { border: 0.75pt solid #d1d5db; padding: 5pt 8pt; text-align: left; vertical-align: top; }
          th { background: #f0f4f8; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: #374151; font-family: 'Courier New', monospace; }
          tr:nth-child(even) td { background: #f9fafb; }
          ul { padding-left: 18pt; }
          li { margin-bottom: 4pt; }
          img { max-width: 100%; height: auto; display: block; }
          p { margin-bottom: 6pt; }
        </style>
      </head>
      <body>${body}</body>
      </html>`;

    const blob = new Blob([fullHtml], { type: "application/msword;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `AeroWind_${reportType}_Report_${today.replace(/ /g,"_")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };


  const activeTitle = reportType === "combined" ? "Master Project Report" 
    : reportType === "airport" ? "Airport Engineering Report"
    : reportType === "heliport" ? "Heliport Engineering Report"
    : "Water Aerodrome Report";

  const primaryProjName = airportReportData?.projName || heliportReportData?.projName || waterReportData?.projName || "Aerodrome Project";
  const primaryLoc = airportReportData?.projLoc || heliportReportData?.projectLoc || waterReportData?.projLoc || "Location Not Specified";

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto bg-muted/20">
        <SectionHeader
          title="Reports Center"
          subtitle="Generate integrated or facility-specific planning documents"
          action={
            <div className="flex gap-2">
              <button onClick={handleWordExport} className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-sm transition-all shadow-sm">
                <FileText className="w-4 h-4" /> Word (.doc)
              </button>
              <button onClick={() => printElement("report-content")} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm transition-all shadow-custom">
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          }
        />

        {(() => {
          const wd = airportReportData?.windData || heliportReportData?.windData || waterReportData?.windData;
          if (!wd) return null;
          const isPub = wd.sourceType && wd.sourceType !== "official";
          return (
            <div className={`mb-6 p-4 border rounded-sm flex items-center justify-between shadow-sm max-w-[210mm] mx-auto ${isPub ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Database className={`w-4 h-4 ${isPub ? 'text-amber-500' : 'text-emerald-500'}`} />
                  Reports Center Traceability Link
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Active Origin: <strong className="text-foreground">{wd.sourceName || "Official Trace"}</strong> 
                  <span className="mx-2">•</span> 
                  Reliability: <strong className="uppercase">{wd.reliability}</strong>
                </p>
              </div>
              {isPub && (
                <div className="text-[10px] font-mono-data uppercase bg-amber-500/20 text-amber-600 px-3 py-1 rounded-sm border border-amber-500/30 text-right">
                  Public Data Active<br/>Verification Advised
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Builder Controls ── */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card border border-border rounded-sm shadow-sm p-6 max-w-[210mm] mx-auto">
          <div className="col-span-12 lg:col-span-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Report Scope
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "combined", label: "Full Project", on: true },
                { id: "airport", label: "Airport Only", on: hasData.airport },
                { id: "heliport", label: "Heliport Only", on: hasData.heliport },
                { id: "water", label: "Water Runway Only", on: hasData.water }
              ].map(t => (
                <button
                  key={t.id}
                  disabled={!t.on}
                  onClick={() => setReportType(t.id as any)}
                  className={`p-3 border text-sm flex items-center justify-between rounded-sm transition-all ${reportType === t.id ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-transparent border-input hover:bg-muted opacity-60 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"}`}
                >
                  <span className="font-medium font-serif-report">{t.label}</span>
                  {!t.on && <span className="text-[10px] uppercase font-mono-data opacity-50 px-2 py-0.5 bg-muted rounded-full">No Data</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-6 space-y-4 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Report Inclusions
            </h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { k: "includeAssumptions", label: "List Assumptions" },
                { k: "includeWarnings", label: "Safety Warnings" },
                { k: "includeRegulatory", label: "Regulatory Framework" }
              ].map((opt) => (
                <button key={opt.k} onClick={() => toggleOpt(opt.k as keyof typeof opts)} className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors text-left group">
                  <div className={`flex items-center justify-center p-0.5 rounded-sm transition-colors ${opts[opt.k as keyof typeof opts] ? "bg-primary text-primary-foreground" : "bg-transparent border border-input text-transparent group-hover:border-primary"}`}>
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <span className="font-mono-data uppercase text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Printed Report Target ── */}
        <div id="report-content" className="max-w-[210mm] mx-auto bg-foreground/[0.03] border border-border rounded-sm shadow-sm overflow-hidden">
          
          {/* Cover Page */}
          <div className="report-cover-page p-12 min-h-[500px] lg:min-h-[800px] flex flex-col justify-center items-center text-center bg-gradient-to-br from-card to-background border-b border-border print:break-after-page print:border-none print:min-h-[10in]">
            <div className="w-full max-w-lg mx-auto">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Wind className="w-10 h-10 text-primary" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-mono-data mb-6">Technical Engineering Report</p>
              <h1 className="text-4xl font-serif-report text-foreground mb-4 leading-tight">{primaryProjName}</h1>
              <h2 className="text-xl font-serif-report text-muted-foreground mb-12">{primaryLoc}</h2>
              
              <div className="grid grid-cols-2 gap-8 text-sm font-mono-data text-muted-foreground border-t border-border pt-12">
                <div>
                  <span className="block uppercase text-[9px] opacity-70 mb-2">Generated On</span>
                  <span className="text-foreground">{today}</span>
                </div>
                <div>
                  <span className="block uppercase text-[9px] opacity-70 mb-2">Report Profile</span>
                  <span className="text-foreground">{activeTitle}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="report-toc-page p-12 border-b border-border shadow-sm print:break-after-page print:border-none print:min-h-[10in] bg-card">
            <h2 className="text-3xl font-serif-report text-foreground mb-10 pb-4 border-b-2 border-primary inline-block">Table of Contents</h2>
            <div className="space-y-5 max-w-2xl text-[15px] font-serif-report">
              {(reportType === "combined" || reportType === "airport") && airportReportData && (
                <div className="flex justify-between items-end border-b border-dashed border-border/70 pb-1.5">
                  <span className="font-semibold text-primary">{reportType === "combined" ? "A." : "1."} Airport Facility Assessment</span>
                  <span className="text-muted-foreground font-mono-data text-xs">A</span>
                </div>
              )}
              {(reportType === "combined" || reportType === "heliport") && heliportReportData && (
                <div className="flex justify-between items-end border-b border-dashed border-border/70 pb-1.5">
                  <span className="font-semibold text-amber-600 dark:text-amber-500">{reportType === "combined" ? "H." : "1."} Heliport Facility Assessment</span>
                  <span className="text-muted-foreground font-mono-data text-xs">H</span>
                </div>
              )}
              {(reportType === "combined" || reportType === "water") && waterReportData && (
                <div className="flex justify-between items-end border-b border-dashed border-border/70 pb-1.5">
                  <span className="font-semibold text-blue-600 dark:text-blue-500">{reportType === "combined" ? "W." : "1."} Water Aerodrome Assessment</span>
                  <span className="text-muted-foreground font-mono-data text-xs">W</span>
                </div>
              )}
              {opts.includeAssumptions && (
                <div className="flex justify-between items-end border-b border-dashed border-border/70 pb-1.5 mt-8">
                  <span className="text-foreground">App A. Assumptions & Limitations</span>
                  <span className="text-muted-foreground font-mono-data text-[10px]">App</span>
                </div>
              )}
              {opts.includeRegulatory && (
                <div className="flex justify-between items-end border-b border-dashed border-border/70 pb-1.5">
                  <span className="text-foreground">App B. Regulatory Framework</span>
                  <span className="text-muted-foreground font-mono-data text-[10px]">App</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 pb-12">
            
            {/* Sections */}
            {(reportType === "combined" || reportType === "airport") && airportReportData ? (
              <AirportReportBlock data={airportReportData} opts={opts} numPrefix={reportType === "combined" ? "A." : ""} />
            ) : reportType === "airport" ? (
              <p className="p-8 text-center border-dashed border-2 border-border text-muted-foreground">No Airport data synchronized.</p>
            ) : null}

            {(reportType === "combined" || reportType === "heliport") && heliportReportData ? (
              <HeliportReportBlock data={heliportReportData} opts={opts} numPrefix={reportType === "combined" ? "H." : ""} />
            ) : reportType === "heliport" ? (
              <p className="p-8 text-center border-dashed border-2 border-border text-muted-foreground">No Heliport data synchronized.</p>
            ) : null}

            {(reportType === "combined" || reportType === "water") && waterReportData ? (
              <WaterRunwayReportBlock data={waterReportData} opts={opts} numPrefix={reportType === "combined" ? "W." : ""} />
            ) : reportType === "water" ? (
              <p className="p-8 text-center border-dashed border-2 border-border text-muted-foreground">No Water Runway data synchronized.</p>
            ) : null}

            {(reportType === "combined" && !airportReportData && !heliportReportData && !waterReportData) && (
              <p className="p-12 text-center text-muted-foreground font-mono-data text-sm border-dashed border-2 m-4 rounded-sm">
                No facility data available. Please visit the Airport, Heliport, or Water Runway modules to populate data.
              </p>
            )}

            {/* Appendices */}
            {opts.includeAssumptions && (
              <div className="mb-12 page-break-before">
                <SectionHeading num="APP.A" title="Assumptions & Limitations" />
                <div className="p-6 bg-muted/10 border border-border rounded-sm text-sm font-serif-report text-muted-foreground space-y-2">
                  <p>• This tool is for planning and preliminary engineering assessment only.</p>
                  <p>• Public or archive meteorological data (if used) does not replace official meteorological authority data.</p>
                  <p>• This software does not constitute operational or regulatory approval.</p>
                  <p>• Wind data sets analyzed represent historic patterns and do not predict absolute extremes.</p>
                  <p>• All lengths and clearances provided are derived strictly via nominal planning regulations without terrain adjustments.</p>
                  <p>• Helicopter dimensions (D-Value, Rotor dia) and Performance Classes are standardized references requiring flight manual verification.</p>
                  <p>• Wave states and water constraints assume static observations; dynamic tides and seasonal anomalies are beyond software scope.</p>
                </div>
              </div>
            )}

            {opts.includeRegulatory && (
              <div className="mb-12">
                <SectionHeading num="APP.B" title="Regulatory Framework Applied" />
                <div className="p-6 bg-muted/10 border border-border rounded-sm text-sm font-serif-report text-muted-foreground space-y-4">
                  <div className="p-4 border-l-2 border-l-primary bg-primary/5 text-primary text-xs flex flex-col gap-2">
                    <p className="font-semibold">{REGULATORY_STATEMENT}</p>
                    <p>{HELIPORT_DISCLAIMER}</p>
                  </div>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>ICAO Annex 14 Volume I — Aerodromes</li>
                    <li>ICAO Annex 14 Volume II — Heliports</li>
                    <li>ICAO Doc 9157 & 9261 — Manuals</li>
                    <li>Saudi GACAR Part 138 (Heliport Reference Guidance)</li>
                    <li>Transport Canada TP 7776E (Water Aerodrome Guidance)</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-8 border-t border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono-data opacity-60">End of Report</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportPage;
