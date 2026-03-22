import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import FileUploadZone from "@/components/FileUploadZone";
import ChartContainer from "@/components/ChartContainer";
import AeroDataTable from "@/components/AeroDataTable";
import DataReliabilityBadge from "@/components/DataReliabilityBadge";
import SafetyWarnings from "@/components/SafetyWarnings";
import CrosswindCalculator from "@/components/CrosswindCalculator";
import ApproachAdvisor from "@/components/ApproachAdvisor";
import HelipadUsability from "@/components/HelipadUsability";
import { AeroInput, AeroSelect } from "@/components/AeroInput";
import { parseWindData, type ParsedWindData } from "@/lib/windDataParser";
import { calculateWindRose, DEFAULT_WIND_ROSE_OPTIONS, type WindRoseResult } from "@/lib/windRoseCalculator";
import { generateSafetyWarnings, DATA_LABELS, getConfidenceLevel } from "@/lib/engineeringSafety";
import { renderExecutiveWindRose, renderEngineeringWindRose } from "@/lib/windRoseRenderer";
import { exportCSV, exportSVGAsPNG } from "@/lib/exportUtils";
import { loadSampleDataAsFile, downloadSampleCSV, SAMPLE_PRESETS } from "@/lib/sampleDataGenerator";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { Wind, Download, Database } from "lucide-react";

