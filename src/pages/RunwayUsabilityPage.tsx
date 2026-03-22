import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import DataReadout from "@/components/DataReadout";
import AeroDataTable from "@/components/AeroDataTable";
import ChartContainer from "@/components/ChartContainer";
import FileUploadZone from "@/components/FileUploadZone";
import SafetyWarnings from "@/components/SafetyWarnings";
import DataReliabilityBadge from "@/components/DataReliabilityBadge";
import { AeroInput, AeroSelect } from "@/components/AeroInput";
import { parseWindData, type ParsedWindData } from "@/lib/windDataParser";
import { calculateWindRose, DEFAULT_WIND_ROSE_OPTIONS } from "@/lib/windRoseCalculator";
import { calculateRunwayUsability, optimizeRunwayOrientation, type RunwayUsabilityResult, type OptimizationResult } from "@/lib/windComponents";
import { generateSafetyWarnings, DATA_LABELS, getConfidenceLevel } from "@/lib/engineeringSafety";
import { renderRunwayOverlayWindRose, renderComparisonWindRose } from "@/lib/windRoseRenderer";
import { exportCSV, exportSVGAsPNG } from "@/lib/exportUtils";
import { loadSampleDataAsFile, SAMPLE_PRESETS } from "@/lib/sampleDataGenerator";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { Download, Database } from "lucide-react";

