import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";

import type { AirportReportData, HeliportReportData, WaterReportData } from "@/contexts/AnalysisContext";
import { renderExecutiveWindRose } from "@/lib/windRoseRenderer";

type ReportType = "combined" | "airport" | "heliport" | "water";

function v(val: unknown, suffix = ""): string {
  if (val === null || val === undefined || val === "" || Number.isNaN(val as number)) return "—";
  return `${val}${suffix}`;
}

function heading(text: string, level: HeadingLevel, spacingBefore = 240, spacingAfter = 120) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: spacingBefore, after: spacingAfter },
  });
}

function p(text: string, opts?: { bold?: boolean; italic?: boolean; alignment?: AlignmentType }) {
  return new Paragraph({
    alignment: opts?.alignment,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italic,
        font: "Arial",
      }),
    ],
  });
}

function kvTable(rows: Array<[string, string]>) {
  const tableRows = rows.map(([k, val]) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 42, type: WidthType.PERCENTAGE },
          children: [p(k, { bold: true })],
        }),
        new TableCell({
          width: { size: 58, type: WidthType.PERCENTAGE },
          children: [p(val)],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

function simpleTable(headers: string[], rows: string[][]) {
  const headerRow = new TableRow({
    children: headers.map((h) => new TableCell({ children: [p(h, { bold: true })] })),
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow,
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c) => new TableCell({ children: [p(c)] })),
          })
      ),
    ],
  });
}

function sourceTypeLabel(sourceType?: string | null) {
  if (!sourceType || sourceType === "official") return "Official Meteorological Data";
  if (sourceType === "ogimet") return "Aviation METAR Data (Ogimet)";
  if (sourceType === "meteostat") return "Public Weather Data (Meteostat)";
  return "User Dataset";
}

function dataUriToUint8Array(dataUri: string): Uint8Array {
  const [, b64] = dataUri.split(",");
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function svgToPngDataUri(svg: string, widthPx: number): Promise<string> {
  const svg64 = btoa(unescape(encodeURIComponent(svg)));
  const svgUrl = `data:image/svg+xml;base64,${svg64}`;

  const img = new Image();
  img.decoding = "async";
  img.src = svgUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to render SVG image"));
  });

  const scale = widthPx / Math.max(1, img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/png", 1.0);
}