const WindRosePage = () => {
  const analysis = useAnalysis();
  const [parsedData, setParsedData] = useState<ParsedWindData | null>(null);
  const [calmThreshold, setCalmThreshold] = useState("3");
  const [sectorType, setSectorType] = useState("22.5");
  const [useGust, setUseGust] = useState("no");
  const [monthFilter, setMonthFilter] = useState("all");
  const [roseStyle, setRoseStyle] = useState<"executive" | "engineering">("executive");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSamplePanel, setShowSamplePanel] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = await parseWindData(file, parseFloat(calmThreshold) || 3);
      setParsedData(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  }, [calmThreshold]);

  const handleLoadSample = useCallback(async (presetIndex: number) => {
    const preset = SAMPLE_PRESETS[presetIndex];
    if (!preset) return;
    setShowSamplePanel(false);
    const file = loadSampleDataAsFile(preset.config);
    await handleFile(file);
  }, [handleFile]);

  const handleDownloadSample = useCallback((presetIndex: number) => {
    const preset = SAMPLE_PRESETS[presetIndex];
    if (preset) downloadSampleCSV(preset.config);
  }, []);

  const windRose = useMemo<WindRoseResult | null>(() => {
    if (!parsedData) return null;
    return calculateWindRose(parsedData.records, {
      ...DEFAULT_WIND_ROSE_OPTIONS,
      sectorSize: parseFloat(sectorType),
      calmThreshold: parseFloat(calmThreshold) || 3,
      useGust: useGust === "yes",
      monthFilter: monthFilter === "all" ? null : [parseInt(monthFilter)],
      seasonFilter: null,
    });
  }, [parsedData, sectorType, calmThreshold, useGust, monthFilter]);

  // Sync to shared analysis context
  useEffect(() => { analysis.setWindData(parsedData); }, [parsedData]);
  useEffect(() => { analysis.setWindRose(windRose); }, [windRose]);

  const warnings = useMemo(() => generateSafetyWarnings(parsedData), [parsedData]);
  const confidence = parsedData ? getConfidenceLevel(parsedData.reliability) : null;

  const svgString = useMemo(() => {
    if (!windRose) return "";
    const opts = { title: "Wind Rose Analysis", subtitle: `${windRose.totalObservations.toLocaleString()} observations | ${DATA_LABELS.icaoCompliant}` };
    return roseStyle === "engineering"
      ? renderEngineeringWindRose(windRose, opts)
      : renderExecutiveWindRose(windRose, opts);
  }, [windRose, roseStyle]);

  const tableRows = useMemo(() => {
    if (!windRose) return [];
    return windRose.bins.map((b) => [
      b.label,
      `${b.directionCenter}°`,
      `${b.totalFrequency.toFixed(2)}%`,
      b.speedBins.map((s) => s.count).reduce((a, c) => a + c, 0).toString(),
    ]);
  }, [windRose]);

  const handleExportCSV = () => {
    if (!windRose) return;
    exportCSV("wind_rose_frequency.csv",
      ["Direction", "Center (°)", "Frequency (%)", "Observations"],
      tableRows
    );
  };

  const handleExportPNG = () => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (svg) exportSVGAsPNG(svg, `wind_rose_${roseStyle}.png`, 4);
  };

  const prevailingWind = useMemo(() => {
    if (!windRose) return null;
    const maxBin = windRose.bins.reduce((a, b) => a.totalFrequency > b.totalFrequency ? a : b);
    return { direction: maxBin.label, center: maxBin.directionCenter, frequency: maxBin.totalFrequency };
  }, [windRose]);

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader
          title="Wind Rose Studio"
          subtitle={DATA_LABELS.icaoCompliant}
          action={
            <div className="flex gap-2">
              <button onClick={handleExportCSV} disabled={!windRose} className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-sm transition-all disabled:opacity-30">
                <Download className="w-4 h-4" /> CSV
              </button>
              <button onClick={handleExportPNG} disabled={!windRose} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm transition-all disabled:opacity-30">
                <Download className="w-4 h-4" /> PNG
              </button>
            </div>
          }
        />

        <div className="mb-3 flex items-center gap-3">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/30 text-primary rounded-sm font-mono-data">{DATA_LABELS.planningMode}</span>
          {confidence && (
            <span className={`px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border rounded-sm font-mono-data ${
              confidence.level === "high" ? "border-emerald-500/30 text-emerald-400" :
              confidence.level === "moderate" ? "border-warning/30 text-warning" :
              "border-destructive/30 text-destructive"
            }`}>{confidence.label}</span>
          )}
        </div>

        {warnings.length > 0 && <div className="mb-4"><SafetyWarnings warnings={warnings} /></div>}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <InstrumentCard title="Data Source">
              <FileUploadZone title="Drop wind data file" accept=".txt,.csv,.xlsx" onFile={handleFile} />
              {loading && <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary animate-progress-load" /></div>}
              {error && <p className="text-xs text-destructive mt-2">{error}</p>}

              {/* Sample Data Section */}
              <div className="mt-3 pt-3 border-t border-border">
                <button
                  onClick={() => setShowSamplePanel(!showSamplePanel)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-sm hover:border-primary/50 hover:bg-secondary/30 transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span className="text-foreground">Load Sample Data</span>
                  <span className="text-muted-foreground ml-auto text-[10px]">No ASOS data?</span>
                </button>

                {showSamplePanel && (
                  <div className="mt-2 space-y-2">
                    {SAMPLE_PRESETS.map((preset, i) => (
                      <div key={i} className="p-2.5 border border-border rounded-sm hover:border-primary/40 transition-colors">
                        <p className="text-xs text-foreground font-medium">{preset.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{preset.description}</p>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleLoadSample(i)} className="flex-1 text-[10px] py-1 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors">
                            Load & Analyze
                          </button>
                          <button onClick={() => handleDownloadSample(i)} className="text-[10px] py-1 px-2 border border-border text-muted-foreground rounded-sm hover:text-foreground hover:border-primary/40 transition-colors">
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {parsedData && (
                <div className="mt-3 space-y-2">
                  <DataReliabilityBadge level={parsedData.reliability} reasons={parsedData.reliabilityReasons} />
                  <div className="text-[10px] text-muted-foreground space-y-1 font-mono-data">
                    <p>Records: {parsedData.validRows.toLocaleString()} valid / {parsedData.totalRows.toLocaleString()} total</p>
                    <p>Type: {parsedData.datasetType}</p>
                    {parsedData.dateRange && <p>Range: {parsedData.dateRange.start} → {parsedData.dateRange.end}</p>}
                    <p>Invalid: {parsedData.invalidRows} | Missing: {parsedData.missingValues}</p>
                  </div>
                  {prevailingWind && (
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="text-[10px] text-muted-foreground font-mono-data">Prevailing: {prevailingWind.direction} ({prevailingWind.center}°) — {prevailingWind.frequency.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              )}
            </InstrumentCard>

            <InstrumentCard title="Parameters">
              <div className="space-y-4">
                <AeroInput label="Calm Threshold" placeholder="3.0" unit="KTS" value={calmThreshold} onChange={setCalmThreshold} />
                <AeroSelect label="Sector Size" value={sectorType} onChange={setSectorType} options={[
                  { value: "10", label: "10° (36 sectors)" },
                  { value: "15", label: "15° (24 sectors)" },
                  { value: "22.5", label: "22.5° (16 sectors)" },
                ]} />
                <AeroSelect label="Analysis Mode" value={useGust} onChange={setUseGust} options={[
                  { value: "no", label: "Sustained Wind" },
                  { value: "yes", label: "Gust Speed" },
                ]} />
                <AeroSelect label="Rose Style" value={roseStyle} onChange={(v) => setRoseStyle(v as any)} options={[
                  { value: "executive", label: "Executive (Presentation)" },
                  { value: "engineering", label: "Engineering (Detail)" },
                ]} />
                <AeroSelect label="Month Filter" value={monthFilter} onChange={setMonthFilter} options={[
                  { value: "all", label: "All Months" },
                  ...Array.from({ length: 12 }, (_, i) => ({
                    value: String(i + 1),
                    label: new Date(2000, i).toLocaleString("en", { month: "long" }),
                  })),
                ]} />
              </div>
            </InstrumentCard>
          </div>

          <div className="col-span-12 lg:col-span-9 space-y-4">
            <ChartContainer title="Wind Rose Visualization" className="min-h-[500px]">
              {windRose ? (
                <div ref={svgContainerRef} className="w-full flex flex-col items-center gap-4" dangerouslySetInnerHTML={{ __html: svgString }} />
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-64 h-64 rounded-full border border-border relative mx-auto">
                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-48 h-48 rounded-full border border-border/50" /></div>
                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-32 h-32 rounded-full border border-border/30" /></div>
                    <div className="absolute inset-0 flex items-center justify-center"><Wind className="w-8 h-8 text-primary/30 scanning-line" /></div>
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono-data text-muted-foreground">N</span>
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono-data text-muted-foreground">S</span>
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono-data text-muted-foreground">W</span>
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono-data text-muted-foreground">E</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Upload wind data or load sample data to generate ICAO-compliant wind rose</p>
                </div>
              )}
            </ChartContainer>

            {windRose && (
              <>
                <InstrumentCard title="Wind Frequency by Direction">
                  <AeroDataTable columns={["Direction", "Center (°)", "Frequency (%)", "Observations"]} rows={tableRows} />
                </InstrumentCard>

                <InstrumentCard title="Wind Speed Distribution Summary">
                  <AeroDataTable
                    columns={["Speed Range", "Count", "Frequency (%)"]}
                    rows={windRose.speedBinRanges.map((sr, i) => {
                      const count = windRose.bins.reduce((s, b) => s + b.speedBins[i].count, 0);
                      const freq = windRose.bins.reduce((s, b) => s + b.speedBins[i].frequency, 0);
                      return [sr.label, count.toString(), freq.toFixed(2) + "%"];
                    })}
                  />
                </InstrumentCard>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                    <p className="text-2xl font-display text-foreground">{windRose.calmFrequency.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Calm Wind ({windRose.calmCount.toLocaleString()} obs)</p>
                  </div>
                  <div className="p-4 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                    <p className="text-2xl font-display text-foreground">{prevailingWind?.direction || "—"}</p>
                    <p className="text-xs text-muted-foreground">Prevailing Direction</p>
                  </div>
                  <div className="p-4 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                    <p className="text-2xl font-display text-foreground">{windRose.totalObservations.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Observations</p>
                  </div>
                </div>

                {/* Approach Advisor - based on prevailing wind */}
                <ApproachAdvisor windRose={windRose} />

                {/* Helipad Usability Analysis */}
                <HelipadUsability records={parsedData!.records} windRose={windRose} />

                {/* Crosswind Calculator */}
                <CrosswindCalculator
                  defaultWindDir={prevailingWind?.center}
                  defaultWindSpeed={undefined}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default WindRosePage;
