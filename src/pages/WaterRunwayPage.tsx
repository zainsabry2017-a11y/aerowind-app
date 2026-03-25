import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, ChevronLeft, Wind, Map, Anchor, ShieldAlert, ArrowRight, Download, Search, Database, Route } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppSidebar from "@/components/AppSidebar";
import { AdvancedWindAnalysis } from "@/components/AdvancedWindAnalysis";
import { OrientationOptimizer } from "@/components/OrientationOptimizer";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import DataReadout from "@/components/DataReadout";
import WarningBanner from "@/components/WarningBanner";
import FileUploadZone from "@/components/FileUploadZone";
import DataReliabilityBadge from "@/components/DataReliabilityBadge";
import { AeroInput, AeroSelect } from "@/components/AeroInput";
import AeroDataTable from "@/components/AeroDataTable";

import { parseWindData, type ParsedWindData, type WindRecord } from "@/lib/windDataParser";
import { calculateWindRose } from "@/lib/windRoseCalculator";
import { renderExecutiveWindRose, renderEngineeringWindRose, renderRunwayOverlayWindRose } from "@/lib/windRoseRenderer";
import { calculateRunwayUsability, type RunwayUsabilityResult, optimizeRunwayOrientation, type OptimizationResult } from "@/lib/windComponents";
import { aircraftDatabase, searchAircraft, filterByCategory, type AircraftData } from "@/data/aircraftDatabase";
import { loadSampleDataAsFile, SAMPLE_PRESETS } from "@/lib/sampleDataGenerator";
import DataSourcesModule from "@/components/DataSourcesModule";
import ScenarioComparison from "@/components/ScenarioComparison";
import { DISCLAIMER, DATA_LABELS } from "@/lib/engineeringSafety";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { exportCSV } from "@/lib/exportUtils";

// ── Tabs ──
const TABS = [
  { id: "project",     label: "Project Info" },
  { id: "wind",        label: "Wind / Water Data" },
  { id: "orientation", label: "Channel Orientation" },
  { id: "aircraft",    label: "Seaplane Selection" },
  { id: "length",      label: "Length Guidance" },
  { id: "width",       label: "Width Guidance" },
  { id: "marking",     label: "Buoys & Marking" },
  { id: "depth",       label: "Depth & Bathymetry" },
  { id: "waves",       label: "Condition Advisory" },
  { id: "report",      label: "Water Report" },
] as const;
type TabId = typeof TABS[number]["id"];

const hdg = (d: number) => String(Math.round(((d % 360) + 360) % 360 || 360)).padStart(3, "0");

const WAVE_FACTORS: Record<string, number> = { calm: 1.0, smooth: 1.1, slight: 1.25, moderate: 1.4, rough: 2.0 };
const BCOL = ["bg-primary", "bg-primary/70", "bg-warning", "bg-warning/70", "bg-destructive/60", "bg-primary/50", "bg-warning/50"];

const WaterRunwayPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const [completedTabs, setCompletedTabs] = useState<Set<TabId>>(new Set(["project"]));

  const tabIdx = TABS.findIndex(t => t.id === activeTab);
  const navigate = useNavigate();
  const goNext = () => {
    if (tabIdx >= TABS.length - 1) {
      navigate("/report?type=water");
      return;
    }
    const nextId = TABS[Math.min(tabIdx + 1, TABS.length - 1)].id;
    setCompletedTabs(prev => new Set(prev).add(nextId));
    setActiveTab(nextId);
  };
  const goPrev = () => setActiveTab(TABS[Math.max(tabIdx - 1, 0)].id);

  const { waterReportData, setWaterReportData } = useAnalysis();

  // Tab 1 — Project Info
  const [projName, setProjName] = useState(waterReportData?.projName || "");
  const [projLoc, setProjLoc] = useState(waterReportData?.projLoc || "");
  const [elevation, setElevation] = useState(waterReportData?.elevation || "0");
  const [notes, setNotes] = useState(waterReportData?.notes || "");

  // Tab 2 — Wind / Water Data
  const [parsedData, setParsedData] = useState<ParsedWindData | null>(waterReportData?.windData || null);
  const [windLoading, setWindLoading] = useState(false);
  const [windError, setWindError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [calmThresh, setCalmThresh] = useState("3");
  const [sectorType, setSectorType] = useState("22.5");
  const [monthFilter, setMonthFilter] = useState("all");

  const [waterType, setWaterType] = useState(waterReportData?.waterType || "lake");
  const [waterTemp, setWaterTemp] = useState(waterReportData?.waterTemp || "20");

  // Tab 3 — Orientation
  const [roseStyle, setRoseStyle] = useState<"executive" | "engineering">("executive");
  const [rwHeading, setRwHeading] = useState(waterReportData?.rwHeading || "360");
  const [xwLimit, setXwLimit] = useState(waterReportData?.xwLimit ? String(waterReportData.xwLimit) : "10");
  const [customXw, setCustomXw] = useState("");
  const [candidates, setCandidates] = useState<RunwayUsabilityResult[]>(waterReportData?.candidates || []);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(waterReportData?.optimization || null);

  // Tab 4 — Aircraft Selection
  const [acQuery, setAcQuery] = useState("");
  const [acCat, setAcCat] = useState("all");
  const [selectedAc, setSelectedAc] = useState<AircraftData | null>(waterReportData?.selectedAc || null);

  // Tab 5 — Length Guidance
  const [waveState, setWaveState] = useState(waterReportData?.waveState || "calm"); 

  // Tab 6 — Width Guidance
  const [channelType, setChannelType] = useState(waterReportData?.channelType || "runway");

  // Tab 8 — Depth
  const [availDepth, setAvailDepth] = useState(waterReportData?.availDepth || "2.5");
  const [currentSpeed, setCurrentSpeed] = useState(waterReportData?.currentSpeed || "1.0");

  // ── Derived wind data ──
  const records = useMemo<WindRecord[]>(() => parsedData?.records ?? [], [parsedData]);

  const windRose = useMemo(() => {
    if (records.length === 0) return null;
    return calculateWindRose(records, {
      sectorSize: parseFloat(sectorType),
      speedBins: [0, 5, 10, 15, 20, 25, 30, 35],
      calmThreshold: parseFloat(calmThresh) || 3,
      useGust: false,
      monthFilter: monthFilter === "all" ? null : [parseInt(monthFilter)],
      seasonFilter: null,
    });
  }, [records, sectorType, calmThresh, monthFilter]);

  const prevailingWind = useMemo(() => {
    if (!windRose || windRose.bins.length === 0) return null;
    const max = windRose.bins.reduce((a, b) => a.totalFrequency > b.totalFrequency ? a : b);
    return { direction: max.label, center: max.directionCenter, freq: max.totalFrequency };
  }, [windRose]);

  const effectiveXw = xwLimit === "custom" ? parseFloat(customXw) || 12 : parseFloat(xwLimit);

  const addCandidate = useCallback(() => {
    if (!parsedData) return;
    const res = calculateRunwayUsability(records, parseFloat(rwHeading), effectiveXw);
    setCandidates(prev => {
      const exists = prev.findIndex(c => c.runwayHeading === res.runwayHeading);
      if (exists !== -1) { const np = [...prev]; np[exists] = res; return np; }
      return [...prev, res].sort((a,b) => b.usabilityPercent - a.usabilityPercent);
    });
  }, [parsedData, records, rwHeading, effectiveXw]);

  const runOptimization = useCallback(() => {
    if (!parsedData) return;
    const opt = optimizeRunwayOrientation(records, effectiveXw);
    setOptimization(opt);
    const res = calculateRunwayUsability(records, opt.bestHeading, effectiveXw);
    setCandidates(prev => {
      const exists = prev.findIndex(c => c.runwayHeading === res.runwayHeading);
      if (exists !== -1) { const np = [...prev]; np[exists] = res; return np; }
      return [...prev, res].sort((a,b) => b.usabilityPercent - a.usabilityPercent);
    });
    setRwHeading(opt.bestHeading.toString());
  }, [parsedData, records, effectiveXw]);

  const bestCandidate = candidates.length > 0 ? candidates.reduce((a, b) => a.usabilityPercent > b.usabilityPercent ? a : b) : null;

  const { setWaterReportData: _set_unused } = useAnalysis();
  useEffect(() => {
    setWaterReportData({
      projName, projLoc, elevation, notes,
      windData: parsedData, windRose,
      candidates, optimization, xwLimit: effectiveXw,
      rwHeading, selectedAc, waveState, waterType, waterTemp,
      channelType, availDepth, currentSpeed
    });
  }, [
    projName, projLoc, elevation, notes, parsedData, windRose,
    candidates, optimization, effectiveXw, rwHeading, selectedAc,
    waveState, waterType, waterTemp, channelType, availDepth, currentSpeed,
    setWaterReportData
  ]);

  const svgString = useMemo(() => {
    if (!windRose) return "";
    const opts = { title: projName ? `${projName} — Wind Rose` : "Water Aerodrome Wind Rose", subtitle: `${windRose.totalObservations.toLocaleString()} observations | Planning Guidance` };
    return roseStyle === "engineering" ? renderEngineeringWindRose(windRose, opts) : renderExecutiveWindRose(windRose, opts);
  }, [windRose, roseStyle, projName]);

  const overlaySvg = useMemo(() => {
    if (!windRose || candidates.length === 0) return "";
    return renderRunwayOverlayWindRose(windRose, candidates.map(c => c.runwayHeading), candidates, effectiveXw, { title: "Channel Alignment Overlay — Wind Rose" });
  }, [windRose, candidates, effectiveXw]);

  // ── Handling ──
  const handleFile = useCallback(async (file: File) => {
    setWindLoading(true); setWindError(null);
    try { setParsedData(await parseWindData(file)); }
    catch (e: any) { setWindError(e.message ?? "Failed to parse"); }
    finally { setWindLoading(false); }
  }, []);

  const handleSample = useCallback(async (i: number) => {
    setWindLoading(true); setWindError(null);
    try {
      const preset = SAMPLE_PRESETS[i];
      if (!preset) throw new Error("Preset not found");
      const f = loadSampleDataAsFile(preset.config);
      setParsedData(await parseWindData(f));
      setShowSamples(false);
    } catch (e: any) { setWindError(e.message); }
    finally { setWindLoading(false); }
  }, []);

  // ── Aircraft browser ──
  const filteredAc = useMemo(() => {
    let res = searchAircraft(acQuery, aircraftDatabase);
    res = filterByCategory(res, acCat);
    return res;
  }, [acQuery, acCat]);

  // ── Water Calculations ──
  const baseLength = selectedAc?.refFieldLength_m || 1000;
  const elevM = parseFloat(elevation) || 0;
  const elevFactor = 1 + (elevM / 300) * 0.07;
  const wFactor = WAVE_FACTORS[waveState] || 1.0;
  const requiredLength = baseLength * elevFactor * wFactor;
  
  const acWingspan = selectedAc?.wingspan_m || 15;
  const reqWidth = acWingspan * (channelType === "runway" ? 3.0 : 1.5);
  const turnBasin = acWingspan * 2.0;

  const acDraft = selectedAc ? Math.max(0.6, selectedAc.mtow_kg / 15000) : 1.0; 
  const reqDepth = acDraft + 0.5; // safety clearance
  const aDepth = parseFloat(availDepth) || 2.5;
  const depthWarning = aDepth < reqDepth;

  const curSpd = parseFloat(currentSpeed) || 0;
  const currentWarning = curSpd > 3.0; // Typical seaplane warning above 3 knots

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader title="Water Runway Analysis" subtitle="Water Aerodrome Planning & Evaluation Workflow" />
        
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-cyan-500/30 text-cyan-400 rounded-sm font-mono-data">PLANNING GUIDANCE</span>
            {parsedData && <DataReliabilityBadge level={parsedData.reliability} />}
          </div>
        </div>

        {/* ── Tabs Header ── */}
        <div className="flex overflow-x-auto gap-0 mb-6 border-b border-border">
          {TABS.map((tab, i) => {
            const isActive = tab.id === activeTab;
            const isDone = completedTabs.has(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => { setCompletedTabs(prev => new Set(prev).add(tab.id)); setActiveTab(tab.id); }}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-[11px] font-mono-data whitespace-nowrap transition-colors border-b-2 -mb-px ${isActive ? "border-cyan-400 text-cyan-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {isDone && !isActive && <CheckCircle2 className="w-3 h-3 text-cyan-500/70 shrink-0" />}
                <span className="text-muted-foreground/50 mr-0.5">{i + 1}.</span> {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>

            {/* ════ TAB 1 — PROJECT INFO ════ */}
            {activeTab === "project" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <InstrumentCard title="Water Aerodrome Identification">
                    <div className="grid grid-cols-2 gap-4">
                      <AeroInput label="Facility Name (Planning)" placeholder="e.g. Red Sea Seaplane Base" value={projName} onChange={setProjName} />
                      <AeroInput label="Location / Coordinates" placeholder="e.g. 24.5°N 37.2°E" value={projLoc} onChange={setProjLoc} />
                      <AeroInput label="Water Elevation" placeholder="0" unit="M AMSL" value={elevation} onChange={setElevation} />
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data">Project Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Tidal variations, marine traffic…" className="aero-input w-full resize-none rounded-sm text-sm" />
                      </div>
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <WarningBanner message="Water Runway workflows provide non-certified planning guidance. Marine and aviation approvals are strictly required before operations." />
                  <InstrumentCard title="Planning References">
                    <div className="space-y-2 text-[11px] font-mono-data text-muted-foreground">
                      {["ICAO Annex 14 (Seaplane Addendum Concepts)","GACAR Part 139 (Water Aerodromes)","Transport Canada TP 312 (Water)","FAA AC 150/5395-1A (Reference)"].map((r, i) => (
                        <p key={i} className="border-b border-border pb-1.5"><span className="text-cyan-400 mr-2">▸</span>{r}</p>
                      ))}
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 2 — WIND DATA ════ */}
            {activeTab === "wind" && (
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
                  
                  <InstrumentCard title="Water Body Environment">
                    <div className="space-y-4">
                      <AeroSelect label="Water Body Type" value={waterType} onChange={setWaterType} options={[
                        { value: "lake", label: "Lake (Freshwater)" }, { value: "river", label: "River (Flowing)" }, { value: "bay", label: "Sheltered Bay (Marine)" }, { value: "ocean", label: "Open Ocean" },
                      ]} />
                      <AeroInput label="Average Water Temp" placeholder="20" unit="°C" value={waterTemp} onChange={setWaterTemp} />
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <InstrumentCard title="Wind Processing Pipeline">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <DataReadout value={parsedData ? records.length.toLocaleString() : "—"} unit="rec" label="Active Records" />
                      <DataReadout value={parsedData ? (100 - (parsedData.missingValues / parsedData.totalRows * 100)).toFixed(1) : "—"} unit="%" label="Data Completeness" />
                      <DataReadout value={prevailingWind?.direction ?? "—"} unit="" label="Prevailing Wind" />
                      <DataReadout value={windRose?.calmFrequency.toFixed(1) ?? "—"} unit="%" label="Calm Freq." />
                    </div>
                  </InstrumentCard>
                  {parsedData && (
                    <ScenarioComparison
                      records={records}
                      sectorSizeDeg={parseFloat(sectorType) || 22.5}
                      monthFilter={monthFilter === "all" ? null : [parseInt(monthFilter)]}
                      useGust={false}
                    />
                  )}
                  <InstrumentCard title="Analysis Options">
                    <div className="space-y-3">
                      <AeroInput label="Calm Threshold" placeholder="3" unit="KT" value={calmThresh} onChange={setCalmThresh} />
                      <AeroSelect label="Sector Size" value={sectorType} onChange={setSectorType} options={[{ value: "22.5", label: "22.5° (16 sectors)" },{ value: "10", label: "10° (36 sectors)" },{ value: "45", label: "45° (8 sectors)" }]} />
                      <AeroSelect label="Month Filter" value={monthFilter} onChange={setMonthFilter} options={[{ value: "all", label: "All Months" },...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(0, i).toLocaleString("en", { month: "long" }) }))]} />
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 3 — ORIENTATION ════ */}
            {activeTab === "orientation" && (
              <>
                <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  {!parsedData ? (
                    <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                      <Wind className="w-10 h-10 text-cyan-500/30" />
                      <p className="text-sm">Wind data needed — go to <strong>Wind / Water Data</strong> first</p>
                      <button onClick={() => setActiveTab("wind")} className="text-xs px-4 py-2 border border-cyan-500 text-cyan-400 rounded-sm hover:bg-cyan-500/20 hover:text-cyan-300 transition-all">Go to Wind Data →</button>
                    </div>
                  ) : (
                    <>
                      <InstrumentCard title="Wind Rose & Channel Alignment">
                        <div dangerouslySetInnerHTML={{ __html: overlaySvg || svgString }} className="w-full h-[500px] flex items-center justify-center bg-zinc-950 rounded-sm border border-border overflow-hidden" />
                      </InstrumentCard>
                      {candidates.length > 0 && (
                        <InstrumentCard title="Candidate Channel Alignments">
                          <AeroDataTable
                            columns={["Channel Alignment", "Heading", "Usability", "Xwind Exceed %", "Count", "≥95% (ICAO)"]}
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
                    </>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  {prevailingWind && (
                    <div className="flex flex-col gap-1 p-4 bg-secondary/30 border border-border rounded-sm text-sm font-mono-data">
                      <span className="text-foreground">Prevailing: <span className="text-cyan-400">{prevailingWind.direction} ({prevailingWind.center}°)</span></span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground">Recommended heading: <span className="text-cyan-400">{hdg((prevailingWind.center + 180) % 360)}° / {hdg(prevailingWind.center)}°</span></span>
                      {optimization && (
                        <><span className="text-muted-foreground">·</span><span className="text-foreground">Optimal: <span className="text-cyan-400">{hdg(optimization.bestHeading)}° — {optimization.bestUsability.toFixed(1)}% usability</span></span></>
                      )}
                    </div>
                  )}
                  <InstrumentCard title="Channel Configuration">
                    <div className="space-y-4">
                      <AeroInput label="Channel Heading" placeholder="360" unit="°" value={rwHeading} onChange={setRwHeading} />
                      <AeroSelect label="Crosswind Limit (Seaplane)" value={xwLimit} onChange={setXwLimit} options={[
                        { value: "10", label: "10 kt (Small Floats/Amphib)" },
                        { value: "13", label: "13 kt (Medium Amphibian)" },
                        { value: "15", label: "15 kt (Large Seaplane)" },
                        { value: "custom", label: "Custom…" },
                      ]} />
                      {xwLimit === "custom" && <AeroInput label="Custom Limit" placeholder="12" unit="KT" value={customXw} onChange={setCustomXw} />}
                      <button onClick={addCandidate} disabled={!parsedData} className="w-full border border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 py-2 text-sm rounded-sm transition-all disabled:opacity-30">Analyze Heading</button>
                      <button onClick={runOptimization} disabled={!parsedData} className="w-full bg-cyan-600 text-white hover:bg-cyan-500 py-2 text-sm rounded-sm transition-all disabled:opacity-30">Find Optimal Heading</button>
                    </div>
                  </InstrumentCard>
                </div>
              </div>

              <div className="mt-8 space-y-8">
                <OrientationOptimizer 
                  records={parsedData?.records || []} 
                  limit={xwLimit !== "custom" ? Number(xwLimit) : (parseFloat(customXw) || 15)} 
                  mode="water" 
                />
                <AdvancedWindAnalysis 
                  windRose={windRose || null} 
                  records={parsedData?.records || []} 
                  orientation={optimization?.bestHeading ?? (rwHeading !== "" ? parseFloat(rwHeading) : null)} 
                  cwLimit={xwLimit !== "custom" ? Number(xwLimit) : (parseFloat(customXw) || 15)} 
                  mode="water" 
                  fileNamePrefix="water_runway" 
                />
              </div>
            </>
            )}

            {/* ════ TAB 4 — AIRCRAFT SELECTION ════ */}
            {activeTab === "aircraft" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-3 space-y-4">
                  <WarningBanner message="Water aerodromes specifically require floatplane, flying boat, or amphibian variants. Standard landplane reference lengths are planning placeholders only." />
                  <InstrumentCard title="Search Reference Aircraft">
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="ICAO, model…" value={acQuery} onChange={e => setAcQuery(e.target.value)} className="aero-input w-full pl-9 rounded-sm" />
                      </div>
                      <AeroSelect label="Category" value={acCat} onChange={setAcCat} options={[
                        { value: "all", label: "All Categories" },
                        { value: "utility", label: "Utility / Bush" },
                        { value: "regional", label: "Regional" },
                      ]} />
                      <p className="text-[10px] text-muted-foreground font-mono-data">{filteredAc.length} aircraft shown</p>
                    </div>
                  </InstrumentCard>
                  {selectedAc && (
                    <InstrumentCard title="Selected Profile" accentColor="primary">
                      <p className="text-sm font-display text-foreground">{selectedAc.manufacturer} {selectedAc.model}</p>
                      <div className="mt-2 space-y-1 text-[11px] font-mono-data">
                        {[
                          ["ICAO", selectedAc.icao],
                          ["MTOW", `${selectedAc.mtow_kg.toLocaleString()} kg`],
                          ["Ref Field", `${selectedAc.refFieldLength_m.toFixed(0)} m`],
                          ["Wingspan", `${selectedAc.wingspan_m.toFixed(1)} m`]
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span><span className={k === "ICAO" ? "text-cyan-400" : "text-foreground"}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </InstrumentCard>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-9">
                  <InstrumentCard title="Aircraft Database">
                    <div className="border border-border rounded-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary/50">
                            {["Aircraft", "ICAO", "Category", "Wingspan (m)", "MTOW (kg)", "Ref Length (m)"].map(c => (
                              <th key={c} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAc.map((a, i) => (
                            <tr
                              key={a.icao + i}
                              onClick={() => setSelectedAc(a)}
                              className={`border-t border-border cursor-pointer transition-colors ${selectedAc?.icao === a.icao ? "bg-cyan-500/10" : "hover:bg-secondary/30"}`}
                            >
                              <td className="px-3 py-2 text-xs">{a.manufacturer} {a.model}</td>
                              <td className="px-3 py-2 font-mono-data text-xs text-cyan-400">{a.icao}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.category}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.wingspan_m.toFixed(1)}</td>
                              <td className="px-3 py-2 font-mono-data text-xs">{a.mtow_kg.toLocaleString()}</td>
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

            {/* ════ TAB 5 — LENGTH GUIDANCE ════ */}
            {activeTab === "length" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <InstrumentCard title="Water Runway Modifiers">
                    <div className="space-y-4">
                      <AeroSelect label="Wave State / Surface" value={waveState} onChange={setWaveState} options={[
                        { value: "calm", label: "Calm / Glassy (No resistance)" },
                        { value: "smooth", label: "Smooth (Small ripples)" },
                        { value: "slight", label: "Slight (Wavelets)" },
                        { value: "moderate", label: "Moderate (Small waves)" },
                        { value: "rough", label: "Rough (Whitecaps) - WARNING" },
                      ]} />
                      <div className="flex items-center gap-2 p-3 border border-border bg-secondary/20 rounded-sm">
                        <Anchor className="w-4 h-4 text-cyan-500" />
                        <div>
                          <p className="text-xs">Wave Factor: <strong className="text-cyan-400 font-mono-data">×{wFactor.toFixed(2)}</strong></p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Hydraulic drag modifier</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 border border-border bg-secondary/20 rounded-sm">
                        <Map className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs">Elevation Factor: <strong className="text-cyan-400 font-mono-data">×{elevFactor.toFixed(2)}</strong></p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">+7% per 300m AMSL ({elevM}m)</p>
                        </div>
                      </div>
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DataReadout value={baseLength.toLocaleString()} unit="M" label="Aircraft Base Length" />
                    <DataReadout value={(elevFactor * wFactor).toFixed(2)} unit="×" label="Total Multiplier" />
                    <DataReadout value={requiredLength.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="M" label="Required Water Length" />
                  </div>
                  {waveState === "rough" && <WarningBanner message="Rough water significantly increases hull resistance and is generally unsafe for light seaplane operations." />}
                  {waveState === "calm" && <WarningBanner message="Glassy water conditions significantly reduce depth perception during landing. Visual aids strongly recommended." />}
                  <InstrumentCard title="Length Breakdown">
                     <AeroDataTable
                        columns={["Parameter", "Modifier", "Running Length"]}
                        rows={[
                          ["Aircraft Minimum Ref (ARFL)", "—", `${baseLength.toFixed(0)} m`],
                          [`Elevation (${elevM}m)`, `×${elevFactor.toFixed(2)}`, `${(baseLength * elevFactor).toFixed(0)} m`],
                          [`Hydraulic Drag (${waveState})`, `×${wFactor.toFixed(2)}`, `${requiredLength.toFixed(0)} m`],
                        ]}
                      />
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 6 — WIDTH GUIDANCE ════ */}
            {activeTab === "width" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <InstrumentCard title="Channel Configuration">
                    <AeroSelect label="Channel Definition" value={channelType} onChange={setChannelType} options={[
                      { value: "runway", label: "Water Runway (Take-off/Landing)" },
                      { value: "taxi", label: "Taxi Channel (Transit)" },
                    ]} />
                    <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                      <p>Runway width is typically planned at <strong>3.0×</strong> to <strong>5.0×</strong> the reference wingspan to account for wind drift and asymmetric water drag.</p>
                      <p>Taxi channels can be narrower, typically <strong>1.5×</strong> to <strong>2.0×</strong> wingspan.</p>
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <DataReadout value={acWingspan.toFixed(1)} unit="M" label="Aircraft Wingspan" />
                    <DataReadout value={reqWidth.toFixed(0)} unit="M" label="Recommended Min. Width" />
                  </div>
                  <InstrumentCard title="Area Requirements">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border border-border rounded-sm">
                        <p className="aero-label">Turning Basin Diameter</p>
                        <p className="text-2xl font-display text-cyan-400 mt-1">{turnBasin.toFixed(0)} M</p>
                        <p className="text-[10px] text-muted-foreground mt-2">Recommended minimum 2.0× wingspan for safe pivoting.</p>
                      </div>
                      <div className="p-4 border border-border rounded-sm">
                        <p className="aero-label">Wingtip Clearance</p>
                        <p className="text-2xl font-display text-cyan-400 mt-1">{((reqWidth - acWingspan) / 2).toFixed(1)} M</p>
                        <p className="text-[10px] text-muted-foreground mt-2">Minimum safe clearance per side to channel edge/obstructions.</p>
                      </div>
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 7 — BUOYS & MARKING ════ */}
            {activeTab === "marking" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 space-y-4">
                  <InstrumentCard title="Conceptual Visual Aids (Planning Guidance)">
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-border">
                          <thead className="bg-secondary/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-mono-data text-[10px] uppercase text-muted-foreground">Visual Aid Element</th>
                              <th className="px-4 py-2 text-left font-mono-data text-[10px] uppercase text-muted-foreground">Typical Marine / Aero Standard</th>
                              <th className="px-4 py-2 text-left font-mono-data text-[10px] uppercase text-muted-foreground">Application</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-border">
                              <td className="px-4 py-3 font-medium text-foreground">Channel Edge Markers</td>
                              <td className="px-4 py-3 text-muted-foreground">Yellow or Green/Red buoys (IALA compliance)</td>
                              <td className="px-4 py-3 text-muted-foreground">Delineates the lateral limits of the safe taxi or runway channel.</td>
                            </tr>
                            <tr className="border-t border-border">
                              <td className="px-4 py-3 font-medium text-foreground">Threshold Markers</td>
                              <td className="px-4 py-3 text-muted-foreground">Large Yellow spherical buoys</td>
                              <td className="px-4 py-3 text-muted-foreground">Indicates the beginning/end of the usable runway length.</td>
                            </tr>
                            <tr className="border-t border-border">
                              <td className="px-4 py-3 font-medium text-foreground">Mooring Buoys</td>
                              <td className="px-4 py-3 text-muted-foreground">White with blue band</td>
                              <td className="px-4 py-3 text-muted-foreground">Designated tie-down points for parked seaplanes.</td>
                            </tr>
                            <tr className="border-t border-border">
                              <td className="px-4 py-3 font-medium text-foreground">Wind Direction Indicator</td>
                              <td className="px-4 py-3 text-muted-foreground">Bright Orange Windcone (floating or shore-mounted)</td>
                              <td className="px-4 py-3 text-muted-foreground">Essential for seaplanes due to lack of fixed orientation.</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <WarningBanner message="Water aerodrome markings must not conflict with national coast guard or IALA maritime buoyage systems." />
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 8 — DEPTH ════ */}
            {activeTab === "depth" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <InstrumentCard title="Bathymetry Parameters">
                    <div className="space-y-4">
                      <AeroInput label="Surveyed Water Depth (At lowest tide/level)" placeholder="2.5" unit="M" value={availDepth} onChange={setAvailDepth} />
                      <div className="p-3 border border-border bg-secondary/10 rounded-sm">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data mb-1">Aircraft Info (Target)</p>
                        <p className="text-sm font-medium">{selectedAc ? `${selectedAc.manufacturer} ${selectedAc.model}` : "Generic Seaplane"}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Estimated Draft: Base draft derived from MTOW.</p>
                      </div>
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DataReadout value={acDraft.toFixed(2)} unit="M" label="Estimated Keel Draft" />
                    <DataReadout value={reqDepth.toFixed(2)} unit="M" label="Required Safe Depth" />
                    <DataReadout value={aDepth.toFixed(2)} unit="M" label="Available Depth" />
                  </div>
                  {depthWarning && <WarningBanner message="Available water depth is severely deficient. Risk of hull scraping or grounding." />}
                  {!depthWarning && <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-sm text-sm flex items-center gap-3"><CheckCircle2 className="w-5 h-5 flex-shrink-0" /> Available depth satisfies minimum safety clearance requirements for the estimated draft.</div>}
                  <InstrumentCard title="Draft & Clearance Concept">
                    <style>{`.wr-h-draft { height: ${(acDraft/aDepth) * 60}%; }`}</style>
                    <div className="relative h-24 border border-border rounded-sm overflow-hidden flex flex-col justify-end bg-cyan-900/10">
                       <div className="w-full absolute top-[20%] border-t-2 border-dashed border-cyan-400/50 flex items-center justify-center"><span className="text-[10px] font-mono-data text-cyan-400 bg-background px-2 -mt-2.5">Water Surface</span></div>
                       <div className="bg-cyan-500/20 w-32 relative mx-auto border-b-2 border-cyan-500 wr-h-draft"><span className="absolute bottom-1 w-full text-center text-[9px] text-cyan-200">Aircraft Hull Draft</span></div>
                       <div className="w-full h-1 bg-amber-600 border-t border-amber-500 mt-2"></div>
                       <div className="text-center absolute bottom-2 w-full text-[10px] text-amber-500 font-mono-data">Obstacle Free Minimum Clearance (+0.5M)</div>
                    </div>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 9 — WAVES & CONDITIONS ════ */}
            {activeTab === "waves" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <InstrumentCard title="Marine Condition Status">
                    <div className="space-y-4">
                      <AeroInput label="Water Current / Tidal Flow" placeholder="1.0" unit="KTS" value={currentSpeed} onChange={setCurrentSpeed} />
                      <div className="p-3 border border-border bg-secondary/10 rounded-sm">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data mb-1">Impact Factors</p>
                        <p className="text-sm">Wave State: <strong className="text-cyan-400 capitalize">{waveState}</strong></p>
                        <p className="text-sm">Water Temp: <strong className="text-cyan-400">{waterTemp}°C</strong></p>
                      </div>
                    </div>
                  </InstrumentCard>
                </div>
                <div className="col-span-12 lg:col-span-8 space-y-4">
                    {currentWarning && <WarningBanner message="Currents exceeding 3.0 knots significantly impede seaplane taxiing, docking, and slow-speed maneuverability." />}
                    {waterTemp && parseFloat(waterTemp) < 5 && <WarningBanner message="Low water temperatures increase hull/propeller icing risk and severe exposure risk to personnel during docking operations." />}
                    <InstrumentCard title="Condition Advisory Summary">
                      <div className="space-y-3">
                        <div className="flex gap-4 items-start p-3 border border-border rounded-sm">
                          <Wind className="w-5 h-5 text-cyan-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Wave Impact</p>
                            <p className="text-xs text-muted-foreground mt-1">State: {waveState.toUpperCase()}. {waveState === "rough" ? "Unusable for normal ops." : waveState === "calm" ? "Requires caution for depth perception." : "Acceptable for operations."}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 items-start p-3 border border-border rounded-sm">
                          <Route className="w-5 h-5 text-amber-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Speed / Flow Impact</p>
                            <p className="text-xs text-muted-foreground mt-1">Current: {curSpd.toFixed(1)} kts. {currentWarning ? "WARNING: High drift risk." : "Acceptable."}</p>
                          </div>
                        </div>
                      </div>
                    </InstrumentCard>
                </div>
              </div>
            )}

            {/* ════ TAB 10 — REPORT ════ */}
            {activeTab === "report" && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex justify-between items-end border-b-2 border-primary pb-4 mb-8">
                  <div>
                    <h1 className="text-3xl font-display text-foreground tracking-tight">Water Aerodrome Planning Report</h1>
                    <p className="text-sm text-cyan-400 font-mono-data mt-1">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <button onClick={() => window.print()} className="print:hidden flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-sm hover:bg-primary/90 transition-colors">
                    <Download className="w-4 h-4" /> Print / PDF
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:block print:space-y-6">
                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-400 mb-2 border-b border-border pb-1">Facility Information</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Facility", projName || "—"],
                          ["Location", projLoc || "—"],
                          ["Water Elevation", elevation ? `${elevation} m AMSL` : "—"],
                          ["Water Body", waterType],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground capitalize">{v}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-400 mb-2 border-b border-border pb-1">Aircraft & Geometry</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Reference Aircraft", selectedAc ? `${selectedAc.manufacturer} ${selectedAc.model}` : "Not Selected"],
                          ["Estimated Draft", `${acDraft.toFixed(2)} m`],
                          ["Wingspan", selectedAc ? `${selectedAc.wingspan_m.toFixed(1)} m` : "—"],
                          ["Required Length", `${requiredLength.toFixed(0)} m`],
                          ["Min Channel Width", `${reqWidth.toFixed(0)} m`],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground capitalize">{v}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-400 mb-2 border-b border-border pb-1">Wind & Orientation</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Aligned Channel", optimization ? `${hdg(optimization.bestHeading)}° / ${hdg((optimization.bestHeading + 180) % 360)}°` : "—"],
                          ["Wind Coverage", optimization ? `${optimization.bestUsability.toFixed(2)}%` : "—"],
                          ["Crosswind Limit", `${effectiveXw} kt`],
                          ["Prevailing Wind", prevailingWind ? `${prevailingWind.direction} (${prevailingWind.center}°) — ${prevailingWind.freq.toFixed(1)}%` : "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground capitalize">{v}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-400 mb-2 border-b border-border pb-1">Marine Conditions</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Wave State", waveState],
                          ["Water/Tidal Current", `${curSpd} kt`],
                          ["Water Temp", `${waterTemp} °C`],
                          ["Avail vs Req Depth", `${aDepth.toFixed(1)}m / ${reqDepth.toFixed(1)}m`],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k}</span>
                            <span className={`${(v as string).includes("Rough") || depthWarning ? "text-destructive" : "text-foreground"} capitalize`}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                </div>

                <div className="mt-8 text-[10px] text-muted-foreground font-mono-data border text-justify border-border p-4 rounded-sm">
                  {DISCLAIMER}
                  <br/><br/>
                  <strong className="text-cyan-400">MARINE & AVIATION COMPLIANCE:</strong> Wateraerodrome conceptual layouts must be validated against local Coast Guard, Maritime/Harbour Master regulations, and Civil Aviation Authorities (e.g. GACAR Part 139) constraints covering navigable waters.
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Prev / Next ── */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
          <button onClick={goPrev} disabled={tabIdx === 0} className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border text-muted-foreground rounded-sm hover:text-foreground hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />{tabIdx > 0 ? TABS[tabIdx - 1].label : "Back"}
          </button>
          <span className="text-[10px] font-mono-data text-muted-foreground">Step {tabIdx + 1} of {TABS.length}</span>
          <button onClick={goNext} disabled={false} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-cyan-600 text-white rounded-sm hover:bg-cyan-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            {tabIdx < TABS.length - 1 ? TABS[tabIdx + 1].label : "Reports Center"}<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default WaterRunwayPage;