function speedDistSvgFromWindRose(windRose: any) {
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
  const bW = 380,
    bH = 20,
    bPad = 6,
    bLeft = 70;
  const totalH = speedRows.length * (bH + bPad) + 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${totalH}" style="font-family:Arial,sans-serif;background:#ffffff;" viewBox="0 0 600 ${totalH}">
    <text x="8" y="16" font-size="12" font-weight="700" fill="#111111">Speed Distribution</text>
    ${speedRows
      .map((r: any, i: number) => {
        const barW = Math.max(4, (r.freq / maxSpeedFreq) * bW);
        const y = 28 + i * (bH + bPad);
        return `<text x="${bLeft - 6}" y="${y + 14}" font-size="10" fill="#444" text-anchor="end">${r.label}</text>
        <rect x="${bLeft}" y="${y}" width="${barW}" height="${bH}" fill="#0891b2" rx="2"/>
        <text x="${bLeft + barW + 6}" y="${y + 14}" font-size="10" fill="#111">${r.freq.toFixed(1)}%</text>`;
      })
      .join("")}
  </svg>`;
}

function windFreqTable(windRose: any) {
  const rows = (windRose?.bins ?? []).map((b: any) => {
    const obs = b.speedBins?.reduce((s: number, sp: any) => s + sp.count, 0) || 0;
    return [String(b.label), `${b.directionCenter}°`, `${b.totalFrequency.toFixed(1)}%`, obs.toLocaleString()];
  });

  const header = new TableRow({
    children: ["Direction", "Center (°)", "Frequency (%)", "Observations"].map(
      (h) =>
        new TableCell({
          children: [p(h, { bold: true })],
        })
    ),
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      header,
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c) => new TableCell({ children: [p(c)] })),
          })
      ),
    ],
  });
}

async function windFiguresBlocks(label: string, windRose: any) {
  if (!windRose) {
    return [p(`No wind data available for ${label}.`, { italic: true })];
  }

  const windRoseSvg = renderExecutiveWindRose(windRose, { size: 540 });
  const windRosePng = await svgToPngDataUri(windRoseSvg, 1100);

  const speedSvg = speedDistSvgFromWindRose(windRose);
  const speedPng = await svgToPngDataUri(speedSvg, 1100);

  const blocks: (Paragraph | Table)[] = [];
  blocks.push(heading(`Wind Analysis — ${label}`, HeadingLevel.HEADING_2, 240, 120));

  blocks.push(heading("Wind Rose", HeadingLevel.HEADING_3, 120, 80));
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: dataUriToUint8Array(windRosePng),
          transformation: { width: 500, height: 500 },
        }),
      ],
    })
  );

  blocks.push(heading("Frequency by Direction", HeadingLevel.HEADING_3, 120, 80));
  blocks.push(windFreqTable(windRose));

  blocks.push(heading("Speed Distribution", HeadingLevel.HEADING_3, 120, 80));
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: dataUriToUint8Array(speedPng),
          transformation: { width: 600, height: 240 },
        }),
      ],
    })
  );

  return blocks;
}

export async function exportEditableReportDocx(args: {
  reportType: ReportType;
  todayLabel: string;
  activeTitle: string;
  primaryProjName: string;
  primaryLoc: string;
  opts: { includeAssumptions: boolean; includeWarnings: boolean; includeRegulatory: boolean; includeFigures: boolean };
  airportReportData: AirportReportData | null;
  heliportReportData: HeliportReportData | null;
  waterReportData: WaterReportData | null;
  filename: string;
}) {
  const { reportType, todayLabel, activeTitle, primaryProjName, primaryLoc, opts, airportReportData, heliportReportData, waterReportData, filename } = args;

  const children: Array<Paragraph | Table> = [];

  // Cover
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 120 },
      children: [new TextRun({ text: "TECHNICAL ENGINEERING REPORT", bold: true, font: "Arial" })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: primaryProjName, bold: true, size: 48, font: "Arial" })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: primaryLoc, size: 28, font: "Arial" })],
    })
  );
  children.push(
    kvTable([
      ["Date Generated", todayLabel],
      ["Report Profile", activeTitle],
    ])
  );

  // Sections
  const includeAirport = (reportType === "combined" || reportType === "airport") && !!airportReportData;
  const includeHeliport = (reportType === "combined" || reportType === "heliport") && !!heliportReportData;
  const includeWater = (reportType === "combined" || reportType === "water") && !!waterReportData;

  if (includeAirport && airportReportData) {
    const d = airportReportData;
    children.push(heading("Airport Facility Assessment", HeadingLevel.HEADING_1, 360, 120));
    children.push(heading("Meteorological Data Source", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["Active Source Type", sourceTypeLabel(d.windData?.sourceType)],
        ["Dataset Name", d.windData?.sourceName || "—"],
        ["Recording Station", d.windData?.stationName || "—"],
        ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
        ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
        ["Parsed Valid Rows", v(d.windData?.validRows?.toLocaleString())],
        ["Rejected Rows", v(d.windData?.invalidRows?.toLocaleString())],
      ])
    );
    children.push(heading("Project Info & Data Quality", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["Project", d.projName || "—"],
        ["Location", d.projLoc || "—"],
        ["Elevation", v(d.elevation, " m AMSL")],
        ["Reference Temperature", v(d.refTemp, " °C")],
        ["Effective Gradient", v(d.gradient, "%")],
        ["Aerodrome Code", v(d.aeroCode)],
        ["Valid Observations", v(d.windData?.validRows?.toLocaleString())],
        ["Data Reliability", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ])
    );

    children.push(heading("Wind Coverage & Runway Orientation", HeadingLevel.HEADING_2, 240, 120));
    const prevailingBin = d.windRose?.bins?.reduce((a: any, b: any) => (a.totalFrequency > b.totalFrequency ? a : b), d.windRose?.bins?.[0]);
    children.push(
      kvTable([
        ["Prevailing Wind", prevailingBin ? `${prevailingBin.label} (${prevailingBin.directionCenter}°)` : "—"],
        ["Calm Frequency", d.windRose ? `${d.windRose.calmFrequency.toFixed(2)}%` : "—"],
        ["Crosswind Limit", v(d.xwLimit, " kt")],
        ["Optimal Orientation", d.optimization ? `${String(d.optimization.bestHeading).padStart(3, "0")}° / ${String((d.optimization.bestHeading + 180) % 360 || 360).padStart(3, "0")}°` : "—"],
        ["Max Usability Achieved", d.optimization ? `${d.optimization.bestUsability.toFixed(2)}%` : "—"],
      ])
    );

    if (d.candidates?.length) {
      children.push(heading("Runway Candidates", HeadingLevel.HEADING_3, 120, 80));
      children.push(
        simpleTable(
          ["Heading", "Reciprocal", "Usability", "Meets 95%"],
          d.candidates.map((c: any) => [
            `${String(c.runwayHeading).padStart(3, "0")}°`,
            `${String((c.reciprocal ?? ((c.runwayHeading + 180) % 360)) || 360).padStart(3, "0")}°`,
            `${c.usabilityPercent.toFixed(2)}%`,
            c.meets95 ? "PASS" : "FAIL",
          ])
        )
      );
    }

    children.push(heading("Runway Length Correction", HeadingLevel.HEADING_2, 240, 120));
    if (d.rlResult) {
      children.push(
        kvTable([
          ["Base Length", v(d.rlResult.baseLength?.toLocaleString(), " m")],
          ["Combined Multiplier", v(d.rlResult.totalMultiplier?.toFixed(3), "×")],
          ["Corrected Length", v(d.rlResult.correctedLength?.toLocaleString(), " m")],
          ["Surface", d.rlInputs?.surface || d.surface || "—"],
          ["Design Aircraft", d.selectedAc ? `${d.selectedAc.manufacturer} ${d.selectedAc.model}` : "—"],
        ])
      );
      if (d.rlResult.breakdown?.length) {
        children.push(heading("Correction Breakdown", HeadingLevel.HEADING_3, 120, 80));
        children.push(
          simpleTable(
            ["Factor", "Multiplier", "Added Length", "Description"],
            d.rlResult.breakdown.map((b: any) => [
              b.label,
              `${Number(b.factor).toFixed(3)}×`,
              `${(b.addedLength >= 0 ? "+" : "") + Number(b.addedLength).toFixed(0)} m`,
              b.description ?? "—",
            ])
          )
        );
      }
      if (d.rlResult.warnings?.length) {
        children.push(heading("Runway Length Notes", HeadingLevel.HEADING_3, 120, 80));
        d.rlResult.warnings.slice(0, 8).forEach((w: string) => children.push(p(`• ${w}`)));
      }
    } else {
      children.push(p("No runway length analysis performed.", { italic: true }));
    }

    if (opts.includeFigures) {
      children.push(...(await windFiguresBlocks("Airport", d.windRose)));
    }
    if (d.notes) {
      children.push(heading("Notes", HeadingLevel.HEADING_2, 240, 120));
      children.push(p(d.notes));
    }
  }

  if (includeHeliport && heliportReportData) {
    const d = heliportReportData;
    children.push(heading("Heliport Facility Assessment", HeadingLevel.HEADING_1, 360, 120));
    children.push(heading("Meteorological Data Source", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["Active Source Type", sourceTypeLabel(d.windData?.sourceType)],
        ["Dataset Name", d.windData?.sourceName || "—"],
        ["Recording Station", d.windData?.stationName || "—"],
        ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
        ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
        ["Parsed Valid Rows", v(d.windData?.validRows?.toLocaleString())],
        ["Rejected Rows", v(d.windData?.invalidRows?.toLocaleString())],
      ])
    );
    children.push(heading("Project Info & Reference Helicopter", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["Project", d.projName || d.projectLoc || "—"],
        ["Heliport Type", v(d.heliType)],
        ["Performance Class", v(d.perfClass)],
        ["Reference Helicopter", d.helipad?.helicopter?.model ? `${d.helipad.helicopter.manufacturer} ${d.helipad.helicopter.model}` : (d.planningCategory || "—")],
        ["MTOW", v(d.mtow || d.helipad?.helicopter?.mtow_kg?.toLocaleString(), " kg")],
        ["D-Value", v(d.dValue || d.helipad?.dVal?.toFixed(1), " m")],
        ["Rotor Diameter", v(d.rotorDia || d.helipad?.rotor?.toFixed(1), " m")],
        ["Valid Observations", v(d.windData?.validRows?.toLocaleString())],
        ["Data Reliability", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ])
    );

    children.push(heading("FATO & Approach Orientation", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["FATO Optimal Heading", d.fatoResult?.optimalHeading != null ? `${String(Math.round(d.fatoResult.optimalHeading)).padStart(3, "0")}° / ${String(Math.round((d.fatoResult.optimalHeading + 180) % 360 || 360)).padStart(3, "0")}°` : "—"],
        ["Usability Achieved", d.fatoResult?.usabilityPercent != null ? `${Number(d.fatoResult.usabilityPercent).toFixed(1)}%` : "—"],
        ["Preferred Approach Direction", d.approachResult?.approachDir != null ? `${String(Math.round(d.approachResult.approachDir)).padStart(3, "0")}°` : (d.fatoResult?.recommendedApproach != null ? `${String(Math.round(d.fatoResult.recommendedApproach)).padStart(3, "0")}°` : "—")],
        ["Prevailing Wind Direction", d.approachResult?.prevailingDir != null ? `${String(Math.round(d.approachResult.prevailingDir)).padStart(3, "0")}°` : "—"],
        ["Secondary Wind Direction", d.approachResult?.secondaryDir != null ? `${String(Math.round(d.approachResult.secondaryDir)).padStart(3, "0")}°` : "—"],
        ["Secondary Cross Angle", d.approachResult?.secondaryCrossAngle != null ? `${Number(d.approachResult.secondaryCrossAngle).toFixed(0)}°` : "—"],
      ])
    );

    children.push(heading("Geometry Guidance (Minimum)", HeadingLevel.HEADING_2, 240, 120));
    const dValNum = parseFloat(d.dValue || "") || d.helipad?.dVal || 0;
    children.push(
      kvTable([
        ["FATO Dimensions", dValNum ? `${dValNum.toFixed(1)} m × ${dValNum.toFixed(1)} m` : "—"],
        ["Safety Area Clearance", dValNum ? `${(dValNum * 1.5).toFixed(1)} m from edge` : "—"],
      ])
    );

    if (opts.includeFigures) {
      children.push(...(await windFiguresBlocks("Heliport", d.windRose)));
    }
    if (d.notes) {
      children.push(heading("Notes", HeadingLevel.HEADING_2, 240, 120));
      children.push(p(d.notes));
    }
  }

  if (includeWater && waterReportData) {
    const d = waterReportData;
    children.push(heading("Water Aerodrome Assessment", HeadingLevel.HEADING_1, 360, 120));
    children.push(heading("Meteorological Data Source", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["Active Source Type", sourceTypeLabel(d.windData?.sourceType)],
        ["Dataset Name", d.windData?.sourceName || "—"],
        ["Recording Station", d.windData?.stationName || "—"],
        ["Analysis Date Range", d.windData?.dateRange ? `${d.windData.dateRange.start} to ${d.windData.dateRange.end}` : "—"],
        ["Data Reliability Class", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
        ["Parsed Valid Rows", v(d.windData?.validRows?.toLocaleString())],
        ["Rejected Rows", v(d.windData?.invalidRows?.toLocaleString())],
      ])
    );

    children.push(heading("Site & Marine Conditions", HeadingLevel.HEADING_2, 240, 120));
    children.push(
      kvTable([
        ["Project", d.projName || "—"],
        ["Location", d.projLoc || "—"],
        ["Water Body Type", v(d.waterType)],
        ["Wave State", d.waveState ? d.waveState.toUpperCase() : "—"],
        ["Water Temperature", v(d.waterTemp, " °C")],
        ["Channel Type", v(d.channelType)],
        ["Available Depth", v(d.availDepth, " m")],
        ["Current Speed", v(d.currentSpeed, " kt")],
        ["Valid Observations", v(d.windData?.validRows?.toLocaleString())],
        ["Data Reliability", d.windData?.reliability ? d.windData.reliability.toUpperCase() : "—"],
      ])
    );

    children.push(heading("Channel Alignment & Wind Usability", HeadingLevel.HEADING_2, 240, 120));
    const selectedHeading = d.rwHeading ? parseFloat(d.rwHeading) : NaN;
    const selCandidate = Number.isFinite(selectedHeading) ? d.candidates?.find((c: any) => c.runwayHeading === selectedHeading) : null;
    children.push(
      kvTable([
        ["Primary Channel Alignment", Number.isFinite(selectedHeading) ? `${String(selectedHeading).padStart(3, "0")}° / ${String(((selectedHeading + 180) % 360) || 360).padStart(3, "0")}°` : "—"],
        ["Crosswind Limit Applied", v(d.xwLimit, " kt")],
        ["Calculated Usability", selCandidate ? `${selCandidate.usabilityPercent.toFixed(2)}%` : "—"],
      ])
    );

    children.push(heading("Reference Seaplane & Dimensions", HeadingLevel.HEADING_2, 240, 120));
    const waveFactor =
      d.waveState === "rough" ? 2.0 :
      d.waveState === "moderate" ? 1.4 :
      d.waveState === "slight" ? 1.25 :
      d.waveState === "smooth" ? 1.1 : 1.0;
    const effectiveLen = d.selectedAc ? Math.round(Number(d.selectedAc.refFieldLength_m || 0) * waveFactor) : 0;
    children.push(
      kvTable([
        ["Reference Aircraft", d.selectedAc ? `${d.selectedAc.manufacturer} ${d.selectedAc.model}` : "—"],
        ["Base Field Length", d.selectedAc ? v(d.selectedAc.refFieldLength_m?.toLocaleString(), " m") : "—"],
        ["Wave Factor Applied", `${waveFactor.toFixed(2)}×`],
        ["Effective Water Length", effectiveLen ? `${effectiveLen.toLocaleString()} m` : "—"],
      ])
    );

    if (opts.includeFigures) {
      children.push(...(await windFiguresBlocks("Water Aerodrome", d.windRose)));
    }
    if (d.notes) {
      children.push(heading("Notes", HeadingLevel.HEADING_2, 240, 120));
      children.push(p(d.notes));
    }
  }

  if (opts.includeAssumptions) {
    children.push(heading("Appendix A — Assumptions & Limitations", HeadingLevel.HEADING_1, 360, 120));
    [
      "This tool is for planning and preliminary engineering assessment only.",
      "Public or archive meteorological data (if used) does not replace official meteorological authority data.",
      "This software does not constitute operational or regulatory approval.",
      "Wind data sets analyzed represent historic patterns and do not predict absolute extremes.",
    ].forEach((t) => children.push(p(`• ${t}`)));
  }

  if (opts.includeRegulatory) {
    children.push(heading("Appendix B — Regulatory Framework", HeadingLevel.HEADING_1, 360, 120));
    [
      "ICAO Annex 14 Volume I — Aerodromes",
      "ICAO Annex 14 Volume II — Heliports",
      "ICAO Doc 9157 & 9261 — Manuals",
      "Saudi GACAR Part 138 (Heliport Reference Guidance)",
      "Transport Canada TP 7776E (Water Aerodrome Guidance)",
    ].forEach((t) => children.push(p(`• ${t}`)));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "111111" },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

