import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppSidebar from "@/components/AppSidebar";
import { AdvancedWindAnalysis } from "@/components/AdvancedWindAnalysis";
import { OrientationOptimizer } from "@/components/OrientationOptimizer";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import DataReadout from "@/components/DataReadout";
import WarningBanner from "@/components/WarningBanner";
import FileUploadZone from "@/components/FileUploadZone";
import DataReliabilityBadge from "@/components/DataReliabilityBadge";
import ChartContainer from "@/components/ChartContainer";
import AeroDataTable from "@/components/AeroDataTable";
import { AeroSelect, AeroInput } from "@/components/AeroInput";
import CrosswindCalculator from "@/components/CrosswindCalculator";
import ApproachAdvisor, { type ApproachAnalysisResult } from "@/components/ApproachAdvisor";
import { parseWindData, type ParsedWindData, type WindRecord } from "@/lib/windDataParser";
import { calculateWindRose, DEFAULT_WIND_ROSE_OPTIONS, type WindRoseResult } from "@/lib/windRoseCalculator";
import { renderExecutiveWindRose, renderEngineeringWindRose, renderRunwayOverlayWindRose } from "@/lib/windRoseRenderer";
import { loadSampleDataAsFile, SAMPLE_PRESETS } from "@/lib/sampleDataGenerator";
import { calculateRunwayUsability, optimizeRunwayOrientation, type RunwayUsabilityResult, type OptimizationResult } from "@/lib/windComponents";
import { calculateRunwayLength, type RunwayLengthInputs } from "@/lib/runwayLength";
import { aircraftDatabase, searchAircraft, filterByGroup, type AircraftData } from "@/data/aircraftDatabase";
import { DISCLAIMER, DATA_LABELS } from "@/lib/engineeringSafety";
import { exportCSV } from "@/lib/exportUtils";
import DataSourcesModule from "@/components/DataSourcesModule";
import ScenarioComparison from "@/components/ScenarioComparison";

import { useAnalysis } from "@/contexts/AnalysisContext";
import { Wind, Download, Database, ChevronRight, ChevronLeft, CheckCircle2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "project", label: "Project Info" },
  { id: "wind", label: "Wind Data" },
  { id: "rose", label: "Wind Rose" },
  { id: "runway", label: "Runway Orientation" },
  { id: "aircraft", label: "Aircraft Selection" },
  { id: "length", label: "Runway Length" },
  { id: "tools", label: "Design Tools" },
  { id: "report", label: "Airport Report" },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── ICAO Aerodrome Reference Code table ──────────────────────────────────────
const ARC_ROWS = [
  ["1", "< 800 m", "A (< 15 m)", "< 4.5 m"],
  ["2", "800–1200 m", "B (15–24 m)", "4.5–6 m"],
  ["3", "1200–1800 m", "C (24–36 m)", "6–9 m"],
  ["4", "≥ 1800 m", "D (36–52 m) / E (52–65 m) / F (65–80 m)", "9–14 m"],
];

const hdg = (d: number) =>
  String(Math.round(((d % 360) + 360) % 360 || 360)).padStart(3, "0");

