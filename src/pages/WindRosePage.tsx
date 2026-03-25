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
import { parseWindData, parsedWindDataFromNormalizedPublicData, type ParsedWindData } from "@/lib/windDataParser";
import { calculateWindRose, DEFAULT_WIND_ROSE_OPTIONS, type WindRoseResult } from "@/lib/windRoseCalculator";
import { generateSafetyWarnings, DATA_LABELS, getConfidenceLevel } from "@/lib/engineeringSafety";
import { renderExecutiveWindRose, renderEngineeringWindRose } from "@/lib/windRoseRenderer";
import { exportCSV, exportSVGAsPNG } from "@/lib/exportUtils";
import { loadSampleDataAsFile, downloadSampleCSV, SAMPLE_PRESETS } from "@/lib/sampleDataGenerator";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { fetchAndParseMeteostat } from "@/lib/publicWeatherParser";
import { applyWindAdjustments } from "@/lib/windAdjustments";
import CoordinatePickerMap from "@/components/CoordinatePickerMap";
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

  const [adjEnabled, setAdjEnabled] = useState(false);
  const [adjDirOffset, setAdjDirOffset] = useState("0");
  const [adjSpdOffset, setAdjSpdOffset] = useState("0");

  const [showPublicPanel, setShowPublicPanel] = useState(false);
  const [publicCity, setPublicCity] = useState("");
  const [publicCountry, setPublicCountry] = useState("");
  const [publicLat, setPublicLat] = useState("");
  const [publicLon, setPublicLon] = useState("");
  const [publicStart, setPublicStart] = useState("");
  const [publicEnd, setPublicEnd] = useState("");

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

  const handleFetchPublic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lat = parseFloat(publicLat);
      const lon = parseFloat(publicLon);
      const latlon = !isNaN(lat) && !isNaN(lon) ? `${lat},${lon}` : "";
      const result = await fetchAndParseMeteostat(publicCity.trim(), publicCountry.trim(), latlon, publicStart.trim(), publicEnd.trim());
      const converted = parsedWindDataFromNormalizedPublicData(result, parseFloat(calmThreshold) || 3);
      setParsedData(converted);
      setShowPublicPanel(false);
    } catch (err: any) {
      setError(err.message || "Failed to fetch public data");
    } finally {
      setLoading(false);
    }
  }, [publicLat, publicLon, publicCity, publicCountry, publicStart, publicEnd, calmThreshold]);

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

  const effectiveParsedData = useMemo<ParsedWindData | null>(() => {
    if (!parsedData) return null;
    const calm = parseFloat(calmThreshold) || 3;
    const records = applyWindAdjustments(parsedData.records, calm, {
      enabled: adjEnabled,
      directionOffsetDeg: parseFloat(adjDirOffset) || 0,
      speedOffsetKt: parseFloat(adjSpdOffset) || 0,
      clampSpeedMinKt: 0,
    });
    if (records === parsedData.records) return parsedData;
    return { ...parsedData, records };
  }, [parsedData, calmThreshold, adjEnabled, adjDirOffset, adjSpdOffset]);

  const windRose = useMemo<WindRoseResult | null>(() => {
    if (!effectiveParsedData) return null;
    return calculateWindRose(effectiveParsedData.records, {
      ...DEFAULT_WIND_ROSE_OPTIONS,
      sectorSize: parseFloat(sectorType),
      calmThreshold: parseFloat(calmThreshold) || 3,
      useGust: useGust === "yes",
      monthFilter: monthFilter === "all" ? null : [parseInt(monthFilter)],
      seasonFilter: null,
    });
  }, [effectiveParsedData, sectorType, calmThreshold, useGust, monthFilter]);

  // Sync to shared analysis context
  useEffect(() => { analysis.setWindData(effectiveParsedData); }, [effectiveParsedData]);
  useEffect(() => { analysis.setWindRose(windRose); }, [windRose]);

  const warnings = useMemo(() => generateSafetyWarnings(effectiveParsedData), [effectiveParsedData]);
  const confidence = effectiveParsedData ? getConfidenceLevel(effectiveParsedData.reliability) : null;

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

              {/* Public Data Fetch (Open Source) */}
              <div className="mt-3 pt-3 border-t border-border">
                <button
                  onClick={() => setShowPublicPanel(!showPublicPanel)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-sm hover:border-primary/50 hover:bg-secondary/30 transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span className="text-foreground">Fetch Open Data</span>
                  <span className="text-muted-foreground ml-auto text-[10px]">Open‑Meteo archive</span>
                </button>

                {showPublicPanel && (
                  <div className="mt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <AeroInput label="Latitude" placeholder="24.7136" value={publicLat} onChange={setPublicLat} />
                      <AeroInput label="Longitude" placeholder="46.6753" value={publicLon} onChange={setPublicLon} />
                    </div>

                    <CoordinatePickerMap
                      value={
                        publicLat && publicLon && !isNaN(parseFloat(publicLat)) && !isNaN(parseFloat(publicLon))
                          ? { lat: parseFloat(publicLat), lon: parseFloat(publicLon) }
                          : null
                      }
                      onChange={(p) => {
                        setPublicLat(p.lat.toFixed(6));
                        setPublicLon(p.lon.toFixed(6));
                      }}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <AeroInput label="Start Date" placeholder="2025-01-01" value={publicStart} onChange={setPublicStart} />
                      <AeroInput label="End Date" placeholder="2025-12-31" value={publicEnd} onChange={setPublicEnd} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <AeroInput label="City (optional)" placeholder="Riyadh" value={publicCity} onChange={setPublicCity} />
                      <AeroInput label="Country (optional)" placeholder="SA" value={publicCountry} onChange={setPublicCountry} />
                    </div>

                    <button
                      onClick={handleFetchPublic}
                      disabled={loading}
                      className="w-full text-[10px] py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-30"
                    >
                      Fetch & Analyze
                    </button>

                    <p className="text-[10px] text-muted-foreground">
                      Uses Open‑Meteo Archive (public model grid). Suitable for planning; prefer certified station data for final engineering.
                    </p>
                  </div>
                )}
              </div>

              {effectiveParsedData && (
                <div className="mt-3 space-y-2">
                  <DataReliabilityBadge level={effectiveParsedData.reliability} reasons={effectiveParsedData.reliabilityReasons} />
                  <div className="text-[10px] text-muted-foreground space-y-1 font-mono-data">
                    <p>Records: {effectiveParsedData.validRows.toLocaleString()} valid / {effectiveParsedData.totalRows.toLocaleString()} total</p>
                    <p>Type: {effectiveParsedData.datasetType}</p>
                    {effectiveParsedData.dateRange && <p>Range: {effectiveParsedData.dateRange.start} → {effectiveParsedData.dateRange.end}</p>}
                    <p>Invalid: {effectiveParsedData.invalidRows} | Missing: {effectiveParsedData.missingValues}</p>
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

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Adjust Wind Data</span>
                    <button
                      onClick={() => setAdjEnabled((v) => !v)}
                      className={`text-[10px] px-2 py-1 rounded-sm border transition-colors ${
                        adjEnabled ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {adjEnabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <AeroInput label="Dir Offset" placeholder="0" unit="°" value={adjDirOffset} onChange={setAdjDirOffset} />
                    <AeroInput label="Speed Offset" placeholder="0" unit="KT" value={adjSpdOffset} onChange={setAdjSpdOffset} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    This modifies imported wind records (direction wrap 0–359, speed clamped ≥0) before analysis. Core equations stay unchanged.
                  </p>
                </div>
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