const RunwayUsabilityPage = () => {
  const analysis = useAnalysis();
  const [parsedData, setParsedData] = useState<ParsedWindData | null>(null);
  const [heading, setHeading] = useState("180");
  const [crosswindLimit, setCrosswindLimit] = useState("13");
  const [customLimit, setCustomLimit] = useState("");
  const [candidates, setCandidates] = useState<RunwayUsabilityResult[]>([]);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const effectiveLimit = crosswindLimit === "custom" ? parseFloat(customLimit) || 13 : parseFloat(crosswindLimit);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    try { const data = await parseWindData(file); setParsedData(data); setCandidates([]); setOptimization(null); } finally { setLoading(false); }
  }, []);

  const handleLoadSample = useCallback(async (presetIndex: number) => {
    const preset = SAMPLE_PRESETS[presetIndex];
    if (!preset) return;
    const file = loadSampleDataAsFile(preset.config);
    await handleFile(file);
  }, [handleFile]);

  const addCandidate = useCallback(() => {
    if (!parsedData) return;
    const h = parseInt(heading);
    if (isNaN(h) || h < 1 || h > 360) return;
    const result = calculateRunwayUsability(parsedData.records, h, effectiveLimit);
    setCandidates((prev) => [...prev.filter((c) => c.runwayHeading !== h), result]);
  }, [parsedData, heading, effectiveLimit]);

  const runOptimization = useCallback(() => {
    if (!parsedData) return;
    setOptimization(optimizeRunwayOrientation(parsedData.records, effectiveLimit));
  }, [parsedData, effectiveLimit]);

  const warnings = useMemo(() => generateSafetyWarnings(parsedData), [parsedData]);
  const confidence = parsedData ? getConfidenceLevel(parsedData.reliability) : null;

  // Sync to shared context
  useEffect(() => { analysis.setRunwayCandidates(candidates); }, [candidates]);
  useEffect(() => { analysis.setRunwayOptimization(optimization); }, [optimization]);
  useEffect(() => { analysis.setCrosswindLimit(effectiveLimit); }, [effectiveLimit]);

  const bestCandidate = candidates.length > 0 ? candidates.reduce((a, b) => a.usabilityPercent > b.usabilityPercent ? a : b) : null;

  const windRose = useMemo(() => {
    if (!parsedData) return null;
    return calculateWindRose(parsedData.records, DEFAULT_WIND_ROSE_OPTIONS);
  }, [parsedData]);

  const overlaySvg = useMemo(() => {
    if (!windRose || candidates.length === 0) return "";
    if (candidates.length >= 2) {
      return renderComparisonWindRose(windRose, candidates[0].runwayHeading, candidates[1].runwayHeading, candidates[0], candidates[1], effectiveLimit, { title: "Runway Heading Comparison" });
    }
    return renderRunwayOverlayWindRose(windRose, candidates.map(c => c.runwayHeading), candidates, effectiveLimit, { title: "Runway Overlay — Wind Rose" });
  }, [windRose, candidates, effectiveLimit]);

  const tableRows = candidates.map((c) => [
    `${String(c.runwayHeading).padStart(3, "0")}/${String(c.reciprocal).padStart(3, "0")}`,
    `${c.runwayHeading}° / ${c.reciprocal}°`,
    `${c.usabilityPercent.toFixed(2)}%`,
    `${c.componentBreakdown.crosswindExceedPct.toFixed(2)}%`,
    `${c.exceedances}`,
    c.meets95 ? "✓ PASS" : "✗ FAIL",
  ]);

  const handleExportCSV = () => {
    exportCSV("runway_usability.csv", ["Runway", "Heading", "Usability %", "Exceedance %", "Exceedances", "≥95%"], tableRows);
  };

  const handleExportPNG = () => {
    const svg = svgRef.current?.querySelector("svg");
    if (svg) exportSVGAsPNG(svg, "runway_wind_overlay.png", 4);
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader
          title="Runway Usability Analysis"
          subtitle={DATA_LABELS.icaoCompliant}
          action={
            <div className="flex gap-2">
              <button onClick={handleExportCSV} disabled={candidates.length === 0} className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-sm transition-all disabled:opacity-30"><Download className="w-4 h-4" /> CSV</button>
              <button onClick={handleExportPNG} disabled={!overlaySvg} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm transition-all disabled:opacity-30"><Download className="w-4 h-4" /> PNG</button>
            </div>
          }
        />

        <div className="mb-3 flex items-center gap-3">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/30 text-primary rounded-sm font-mono-data">{DATA_LABELS.planningMode}</span>
          {confidence && <span className={`px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border rounded-sm font-mono-data ${confidence.level === "high" ? "border-emerald-500/30 text-emerald-400" : confidence.level === "moderate" ? "border-warning/30 text-warning" : "border-destructive/30 text-destructive"}`}>{confidence.label}</span>}
        </div>

        {warnings.length > 0 && <div className="mb-4"><SafetyWarnings warnings={warnings} /></div>}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <InstrumentCard title="Wind Data">
              <FileUploadZone title="Upload wind data" accept=".txt,.csv,.xlsx" onFile={handleFile} />
              {loading && <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary animate-progress-load" /></div>}

              {/* Sample data quick-load */}
              {!parsedData && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1.5"><Database className="w-3 h-3 text-primary" /> Quick-load sample data:</p>
                  <div className="space-y-1">
                    {SAMPLE_PRESETS.slice(0, 2).map((preset, i) => (
                      <button key={i} onClick={() => handleLoadSample(i)} className="w-full text-left px-2 py-1.5 text-[10px] border border-border rounded-sm hover:border-primary/40 hover:bg-secondary/30 transition-colors">
                        <span className="text-foreground">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {parsedData && <div className="mt-3"><DataReliabilityBadge level={parsedData.reliability} /><p className="text-[10px] text-muted-foreground font-mono-data mt-2">{parsedData.validRows.toLocaleString()} valid records</p></div>}
            </InstrumentCard>

            <InstrumentCard title="Runway Configuration">
              <div className="space-y-4">
                <AeroInput label="Runway Heading" placeholder="180" unit="°" value={heading} onChange={setHeading} />
                <AeroSelect label="Crosswind Limit (ICAO)" value={crosswindLimit} onChange={setCrosswindLimit} options={[
                  { value: "10", label: "10 kt (Code A)" },
                  { value: "13", label: "13 kt (Code B)" },
                  { value: "20", label: "20 kt (Code C–F)" },
                  { value: "custom", label: "Custom…" },
                ]} />
                {crosswindLimit === "custom" && <AeroInput label="Custom Limit" placeholder="15" unit="KT" value={customLimit} onChange={setCustomLimit} />}
                <button onClick={addCandidate} disabled={!parsedData} className="w-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground py-2 text-sm rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed">Analyze Heading</button>
                <button onClick={runOptimization} disabled={!parsedData} className="w-full bg-primary text-primary-foreground py-2 text-sm rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed">Find Optimal Heading</button>
              </div>
            </InstrumentCard>

            {bestCandidate && (
              <InstrumentCard title="Best Coverage" accentColor="primary">
                <div className="space-y-3">
                  <DataReadout value={bestCandidate.usabilityPercent.toFixed(1)} unit="%" label="All Weather Usability" />
                  <DataReadout value={bestCandidate.componentBreakdown.crosswindExceedPct.toFixed(1)} unit="%" label="Crosswind Exceedance" />
                  <DataReadout value={bestCandidate.exceedances.toLocaleString()} unit="OBS" label="Exceedances" />
                </div>
              </InstrumentCard>
            )}
          </div>

          <div className="col-span-12 lg:col-span-9 space-y-4">
            <ChartContainer title="Wind Rose — Runway Overlay" className="min-h-[400px]">
              {overlaySvg ? (
                <div ref={svgRef} className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: overlaySvg }} />
              ) : (
                <div className="relative w-72 h-72">
                  <div className="absolute inset-0 rounded-full border border-border" />
                  <div className="absolute inset-6 rounded-full border border-border/60" />
                  <div className="absolute inset-12 rounded-full border border-border/30" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/40" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-border/40" />
                  <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono-data text-primary">360°</span>
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono-data text-primary">180°</span>
                  <span className="absolute top-1/2 -left-6 -translate-y-1/2 text-[10px] font-mono-data text-muted-foreground">270°</span>
                  <span className="absolute top-1/2 -right-6 -translate-y-1/2 text-[10px] font-mono-data text-muted-foreground">090°</span>
                </div>
              )}
            </ChartContainer>

            {candidates.length > 0 && (
              <InstrumentCard title="Candidate Headings — Usability Assessment">
                <AeroDataTable columns={["Runway", "Heading", "Usability", "Exceedance %", "Count", "≥95% (ICAO)"]} rows={tableRows} />
              </InstrumentCard>
            )}

            {optimization && (
              <InstrumentCard title="Orientation Optimization — Top 5" accentColor="primary">
                <div className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-display text-foreground">{String(optimization.bestHeading).padStart(3, "0")}°/{String((optimization.bestHeading + 180) % 360 || 360).padStart(3, "0")}°</span>
                    <span className="text-sm text-muted-foreground">Optimal Heading — {optimization.bestUsability.toFixed(2)}% usability</span>
                  </div>
                  <AeroDataTable columns={["Rank", "Heading", "Usability"]} rows={optimization.top5.map((t, i) => [`#${i + 1}`, `${String(t.heading).padStart(3, "0")}° / ${String((t.heading + 180) % 360 || 360).padStart(3, "0")}°`, `${t.usability.toFixed(2)}%`])} />
                </div>
              </InstrumentCard>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RunwayUsabilityPage;