// ─── Component ────────────────────────────────────────────────────────────────
const AirportPage = () => {
  // Tab
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const tabIdx = TABS.findIndex(t => t.id === activeTab);
  const navigate = useNavigate();
  const goNext = () => {
    if (tabIdx >= TABS.length - 1) {
      navigate("/report?type=airport");
      return;
    }
    setActiveTab(TABS[Math.min(tabIdx + 1, TABS.length - 1)].id);
  };
  const goPrev = () => setActiveTab(TABS[Math.max(tabIdx - 1, 0)].id);

  const { airportReportData, setAirportReportData } = useAnalysis();

  // Tab 1 — Project Info
  const [projName, setProjName] = useState(airportReportData?.projName || "");
  const [projLoc, setProjLoc] = useState(airportReportData?.projLoc || "");
  const [elevation, setElevation] = useState(airportReportData?.elevation || "400");
  const [refTemp, setRefTemp] = useState(airportReportData?.refTemp || "40");
  const [gradient, setGradient] = useState(airportReportData?.gradient || "1.0");
  const [aeroCode, setAeroCode] = useState(airportReportData?.aeroCode || "4");
  const [notes, setNotes] = useState(airportReportData?.notes || "");

  // Tab 2 — Wind Data
  const [parsedData, setParsedData] = useState<ParsedWindData | null>(airportReportData?.windData || null);
  const [windLoading, setWindLoading] = useState(false);
  const [windError, setWindError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [calmThresh, setCalmThresh] = useState("3");
  const [sectorType, setSectorType] = useState("22.5");
  const [monthFilter, setMonthFilter] = useState("all");

  // Tab 3 — Wind Rose
  const [roseStyle, setRoseStyle] = useState<"executive" | "engineering">("executive");
  const svgRef = useRef<HTMLDivElement>(null);

  // Tab 4 — Runway Orientation
  const [rwHeading, setRwHeading] = useState("180");
  const [xwLimit, setXwLimit] = useState(airportReportData?.xwLimit ? String(airportReportData.xwLimit) : "20");
  const [customXw, setCustomXw] = useState("");
  const [candidates, setCandidates] = useState<RunwayUsabilityResult[]>(airportReportData?.candidates || []);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(airportReportData?.optimization || null);

  // Tab 6 — Runway Length
  const [baseLength, setBaseLength] = useState(airportReportData?.baseLength || "1800");
  const [surface, setSurface] = useState(airportReportData?.surface || "paved");
  const [headwind, setHeadwind] = useState("0");
  const [tailwind, setTailwind] = useState("0");
  const [wetRunway, setWetRunway] = useState("no");

  // Tab 5 — Aircraft Selection
  const [acQuery, setAcQuery] = useState("");
  const [acCat, setAcCat] = useState("all");
  const [selectedAc, setSelectedAc] = useState<AircraftData | null>(airportReportData?.selectedAc || null);

  // Cross-tab captured results
  const [approachResult, setApproachResult] = useState<ApproachAnalysisResult | null>(null);
  const onApproachAnalysis = useCallback((r: ApproachAnalysisResult) => setApproachResult(r), []);

  // Data Flow Linking: Aerodrome Code -> Crosswind Limit
  useEffect(() => {
    if (aeroCode === "1") setXwLimit("10");
    else if (aeroCode === "2") setXwLimit("13");
    else if (aeroCode === "3" || aeroCode === "4") setXwLimit("20");
  }, [aeroCode]);

  // Data Flow Linking: Selected Aircraft -> Runway Base Length
  useEffect(() => {
    if (selectedAc?.refFieldLength_m) {
      setBaseLength(String(selectedAc.refFieldLength_m));
    }
  }, [selectedAc]);

  // ─── Derived wind data ────────────────────────────────────────────────────
  const records = useMemo<WindRecord[]>(() => parsedData?.records ?? [], [parsedData]);

  const windRose = useMemo<WindRoseResult | null>(() => {
    if (!parsedData) return null;
    return calculateWindRose(parsedData.records, {
      ...DEFAULT_WIND_ROSE_OPTIONS,
      sectorSize: parseFloat(sectorType),
      calmThreshold: parseFloat(calmThresh) || 3,
      useGust: false,
      monthFilter: monthFilter === "all" ? null : [parseInt(monthFilter)],
      seasonFilter: null,
    });
  }, [parsedData, sectorType, calmThresh, monthFilter]);

  const prevailingWind = useMemo(() => {
    if (!windRose) return null;
    const max = windRose.bins.reduce((a, b) => a.totalFrequency > b.totalFrequency ? a : b);
    return { direction: max.label, center: max.directionCenter, freq: max.totalFrequency };
  }, [windRose]);

  const svgString = useMemo(() => {
    if (!windRose) return "";
    const opts = {
      title: projName ? `${projName} — Wind Rose` : "Airport Wind Rose",
      subtitle: `${windRose.totalObservations.toLocaleString()} observations | ICAO Annex 14 Vol I`,
    };
    return roseStyle === "engineering"
      ? renderEngineeringWindRose(windRose, opts)
      : renderExecutiveWindRose(windRose, opts);
  }, [windRose, roseStyle, projName]);

  // ─── Runway overlay SVG ───────────────────────────────────────────────────
  const effectiveXw = xwLimit === "custom" ? parseFloat(customXw) || 20 : parseFloat(xwLimit);

  const overlaySvg = useMemo(() => {
    if (!windRose || candidates.length === 0) return "";
    return renderRunwayOverlayWindRose(
      windRose,
      candidates.map(c => c.runwayHeading),
      candidates,
      effectiveXw,
      { title: "Runway Overlay — Wind Rose" }
    );
  }, [windRose, candidates, effectiveXw]);

  const bestCandidate = candidates.length > 0
    ? candidates.reduce((a, b) => a.usabilityPercent > b.usabilityPercent ? a : b)
    : null;

  const addCandidate = useCallback(() => {
    if (!parsedData) return;
    const h = parseInt(rwHeading);
    if (isNaN(h) || h < 1 || h > 360) return;
    const result = calculateRunwayUsability(parsedData.records, h, effectiveXw);
    setCandidates(prev => [...prev.filter(c => c.runwayHeading !== h), result]);
  }, [parsedData, rwHeading, effectiveXw]);

  const runOptimization = useCallback(() => {
    if (!parsedData) return;
    setOptimization(optimizeRunwayOrientation(parsedData.records, effectiveXw));
  }, [parsedData, effectiveXw]);

  // ─── Runway length ────────────────────────────────────────────────────────
  const rlInputs: RunwayLengthInputs = {
    baseLength: parseFloat(baseLength) || 0,
    airportElevation: parseFloat(elevation) || 0,
    referenceTemperature: parseFloat(refTemp) || 15,
    effectiveGradient: parseFloat(gradient) || 0,
    surfaceCondition: surface as "paved" | "turf" | "gravel",
    headwindComponent: parseFloat(headwind) || 0,
    tailwindComponent: parseFloat(tailwind) || 0,
    wetRunway: wetRunway === "yes",
  };
  const rlResult = useMemo(
    () => calculateRunwayLength(rlInputs),
    [baseLength, elevation, refTemp, gradient, surface, headwind, tailwind, wetRunway]
  );
  const rlBarTotal = rlResult.breakdown.reduce((s, b) => s + Math.abs(b.addedLength), 0) + rlResult.baseLength;
  const BCOL = ["bg-primary", "bg-primary/70", "bg-warning", "bg-warning/70", "bg-destructive/60", "bg-primary/50", "bg-warning/50"];

  // ─── Passive Report State Exporter ────────────────────────────────────────
  useEffect(() => {
    setAirportReportData({
      projName, projLoc, elevation, refTemp, gradient, aeroCode, notes,
      windData: parsedData, windRose,
      candidates, optimization, xwLimit: effectiveXw,
      rlResult, rlInputs, selectedAc,
      baseLength, surface
    });
  }, [
    projName, projLoc, elevation, refTemp, gradient, aeroCode, notes,
    parsedData, windRose, candidates, optimization, effectiveXw,
    rlResult, rlInputs, selectedAc, baseLength, surface,
    setAirportReportData
  ]);

  // ─── Aircraft browser ─────────────────────────────────────────────────────
  const filteredAc = useMemo(() => {
    let d = searchAircraft(acQuery, aircraftDatabase);
    d = filterByGroup(d, acCat === "all" ? "all" : acCat, "all");
    return d.slice(0, 80);
  }, [acQuery, acCat]);

  // ─── Wind data handlers ───────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setWindLoading(true);
    setWindError(null);
    try {
      const d = await parseWindData(file);
      setParsedData(d);
    } catch (e: any) {
      setWindError(e.message ?? "Failed to parse");
    } finally {
      setWindLoading(false);
    }
  }, []);

  const handleSample = useCallback(async (i: number) => {
    setShowSamples(false);
    await handleFile(loadSampleDataAsFile(SAMPLE_PRESETS[i].config));
  }, [handleFile]);

  const completedTabs = useMemo(() => {
    const s = new Set<TabId>();
    if (projName) s.add("project");
    if (parsedData) { s.add("wind"); if (windRose) s.add("rose"); }
    if (candidates.length > 0 || optimization) s.add("runway");
    if (rlResult.correctedLength > 0) s.add("length");
    if (selectedAc) s.add("aircraft");
    return s;
  }, [projName, parsedData, windRose, candidates, optimization, rlResult, selectedAc]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader
          title="Airport / Aerodrome Planning"
          subtitle="ICAO Annex 14 Vol I / GACAR — Planning-Level Engineering Workflow"
          action={
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/30 text-primary rounded-sm font-mono-data">
                {DATA_LABELS.planningMode}
              </span>
              {parsedData && <DataReliabilityBadge level={parsedData.reliability} />}
            </div>
          }
        />

        {/* ── Tab bar ── */}
        <div className="flex overflow-x-auto gap-0 mb-6 border-b border-border">
          {TABS.map((tab, i) => {
            const isActive = tab.id === activeTab;
            const isDone = completedTabs.has(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-[11px] font-mono-data whitespace-nowrap transition-colors border-b-2 -mb-px ${isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                {isDone && !isActive && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                <span className="text-muted-foreground/50 mr-0.5">{i + 1}.</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >

            {/* ════ TAB 1 — PROJECT INFO ════ */}
            {activeTab === "project" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6 space-y-4">
                  <InstrumentCard title="Aerodrome Project Identification">
                    <div className="space-y-4">
                      <AeroInput label="Project / Aerodrome Name" placeholder="New International Aerodrome" value={projName} onChange={setProjName} />
                      <AeroInput label="Location / Site" placeholder="City, Country" value={projLoc} onChange={setProjLoc} />
                      <div className="grid grid-cols-2 gap-3">
                        <AeroInput label="Elevation" placeholder="400" unit="M AMSL" value={elevation} onChange={setElevation} />
                        <AeroInput label="Reference Temperature" placeholder="40" unit="°C" value={refTemp} onChange={setRefTemp} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <AeroInput label="Effective Gradient" placeholder="1.0" unit="%" value={gradient} onChange={setGradient} />
                        <AeroSelect label="Aerodrome Code" value={aeroCode} onChange={setAeroCode} options={[
                          { value: "1", label: "Code 1 (< 800 m)" },
                          { value: "2", label: "Code 2 (800–1200 m)" },
                          { value: "3", label: "Code 3 (1200–1800 m)" },
                          { value: "4", label: "Code 4 (≥ 1800 m)" },
                        ]} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data">Project Notes</label>
                        <textarea
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          rows={4}
                          placeholder="Site constraints, planning assumptions…"
                          className="aero-input w-full resize-none rounded-sm text-sm"
                        />
                      </div>
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-6 space-y-4">
                  <InstrumentCard title="ICAO Aerodrome Reference Code">
                    <AeroDataTable
                      columns={["Code", "Ref Field Length", "Wingspan (Code Letter)", "Outer Main Gear"]}
                      rows={ARC_ROWS}
                    />
                    <p className="text-[9px] text-muted-foreground/60 mt-3 italic">ICAO Annex 14 Vol I Table 1-1. Planning reference only.</p>
                  </InstrumentCard>
                  <InstrumentCard title="Regulatory Framework">
                    <div className="space-y-2 text-[11px] font-mono-data text-muted-foreground">
                      {[
                        "ICAO Annex 14 Vol I — Aerodrome Design & Operations",
                        "ICAO Doc 9157 — Aerodrome Design Manual",
                        "GACAR Part 139 — Aerodrome Certification",
                        "ICAO Doc 9184 — Airport Planning Manual",
                      ].map((r, i) => (
                        <p key={i} className="border-b border-border pb-1.5">
                          <span className="text-primary mr-2">▸</span>{r}
                        </p>
                      ))}
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 2 — WIND DATA ════ — always mounted to preserve DataSourcesModule station locator state */}
            <div className={activeTab !== "wind" ? "hidden" : ""}>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <DataSourcesModule 
                    onFile={handleFile} 
                    onDataAccepted={setParsedData}
                    parsedData={parsedData} 
                    isLoading={windLoading} 
                    error={windError} 
                    onLoadSample={handleSample} 
                    samplePresets={SAMPLE_PRESETS} 
                  />
                  <InstrumentCard title="Analysis Options">
                    <div className="space-y-3">
                      <AeroInput label="Calm Threshold" placeholder="3" unit="KT" value={calmThresh} onChange={setCalmThresh} />
                      <AeroSelect label="Sector Size" value={sectorType} onChange={setSectorType} options={[
                        { value: "22.5", label: "22.5° (16 sectors)" },
                        { value: "10", label: "10° (36 sectors)" },
                        { value: "45", label: "45° (8 sectors)" },
                      ]} />
                      <AeroSelect label="Month Filter" value={monthFilter} onChange={setMonthFilter} options={[
                        { value: "all", label: "All Months" },
                        ...Array.from({ length: 12 }, (_, i) => ({
                          value: String(i + 1),
                          label: new Date(0, i).toLocaleString("en", { month: "long" }),
                        })),
                      ]} />
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  {parsedData ? (
                    <>
                      <InstrumentCard title="Wind Statistics">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <DataReadout value={parsedData.validRows.toLocaleString()} unit="OBS" label="Valid Records" />
                          <DataReadout value={windRose ? `${windRose.calmFrequency.toFixed(1)}` : "—"} unit="%" label="Calm Frequency" />
                          <DataReadout value={prevailingWind ? prevailingWind.direction : "—"} unit="" label="Prevailing Wind" />
                          <DataReadout value={prevailingWind ? `${prevailingWind.freq.toFixed(1)}` : "—"} unit="%" label="Prevailing Freq" />
                        </div>
                      </InstrumentCard>
                      <ScenarioComparison
                        records={parsedData.records}
                        sectorSizeDeg={parseFloat(sectorType) || 22.5}
                        monthFilter={monthFilter === "all" ? null : [parseInt(monthFilter)]}
                        useGust={false}
                      />
                      {windRose && (
                        <InstrumentCard title="Wind Direction Frequency Table">
                          <AeroDataTable
                            columns={["Sector", "Center (°)", "Frequency (%)", "Count"]}
                            rows={windRose.bins.map(b => [
                              b.label,
                              `${b.directionCenter}°`,
                              `${b.totalFrequency.toFixed(2)}%`,
                              b.speedBins.reduce((s, sp) => s + sp.count, 0).toString(),
                            ])}
                          />
                        </InstrumentCard>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                      <Wind className="w-10 h-10 text-primary/30" />
                      <p className="text-sm">Upload wind data or load a sample to begin analysis</p>
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* ════ TAB 3 — WIND ROSE ════ */}
            {activeTab === "rose" && (
              <div className="space-y-4">
                {!windRose ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                    <Wind className="w-10 h-10 text-primary/30" />
                    <p className="text-sm">Wind data needed — go to <strong>Tab 2</strong> first</p>
                    <button onClick={() => setActiveTab("wind")} className="text-xs px-4 py-2 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                      Go to Wind Data →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono-data">Style:</span>
                      {(["executive", "engineering"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setRoseStyle(s)}
                          className={`px-3 py-1 text-[10px] font-mono-data border rounded-sm transition-colors capitalize ${roseStyle === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                      <button
                        onClick={() => exportCSV(
                          "airport_wind_rose.csv",
                          ["Sector", "Center", "Frequency", "Count"],
                          windRose.bins.map(b => [
                            b.label,
                            `${b.directionCenter}°`,
                            `${b.totalFrequency.toFixed(2)}%`,
                            b.speedBins.reduce((s, sp) => s + sp.count, 0).toString(),
                          ])
                        )}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1 text-[10px] border border-border text-muted-foreground rounded-sm hover:text-foreground transition-colors"
                      >
                        <Download className="w-3 h-3" /> CSV
                      </button>
                    </div>
                    <ChartContainer title="Wind Rose">
                      <div ref={svgRef} className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: svgString }} />
                    </ChartContainer>
                    {prevailingWind && (
                      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-sm text-[11px] font-mono-data">
                        <span className="text-muted-foreground">Wind Rose Analysis →</span>
                        <span className="text-foreground">Prevailing: <span className="text-primary">{prevailingWind.direction} ({prevailingWind.center}°) — {prevailingWind.freq.toFixed(1)}%</span></span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground">Suggested runway heading (into wind): <span className="text-primary">{hdg((prevailingWind.center + 180) % 360)}° / {hdg(prevailingWind.center)}°</span></span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════ TAB 4 — RUNWAY ORIENTATION ════ */}
            {activeTab === "runway" && (
              <div className="space-y-4">
                {!windRose ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                    <Wind className="w-10 h-10 text-primary/30" />
                    <p className="text-sm">Wind data needed — go to <strong>Tab 2</strong> first</p>
                    <button onClick={() => setActiveTab("wind")} className="text-xs px-4 py-2 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                      Go to Wind Data →
                    </button>
                  </div>
                ) : (
                  <>
                    <WarningBanner message="Runway orientation analysis per ICAO Annex 14 Vol I §3.1. A runway must be usable ≥95% of time for the critical aircraft crosswind limit." />
                    {prevailingWind && (
                      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-sm text-[11px] font-mono-data">
                        <span className="text-muted-foreground">From Wind Rose →</span>
                        <span className="text-foreground">Prevailing: <span className="text-primary">{prevailingWind.direction} ({prevailingWind.center}°)</span></span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground">Recommended heading: <span className="text-primary">{hdg((prevailingWind.center + 180) % 360)}° / {hdg(prevailingWind.center)}°</span></span>
                        {optimization && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-foreground">Optimal: <span className="text-primary">{hdg(optimization.bestHeading)}° — {optimization.bestUsability.toFixed(1)}% usability</span></span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 lg:col-span-3 space-y-4">
                        <InstrumentCard title="Runway Configuration">
                          <div className="space-y-4">
                            <AeroInput label="Runway Heading" placeholder="180" unit="°" value={rwHeading} onChange={setRwHeading} />
                            <AeroSelect label="Crosswind Limit (ICAO)" value={xwLimit} onChange={setXwLimit} options={[
                              { value: "10", label: "10 kt (Code A)" },
                              { value: "13", label: "13 kt (Code B)" },
                              { value: "20", label: "20 kt (Code C–F)" },
                              { value: "custom", label: "Custom…" },
                            ]} />
                            {xwLimit === "custom" && (
                              <AeroInput label="Custom Limit" placeholder="15" unit="KT" value={customXw} onChange={setCustomXw} />
                            )}
                            <button onClick={addCandidate} disabled={!parsedData} className="w-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground py-2 text-sm rounded-sm transition-all disabled:opacity-30">
                              Analyze Heading
                            </button>
                            <button onClick={runOptimization} disabled={!parsedData} className="w-full bg-primary text-primary-foreground py-2 text-sm rounded-sm transition-all disabled:opacity-30">
                              Find Optimal Heading
                            </button>
                            {candidates.length > 0 && (
                              <button onClick={() => setCandidates([])} className="w-full text-xs text-muted-foreground hover:text-foreground border border-border py-1.5 rounded-sm transition-colors">
                                Clear Candidates
                              </button>
                            )}
                          </div>
                        </InstrumentCard>
                        {bestCandidate && (
                          <InstrumentCard title="Best Coverage" accentColor="primary">
                            <DataReadout value={bestCandidate.usabilityPercent.toFixed(1)} unit="%" label="Usability" />
                            <DataReadout value={`${hdg(bestCandidate.runwayHeading)}/${hdg(bestCandidate.reciprocal)}`} unit="°" label="Runway" />
                            <DataReadout value={bestCandidate.componentBreakdown.crosswindExceedPct.toFixed(1)} unit="%" label="Crosswind Exceedance" />
                          </InstrumentCard>
                        )}
                      </div>
                      <div className="col-span-12 lg:col-span-9 space-y-4">
                        <ChartContainer title="Wind Rose — Runway Overlay" className="min-h-[380px]">
                          {overlaySvg ? (
                            <div className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: overlaySvg }} />
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-16">Analyze a heading to see the runway overlay</p>
                          )}
                        </ChartContainer>
                        {candidates.length > 0 && (
                          <InstrumentCard title="Candidate Headings">
                            <AeroDataTable
                              columns={["Runway", "Heading", "Usability", "Xwind Exceed %", "Count", "≥95% (ICAO)"]}
                              rows={candidates.map(c => [
                                `${hdg(c.runwayHeading)}/${hdg(c.reciprocal)}`,
                                `${c.runwayHeading}°/${c.reciprocal}°`,
                                `${c.usabilityPercent.toFixed(2)}%`,
                                `${c.componentBreakdown.crosswindExceedPct.toFixed(2)}%`,
                                `${c.exceedances}`,
                                c.meets95 ? "✓ PASS" : "✗ FAIL",
                              ])}
                            />
                          </InstrumentCard>
                        )}
                        {optimization && (
                          <InstrumentCard title="Orientation Optimization — Top 5" accentColor="primary">
                            <div className="flex items-baseline gap-3 mb-3">
                              <span className="text-3xl font-display">{hdg(optimization.bestHeading)}°/{hdg((optimization.bestHeading + 180) % 360)}°</span>
                              <span className="text-sm text-muted-foreground">Optimal — {optimization.bestUsability.toFixed(2)}% usability</span>
                            </div>
                            <AeroDataTable
                              columns={["Rank", "Heading", "Usability"]}
                              rows={optimization.top5.map((t, i) => [
                                `#${i + 1}`,
                                `${hdg(t.heading)}°/${hdg((t.heading + 180) % 360)}°`,
                                `${t.usability.toFixed(2)}%`,
                              ])}
                            />
                          </InstrumentCard>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-8 space-y-8">
                      <OrientationOptimizer 
                        records={parsedData?.records || []} 
                        limit={xwLimit !== "custom" ? Number(xwLimit) : parseFloat(customXw || "0")} 
                        mode="airport" 
                      />
                      <AdvancedWindAnalysis 
                        windRose={windRose || null} 
                        records={parsedData?.records || []} 
                        orientation={optimization?.bestHeading ?? (rwHeading ? parseFloat(rwHeading) : null)} 
                        cwLimit={xwLimit !== "custom" ? Number(xwLimit) : parseFloat(customXw || "0")} 
                        mode="airport" 
                        fileNamePrefix="airport" 
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════ TAB 5 — AIRCRAFT SELECTION ════ */}
            {activeTab === "aircraft" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-3 space-y-4">
                  <InstrumentCard title="Search Aircraft">
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="ICAO, model…"
                          value={acQuery}
                          onChange={e => setAcQuery(e.target.value)}
                          className="aero-input w-full pl-9 rounded-sm"
                        />
                      </div>
                      <AeroSelect label="Category" value={acCat} onChange={setAcCat} options={[
                        { value: "all", label: "All Categories" },
                        { value: "commercial", label: "Commercial" },
                        { value: "regional", label: "Regional" },
                        { value: "business", label: "Business Jets" },
                        { value: "utility", label: "Utility" },
                      ]} />
                      <p className="text-[10px] text-muted-foreground font-mono-data">{filteredAc.length} aircraft shown</p>
                    </div>
                  </InstrumentCard>
                  {selectedAc && (
                    <InstrumentCard title="Selected Aircraft" accentColor="primary">
                      <p className="text-sm font-display text-foreground">{selectedAc.manufacturer} {selectedAc.model}</p>
                      <div className="mt-2 space-y-1 text-[11px] font-mono-data">
                        {[
                          ["ICAO", selectedAc.icao],
                          ["Category", `${selectedAc.aac}-${selectedAc.adg}`],
                          ["Ref Field", `${selectedAc.refFieldLength_m.toFixed(0)} m`],
                          ["Approach", `${selectedAc.approachSpeed_kts} kt`],
                          ["Wingspan", `${selectedAc.wingspan_m.toFixed(1)} m`],
                          ["MTOW", `${selectedAc.mtow_kg.toLocaleString()} kg`],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className={k === "ICAO" ? "text-primary" : "text-foreground"}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </InstrumentCard>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-9">
                  <InstrumentCard title="Aircraft Database (ICAO Annex 14)">
                    <div className="border border-border rounded-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary/50">
                            {["Aircraft", "ICAO", "Category", "Wingspan (m)", "MTOW (kg)", "App Spd (kt)", "Ref Field (m)"].map(c => (
                              <th key={c} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAc.map((a, i) => (
                            <tr
                              key={a.icao + i}
                              onClick={() => setSelectedAc(a)}
                              className={`border-t border-border cursor-pointer transition-colors ${selectedAc?.icao === a.icao ? "bg-primary/10" : "hover:bg-secondary/30"
                                }`}
                            >
                              <td className="px-3 py-2 text-xs">{a.manufacturer} {a.model}</td>
                              <td className="px-3 py-2 font-mono-data text-xs text-primary">{a.icao}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.aac}-{a.adg}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.wingspan_m.toFixed(1)}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.mtow_kg.toLocaleString()}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.approachSpeed_kts}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.refFieldLength_m.toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 6 — RUNWAY LENGTH ════ */}
            {activeTab === "length" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <InstrumentCard title="Airport Parameters">
                    <div className="space-y-4">
                      <AeroInput label="Base Runway Length (ARFL)" placeholder="1800" unit="M" value={baseLength} onChange={setBaseLength} />
                      <AeroInput label="Aerodrome Elevation" placeholder="400" unit="M AMSL" value={elevation} onChange={setElevation} />
                      <AeroInput label="Reference Temperature" placeholder="40" unit="°C" value={refTemp} onChange={setRefTemp} />
                      <AeroInput label="Effective Gradient" placeholder="1.0" unit="%" value={gradient} onChange={setGradient} />
                      <AeroSelect label="Surface Condition" value={surface} onChange={setSurface} options={[
                        { value: "paved", label: "Paved" },
                        { value: "turf", label: "Turf" },
                        { value: "gravel", label: "Gravel" },
                      ]} />
                      <AeroInput label="Headwind Component" placeholder="0" unit="KT" value={headwind} onChange={setHeadwind} />
                      <AeroInput label="Tailwind Component" placeholder="0" unit="KT" value={tailwind} onChange={setTailwind} />
                      <AeroSelect label="Wet Runway" value={wetRunway} onChange={setWetRunway} options={[
                        { value: "no", label: "Dry" },
                        { value: "yes", label: "Wet" },
                      ]} />
                    </div>
                  </InstrumentCard>
                  {selectedAc && (
                    <InstrumentCard title="Selected Aircraft — Ref Field Length" accentColor="primary">
                      <p className="text-sm font-mono-data text-foreground">{selectedAc.manufacturer} {selectedAc.model}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">ICAO Ref Field Length: <span className="text-primary">{selectedAc.refFieldLength_m.toFixed(0)} m</span></p>
                      <p className="text-[10px] text-muted-foreground">Approach Speed: <span className="text-foreground">{selectedAc.approachSpeed_kts} kt</span></p>
                    </InstrumentCard>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <DataReadout value={rlResult.correctedLength.toLocaleString()} unit="M" label="Corrected Length" />
                    <DataReadout value={rlResult.totalMultiplier.toFixed(3)} unit="×" label="Total Multiplier" />
                    <DataReadout value={(rlResult.correctedLength - rlResult.baseLength).toLocaleString()} unit="M" label="Total Adjustment" />
                  </div>
                  {rlResult.warnings.map((w, i) => <WarningBanner key={i} message={w} />)}
                  <InstrumentCard title="Correction Breakdown (ICAO Doc 9157)">
                    <style>{`
                      .ap-w-base { width: ${(rlResult.baseLength / rlBarTotal) * 100}%; }
                      ${rlResult.breakdown.map((item, i) => '.ap-w-bk-' + i + ' { width: ' + ((Math.abs(item.addedLength) / rlBarTotal) * 100) + '%; }').join('\n')}
                    `}</style>
                    <div className="flex h-8 rounded-sm overflow-hidden border border-border mb-4">
                      <div className="bg-secondary flex items-center justify-center ap-w-base">
                        <span className="text-[9px] font-mono-data truncate px-1">Base</span>
                      </div>
                      {rlResult.breakdown.map((item, i) => {
                        const w = Math.abs(item.addedLength) / rlBarTotal * 100;
                        if (w < 0.5) return null;
                        return (
                          <div key={i} className={`${BCOL[i % BCOL.length]} flex items-center justify-center ap-w-bk-${i}`}>
                            <span className="text-[8px] font-mono-data text-primary-foreground truncate px-0.5">
                              {item.addedLength > 0 ? "+" : ""}{Math.round(item.addedLength)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-2">
                      {rlResult.breakdown.map((item, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-border">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-sm ${BCOL[i % BCOL.length]}`} />
                            <div>
                              <p className="text-xs text-foreground">{item.label}</p>
                              <p className="text-[10px] text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono-data">{item.addedLength > 0 ? "+" : ""}{Math.round(item.addedLength).toLocaleString()} M</p>
                            <p className="text-[10px] font-mono-data text-muted-foreground">×{item.factor.toFixed(3)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t-2 border-primary/30 flex justify-between items-center">
                      <span className="text-sm font-medium">Corrected Length</span>
                      <span className="text-3xl font-display">
                        {rlResult.correctedLength.toLocaleString()}
                        <span className="text-sm font-mono-data text-muted-foreground ml-2">M</span>
                      </span>
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 7 — DESIGN TOOLS ════ */}
            {activeTab === "tools" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-5 space-y-4">
                  <CrosswindCalculator
                    defaultWindDir={prevailingWind?.center}
                    defaultWindSpeed={undefined}
                  />
                </div>
                <div className="col-span-12 lg:col-span-7 space-y-4">
                  {windRose ? (
                    <>
                      {optimization && (
                        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-sm text-[11px] font-mono-data">
                          <span className="text-muted-foreground">From Runway Orientation →</span>
                          <span className="text-foreground">Optimal runway: <span className="text-primary">{hdg(optimization.bestHeading)}°/{hdg((optimization.bestHeading + 180) % 360)}°</span></span>
                          {approachResult && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-foreground">Primary approach: <span className="text-primary">{hdg(approachResult.approachDir)}°</span></span>
                            </>
                          )}
                        </div>
                      )}
                      <ApproachAdvisor windRose={windRose} onAnalysis={onApproachAnalysis} />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 border border-border rounded-sm text-muted-foreground gap-3">
                      <Wind className="w-8 h-8 text-primary/30" />
                      <p className="text-sm">Load wind data (Tab 2) to enable approach analysis</p>
                    </div>
                  )}
                  <InstrumentCard title="ICAO Obstacle Limitation Surfaces (OLS)">
                    <AeroDataTable
                      columns={["Surface", "Inner Edge Width", "Slope", "Max Height"]}
                      rows={[
                        ["Conical", "—", "5%", "—"],
                        ["Inner Horizontal", "—", "—", "45 m"],
                        ["Approach (Inner)", "150 m", "2.5%/3.33%", "—"],
                        ["Approach (Outer)", "1200–1800 m", "5%", "—"],
                        ["Transitional", "—", "14.3%", "—"],
                        ["Take-off Climb", "180 m", "2%", "—"],
                      ]}
                    />
                    <p className="text-[9px] text-muted-foreground/60 mt-3 italic">
                      Reference: ICAO Annex 14 Vol I §4. Planning values only — detailed survey required.
                    </p>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 8 — AIRPORT REPORT ════ */}
            {activeTab === "report" && (
              <div className="space-y-4">
                <WarningBanner message="Planning-level summary report only. All values require validation against site surveys, aircraft performance data, and applicable national/ICAO standards before use." />
                <InstrumentCard title="Aerodrome Design Summary Report">
                  <div className="space-y-6 text-xs font-mono-data">

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Project Identification</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Project", projName || "—"],
                          ["Location", projLoc || "—"],
                          ["Elevation", elevation ? `${elevation} m AMSL` : "—"],
                          ["Reference Temperature", refTemp ? `${refTemp} °C` : "—"],
                          ["Effective Gradient", gradient ? `${gradient}%` : "—"],
                          ["Aerodrome Code", `Code ${aeroCode}`],
                          ["Regulatory Basis", "ICAO Annex 14 Vol I / GACAR Part 139"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground capitalize">{v}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Wind Data</p>
                      {parsedData ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {[
                            ["Records", `${parsedData.validRows.toLocaleString()} valid / ${parsedData.totalRows.toLocaleString()} total`],
                            ["Reliability", parsedData.reliability.toUpperCase()],
                            ["Prevailing Wind", prevailingWind ? `${prevailingWind.direction} (${prevailingWind.center}°) — ${prevailingWind.freq.toFixed(1)}%` : "—"],
                            ["Calm Frequency", windRose ? `${windRose.calmFrequency.toFixed(1)}% (${windRose.calmCount.toLocaleString()} obs)` : "—"],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="text-foreground">{v}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No wind data loaded — see Tab 2.</p>
                      )}
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Runway Orientation</p>
                      {optimization ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {[
                            ["Optimal Heading", `${hdg(optimization.bestHeading)}° / ${hdg((optimization.bestHeading + 180) % 360)}°`],
                            ["Wind Usability", `${optimization.bestUsability.toFixed(2)}%`],
                            ["ICAO 95% Threshold", optimization.bestUsability >= 95 ? "✓ PASS" : "✗ BELOW 95%"],
                            ["Crosswind Limit Applied", `${effectiveXw} kt`],
                            ["Primary Approach Dir", approachResult
                              ? `${hdg(approachResult.approachDir)}° (RWY ${approachResult.rwyDesignator})`
                              : prevailingWind
                                ? `${hdg((prevailingWind.center + 180) % 360)}°`
                                : "—"],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span className={`${(v as string).includes("PASS") ? "text-emerald-400" : (v as string).includes("BELOW") ? "text-warning" : "text-foreground"}`}>{v}</span>
                            </div>
                          ))}
                        </div>
                      ) : candidates.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {candidates.map(c => (
                            <div key={c.runwayHeading} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">RWY {hdg(c.runwayHeading)}/{hdg(c.reciprocal)}</span>
                              <span className={c.meets95 ? "text-emerald-400" : "text-warning"}>{c.usabilityPercent.toFixed(2)}% {c.meets95 ? "✓" : "✗"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Run runway orientation analysis (Tab 4) to populate.</p>
                      )}
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Runway Length Correction</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Base ARFL", `${rlResult.baseLength.toLocaleString()} m`],
                          ["Elevation Factor", `×${rlResult.breakdown.find(b => b.label === "Elevation")?.factor.toFixed(3) ?? "—"}`],
                          ["Temperature Factor", `×${rlResult.breakdown.find(b => b.label === "Temperature")?.factor.toFixed(3) ?? "—"}`],
                          ["Total Multiplier", `×${rlResult.totalMultiplier.toFixed(3)}`],
                          ["Corrected Length", `${rlResult.correctedLength.toLocaleString()} m`],
                          ["Surface", surface],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {selectedAc && (
                      <section>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Design Aircraft</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {[
                            ["Model", `${selectedAc.manufacturer} ${selectedAc.model}`],
                            ["ICAO", selectedAc.icao],
                            ["Category", `${selectedAc.aac}-${selectedAc.adg}`],
                            ["Ref Field Length", `${selectedAc.refFieldLength_m.toFixed(0)} m`],
                            ["Approach Speed", `${selectedAc.approachSpeed_kts} kt`],
                            ["Wingspan", `${selectedAc.wingspan_m.toFixed(1)} m`],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="text-foreground">{v}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {notes && (
                      <section>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Project Notes</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{notes}</p>
                      </section>
                    )}

                    <div className="pt-3 border-t border-border">
                      <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-1">Disclaimer</p>
                      <p className="text-[9px] text-muted-foreground/60 italic">{DISCLAIMER}</p>
                    </div>
                  </div>
                </InstrumentCard>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* ── Prev / Next ── */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
          <button
            onClick={goPrev}
            disabled={tabIdx === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border text-muted-foreground rounded-sm hover:text-foreground hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {tabIdx > 0 ? TABS[tabIdx - 1].label : "Back"}
          </button>
          <span className="text-[10px] font-mono-data text-muted-foreground">Step {tabIdx + 1} of {TABS.length}</span>
          <button
            onClick={goNext}
            disabled={false}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {tabIdx < TABS.length - 1 ? TABS[tabIdx + 1].label : "Reports Center"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default AirportPage;