/**
 * ============================================================================
 * HELIPORT FREEZE CHECKLIST (ICAO Annex 14 Vol II / GACAR Part 138 Basis)
 * ============================================================================
 * ⚠ DO NOT MODIFY THIS MODULE WITHOUT RE-VERIFYING THE FOLLOWING:
 * 1. TAB ORDERING: 'Helicopter Selection' MUST precede 'FATO Orientation'. 
 *    Crosswind limits are strictly parametric and derived from the helicopter.
 * 2. TERMINOLOGY: Strictly use 'FATO' and 'TLOF'. 'Runway' or 'RWY' must 
 *    NOT bleed into this context. FATO is omnidirectional/reciprocal.
 * 3. CALM WIND PRESERVATION: The parser must map 0-kts / null-direction 
 *    to a safe valid record (0°). Calm winds are 100% usable FATO hours.
 * 4. REPORT COUPLING: The final 'Heliport Report' tab must always mount 
 *    from active local React states (`parsedData`, `fatoResult`), NOT stale 
 *    context caches, to ensure 1:1 parity with user views.
 * 5. GEOMETRY: Max(D-Value, Rotor) = TLOF. 1.5D = FATO. Safety Area = 0.25D.
 * ============================================================================
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppSidebar from "@/components/AppSidebar";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import DataReadout from "@/components/DataReadout";
import WarningBanner from "@/components/WarningBanner";
import FileUploadZone from "@/components/FileUploadZone";
import DataReliabilityBadge from "@/components/DataReliabilityBadge";
import ChartContainer from "@/components/ChartContainer";
import AeroDataTable from "@/components/AeroDataTable";
import { AdvancedWindAnalysis } from "@/components/AdvancedWindAnalysis";
import { OrientationOptimizer } from "@/components/OrientationOptimizer";
import HelipadUsability, { type HelipadUsabilityResult } from "@/components/HelipadUsability";
import ApproachAdvisor, { type ApproachAnalysisResult } from "@/components/ApproachAdvisor";
import { AeroSelect, AeroInput } from "@/components/AeroInput";
import { helicopterDatabase, toFeet, toLbs, type HelicopterData } from "@/data/aircraftDatabase";
import { DISCLAIMER, HELIPORT_DISCLAIMER, DATA_LABELS } from "@/lib/engineeringSafety";
import { parseWindData, type ParsedWindData, type WindRecord } from "@/lib/windDataParser";
import { calculateWindRose, DEFAULT_WIND_ROSE_OPTIONS, type WindRoseResult } from "@/lib/windRoseCalculator";
import { optimizeRunwayOrientation } from "@/lib/windComponents";
import { renderExecutiveWindRose, renderEngineeringWindRose } from "@/lib/windRoseRenderer";
import { loadSampleDataAsFile, downloadSampleCSV, SAMPLE_PRESETS } from "@/lib/sampleDataGenerator";
import { exportCSV } from "@/lib/exportUtils";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { Wind, Download, Database, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import DataSourcesModule from "@/components/DataSourcesModule";

type UnitMode = "metric" | "imperial";

const TABS = [
  { id: "project", label: "Project Info" },
  { id: "heli", label: "Helicopter Selection" },
  { id: "wind", label: "Wind Data" },
  { id: "rose", label: "Wind Rose" },
  { id: "fato", label: "FATO Orientation" },
  { id: "approach", label: "Approach / Departure" },
  { id: "geometry", label: "Geometry Guidance" },
  { id: "report", label: "Heliport Report" },
] as const;

type TabId = typeof TABS[number]["id"];

const OLS_ROWS = [
  ["FATO Safety Area", "1:5", "1:10", "1:5"],
  ["Approach Surface (inner)", "1:12.5", "10%", "—"],
  ["Approach Surface (outer)", "1:40", "10%", "—"],
  ["Transitional Surface", "1:2", "—", "—"],
  ["Take-off Climb", "1:12.5", "15%", "—"],
  ["Conical Surface", "1:20", "35%", "—"],
];

const HeliportPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const tabIdx = TABS.findIndex((t) => t.id === activeTab);
  const goNext = () => setActiveTab(TABS[Math.min(tabIdx + 1, TABS.length - 1)].id);
  const goPrev = () => setActiveTab(TABS[Math.max(tabIdx - 1, 0)].id);

  const { heliportReportData, setHeliportReportData } = useAnalysis();

  const [projectName, setProjectName] = useState(heliportReportData?.projName || "");
  const [projectLoc, setProjectLoc] = useState(heliportReportData?.projectLoc || "");
  const [elevation, setElevation] = useState(heliportReportData?.elevation || "60");
  const [perfClass, setPerfClass] = useState(heliportReportData?.perfClass || "1");
  const [heliType, setHeliType] = useState(heliportReportData?.heliType || "surface");
  const [notes, setNotes] = useState(heliportReportData?.notes || "");

  const [parsedData, setParsedData] = useState<ParsedWindData | null>(heliportReportData?.windData || null);
  const [windLoading, setWindLoading] = useState(false);
  const [windError, setWindError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [calmThreshold, setCalmThreshold] = useState("3");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sectorType, setSectorType] = useState("22.5");
  const [useGust, setUseGust] = useState(false);

  const [roseStyle, setRoseStyle] = useState<"executive" | "engineering">("executive");
  const svgRef = useRef<HTMLDivElement>(null);

  const [selectedHeli, setSelectedHeli] = useState(heliportReportData?.selectedHeli || "");
  const [planningCategory, setPlanningCategory] = useState(heliportReportData?.planningCategory || "");
  const [selectionMode, setSelectionMode] = useState<"specific" | "generic" | "">((heliportReportData?.selectionMode as any) || "specific");
  const [dValue, setDValue] = useState(heliportReportData?.dValue || "");
  const [rotorDia, setRotorDia] = useState(heliportReportData?.rotorDia || "");
  const [mtow, setMtow] = useState(heliportReportData?.mtow || "");
  const [units, setUnits] = useState<UnitMode>("metric");

  const isMetric = units === "metric";
  const lenUnit = isMetric ? "m" : "ft";
  const massUnit = isMetric ? "kg" : "lbs";

  const helicopter: HelicopterData | undefined =
    selectionMode === "specific" && selectedHeli
      ? helicopterDatabase.find((h) => h.icao === selectedHeli)
      : undefined;

  const dVal = helicopter ? (parseFloat(dValue) || helicopter.dValue_m) : (parseFloat(dValue) || 0);
  const rotor = helicopter ? (parseFloat(rotorDia) || helicopter.rotorDiameter_m) : (parseFloat(rotorDia) || 0);

  const heliSelected =
    (selectionMode === "specific" && !!selectedHeli) ||
    (selectionMode === "generic" && !!planningCategory);

  const fmtLen = (m: number) => isMetric ? m.toFixed(1) : toFeet(m).toFixed(1);
  const fmtMass = (kg: number) =>
    isMetric ? kg.toLocaleString() : toLbs(kg).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const heliXwLimit = useMemo<number | null>(() => {
    if (selectionMode === "specific") {
      if (!helicopter) return null;
      const kg = helicopter.mtow_kg;
      if (kg < 3000) return 10;
      if (kg < 9000) return 15;
      return 17;
    }
    if (selectionMode === "generic" && planningCategory) {
      return planningCategory === "light" ? 10
        : planningCategory === "medium" ? 15
          : planningCategory === "heavy" ? 17
            : null;
    }
    return null;
  }, [helicopter, selectionMode, planningCategory]);

  const tlof = Math.max(dVal, rotor);
  const fato = dVal * 1.5;
  const safetyArea = fato + 0.5 * dVal;

  const records = useMemo<WindRecord[]>(() => parsedData?.records ?? [], [parsedData]);

  const windRose = useMemo<WindRoseResult | null>(() => {
    if (!parsedData) return null;
    return calculateWindRose(parsedData.records, {
      ...DEFAULT_WIND_ROSE_OPTIONS,
      sectorSize: parseFloat(sectorType),
      calmThreshold: parseFloat(calmThreshold) || 3,
      useGust,
      monthFilter: monthFilter === "all" ? null : [parseInt(monthFilter)],
      seasonFilter: null,
    });
  }, [parsedData, sectorType, calmThreshold, useGust, monthFilter]);

  const svgString = useMemo(() => {
    if (!windRose) return "";
    const opts = {
      title: projectName ? `${projectName} — Wind Rose` : "Heliport Wind Rose",
      subtitle: `${windRose.totalObservations.toLocaleString()} observations | ICAO Annex 14 Vol II`,
    };
    return roseStyle === "engineering"
      ? renderEngineeringWindRose(windRose, opts)
      : renderExecutiveWindRose(windRose, opts);
  }, [windRose, roseStyle, projectName]);

  const prevailingWind = useMemo(() => {
    if (!windRose) return null;
    const max = windRose.bins.reduce((a, b) => a.totalFrequency > b.totalFrequency ? a : b);
    return { direction: max.label, center: max.directionCenter, freq: max.totalFrequency };
  }, [windRose]);

  // ── Unconditional Computations for Reports Center ──
  const fatoResult = useMemo<HelipadUsabilityResult | null>(() => {
    if (!records.length || heliXwLimit === null) return null;
    const opt = optimizeRunwayOrientation(records, heliXwLimit);
    return {
      optimalHeading: opt.bestHeading,
      usabilityPercent: opt.bestUsability,
      recommendedApproach: opt.bestHeading !== null ? (opt.bestHeading + 180) % 360 : null,
      prevailingWind: prevailingWind?.center ?? null
    };
  }, [records, heliXwLimit, prevailingWind]);

  const approachResult = useMemo<ApproachAnalysisResult | null>(() => {
    if (!windRose) return null;
    let sinSum = 0, cosSum = 0, totalWeight = 0;
    for (const bin of windRose.bins) {
      const rad = (bin.directionCenter * Math.PI) / 180;
      sinSum += bin.totalFrequency * Math.sin(rad);
      cosSum += bin.totalFrequency * Math.cos(rad);
      totalWeight += bin.totalFrequency;
    }
    if (totalWeight === 0) return null;

    let meanDir = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
    meanDir = ((meanDir % 360) + 360) % 360;

    const approachDir = (meanDir + 180) % 360;
    const rwHeading = meanDir <= 180 ? meanDir : meanDir - 180;
    const rwReciprocal = (rwHeading + 180) % 360;
    const rwyNum1 = Math.round(rwHeading / 10) || 36;
    const rwyNum2 = Math.round(rwReciprocal / 10) || 36;
    
    const sorted = [...windRose.bins].sort((a, b) => b.totalFrequency - a.totalFrequency);
    const secondary = sorted.length > 1 ? sorted[1] : null;

    let secondaryCrossAngle = null;
    if (secondary) {
      let diff = Math.abs(secondary.directionCenter - meanDir);
      if (diff > 180) diff = 360 - diff;
      secondaryCrossAngle = diff;
    }

    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const approachLabel = dirs[Math.round(((approachDir % 360 + 360) % 360) / 22.5) % 16];

    return {
      prevailingDir: meanDir,
      approachDir,
      approachLabel,
      rwyDesignator: `${String(rwyNum1).padStart(2, "0")}/${String(rwyNum2).padStart(2, "0")}`,
      secondaryDir: secondary?.directionCenter ?? null,
      secondaryCrossAngle,
    };
  }, [windRose]);

  const { setHeliportReportData: _set_unused } = useAnalysis();
  useEffect(() => {
    setHeliportReportData({
      projName: projectName || projectLoc,
      projectLoc, elevation, perfClass, heliType, notes,
      windData: parsedData, windRose,
      fatoResult, approachResult,
      selectedHeli, planningCategory, selectionMode, dValue, rotorDia, mtow,
      helipad: { helicopter, dVal, rotor }
    });
  }, [
    projectName, projectLoc, elevation, perfClass, heliType, notes,
    parsedData, windRose, fatoResult, approachResult,
    selectedHeli, planningCategory, selectionMode, dValue, rotorDia, mtow,
    helicopter, dVal, rotor, setHeliportReportData
  ]);

  const bestUsabilityMsg = fatoResult?.usabilityPercent
    ? `Heliport achieves ${fatoResult.usabilityPercent.toFixed(1)}% wind usability.`
    : null;

  const tableRows = useMemo(() => {
    if (!windRose) return [];
    return windRose.bins.map((b) => [
      b.label,
      `${b.directionCenter}°`,
      `${b.totalFrequency.toFixed(2)}%`,
      b.speedBins.reduce((s, sp) => s + sp.count, 0).toString(),
    ]);
  }, [windRose]);



  const handleFile = useCallback(async (file: File) => {
    setWindLoading(true);
    setWindError(null);
    try {
      const data = await parseWindData(file);
      setParsedData(data);
    } catch (err: any) {
      setWindError(err.message ?? "Failed to parse file");
    } finally {
      setWindLoading(false);
    }
  }, []);

  const handleLoadSample = useCallback(async (i: number) => {
    const preset = SAMPLE_PRESETS[i];
    if (!preset) return;
    setShowSamples(false);
    await handleFile(loadSampleDataAsFile(preset.config));
  }, [handleFile]);

  const hdg = (deg: number) =>
    String(Math.round(((deg % 360) + 360) % 360 || 360)).padStart(3, "0");

  const handleExportCSV = () => {
    if (!windRose) return;
    exportCSV("heliport_wind_rose.csv",
      ["Direction", "Center (°)", "Frequency (%)", "Observations"],
      tableRows
    );
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader
          title="Heliport Design"
          subtitle="ICAO Annex 14 Volume II / GACAR — Engineering Planning"
        />

        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-warning/30 text-warning rounded-sm font-mono-data">
            {DATA_LABELS.planningMode}
          </span>
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/20 text-muted-foreground rounded-sm font-mono-data">
            ICAO Annex 14 Vol II
          </span>
          {projectName && (
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/30 text-primary rounded-sm font-mono-data">
              {projectName}
            </span>
          )}
        </div>

        {/* Tab Bar */}
        <div className="border border-border rounded-sm overflow-hidden mb-6">
          <div className="flex overflow-x-auto">
            {TABS.map((tab, i) => {
              const isActive = tab.id === activeTab;
              const isDone = i < tabIdx;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono-data whitespace-nowrap border-r border-border last:border-r-0 transition-colors ${isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    }`}
                >
                  {isDone && !isActive && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                  <span className="text-[9px] opacity-60 mr-0.5">{i + 1}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* TAB 1 — PROJECT INFO */}
            {activeTab === "project" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6 space-y-4">
                  <InstrumentCard title="Project Identification">
                    <div className="space-y-4">
                      <AeroInput label="Project Name" placeholder="Heliport Design — Site A" value={projectName} onChange={setProjectName} />
                      <AeroInput label="Location / Coordinates" placeholder="Riyadh, 24.7136° N, 46.6753° E" value={projectLoc} onChange={setProjectLoc} />
                      <AeroInput label="Site Elevation" placeholder="600" unit="M AMSL" value={elevation} onChange={setElevation} />
                      <AeroSelect label="Performance Class" value={perfClass} onChange={setPerfClass} options={[
                        { value: "1", label: "Class 1 — Multi-engine, no forced landing" },
                        { value: "2", label: "Class 2 — Some exposure on T/O or Landing" },
                        { value: "3", label: "Class 3 — Single engine or smaller twin" },
                      ]} />
                      <AeroSelect label="Heliport Type" value={heliType} onChange={setHeliType} options={[
                        { value: "surface", label: "Surface-level Heliport" },
                        { value: "elevated", label: "Elevated Heliport" },
                        { value: "helideck", label: "Helideck (Offshore)" },
                        { value: "hospital", label: "Hospital Heliport" },
                      ]} />
                    </div>
                  </InstrumentCard>
                </div>

                <div className="col-span-12 lg:col-span-6 space-y-4">
                  <InstrumentCard title="Regulatory References">
                    <div className="space-y-2 text-[11px] font-mono-data text-muted-foreground">
                      {[
                        ["Primary Standard", "ICAO Annex 14 Volume II — Heliports"],
                        ["Local Regulation", "GACAR Part 138 — Heliport Operations"],
                        ["OLS Reference", "ICAO Doc 9261 — Heliport Manual"],
                        ["Performance", "ICAO Doc 9157 — Aerodrome Design Manual"],
                        ["Tool Scope", DATA_LABELS.planningMode],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-border pb-1.5">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="text-foreground text-right max-w-[55%]">{v}</span>
                        </div>
                      ))}
                    </div>
                  </InstrumentCard>

                  <InstrumentCard title="Notes & Assumptions">
                    <textarea
                      className="aero-input w-full h-32 resize-none rounded-sm py-2"
                      placeholder="Enter project notes, assumptions, and special conditions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <p className="text-[9px] text-muted-foreground/60 mt-2">{DISCLAIMER}</p>
                  </InstrumentCard>
                </div>
              </div>
            )}

            {/* TAB 2 — WIND DATA */}
            {activeTab === "wind" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <DataSourcesModule
                    onFile={handleFile}
                    onDataAccepted={setParsedData}
                    parsedData={parsedData}
                    isLoading={windLoading}
                    error={windError}
                    onLoadSample={handleLoadSample}
                    samplePresets={SAMPLE_PRESETS}
                  />

                  <InstrumentCard title="Analysis Parameters">
                    <div className="space-y-4">
                      <AeroInput label="Calm Threshold" placeholder="3.0" unit="KTS" value={calmThreshold} onChange={setCalmThreshold} />
                      <AeroSelect label="Sector Size" value={sectorType} onChange={setSectorType} options={[
                        { value: "10", label: "10° (36 sectors)" },
                        { value: "15", label: "15° (24 sectors)" },
                        { value: "22.5", label: "22.5° (16 sectors)" },
                      ]} />
                      <AeroSelect label="Month Filter" value={monthFilter} onChange={setMonthFilter} options={[
                        { value: "all", label: "All Months" },
                        ...Array.from({ length: 12 }, (_, i) => ({
                          value: String(i + 1),
                          label: new Date(2000, i).toLocaleString("en", { month: "long" }),
                        })),
                      ]} />
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Gust Wind Mode</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">Use gust speed instead of mean speed for binning</p>
                        </div>
                        <button
                          aria-label={useGust ? "Disable gust wind mode" : "Enable gust wind mode"}
                          onClick={() => setUseGust(v => !v)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${useGust ? "bg-primary" : "bg-secondary border border-border"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useGust ? "translate-x-5" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                      {useGust && <p className="text-[9px] text-primary/70 font-mono-data">⚡ Gust mode active — wind rose uses peak gust speeds</p>}
                    </div>
                  </InstrumentCard>
                </div>

                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <WarningBanner message={HELIPORT_DISCLAIMER} />
                  {windRose ? (
                    <>
                      <InstrumentCard title="Wind Frequency by Direction">
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-sm transition-all"
                          >
                            <Download className="w-3 h-3" /> CSV
                          </button>
                        </div>
                        <AeroDataTable
                          columns={["Direction", "Center (°)", "Frequency (%)", "Observations"]}
                          rows={tableRows}
                        />
                      </InstrumentCard>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                          <p className="text-2xl font-display text-foreground">{windRose.calmFrequency.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Calm ({windRose.calmCount.toLocaleString()} obs)</p>
                        </div>
                        <div className="p-4 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                          <p className="text-2xl font-display text-foreground">{prevailingWind?.direction ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">Prevailing Direction</p>
                        </div>
                        <div className="p-4 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                          <p className="text-2xl font-display text-foreground">{windRose.totalObservations.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Total Observations</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 border border-border rounded-sm text-muted-foreground text-sm gap-2">
                      <Wind className="w-8 h-8 text-primary/30" />
                      <p>Upload wind data or load a sample to begin</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3 — WIND ROSE */}
            {activeTab === "rose" && (
              <div className="space-y-4">
                {!windRose ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                    <Wind className="w-10 h-10 text-primary/30" />
                    <p className="text-sm">No wind data loaded yet — go to <strong>Tab 2 Wind Data</strong> first</p>
                    <button onClick={() => setActiveTab("wind")} className="text-xs px-4 py-2 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                      Go to Wind Data →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex border border-border rounded-sm overflow-hidden ml-auto">
                        {(["executive", "engineering"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setRoseStyle(s)}
                            className={`px-3 py-1 text-[10px] font-mono-data capitalize transition-colors ${roseStyle === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ChartContainer title="Heliport Wind Rose — ICAO Annex 14 Vol II" className="min-h-[520px]">
                      <div ref={svgRef} className="w-full flex flex-col items-center" dangerouslySetInnerHTML={{ __html: svgString }} />
                    </ChartContainer>

                    <InstrumentCard title="Speed Distribution">
                      <AeroDataTable
                        columns={["Speed Range", "Count", "Frequency (%)"]}
                        rows={windRose.speedBinRanges.map((sr, i) => {
                          const count = windRose.bins.reduce((s, b) => s + b.speedBins[i].count, 0);
                          const freq = windRose.bins.reduce((s, b) => s + b.speedBins[i].frequency, 0);
                          return [sr.label, count.toString(), freq.toFixed(2) + "%"];
                        })}
                      />
                    </InstrumentCard>
                  </>
                )}
              </div>
            )}

            {/* TAB 4 — FATO ORIENTATION */}
            {activeTab === "fato" && (
              <div className="space-y-4">
                {!windRose || records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                    <Wind className="w-10 h-10 text-primary/30" />
                    <p className="text-sm">Wind data needed — go to <strong>Tab 2 Wind Data</strong> first</p>
                    <button onClick={() => setActiveTab("wind")} className="text-xs px-4 py-2 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                      Go to Wind Data →
                    </button>
                  </div>
                ) : (
                  <>
                    <WarningBanner message="FATO orientation is derived from wind usability analysis per ICAO Annex 14 Vol II §3.1.4. Crosswind limit per helicopter type." />

                    {prevailingWind && (
                      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-sm text-[11px] font-mono-data">
                        <span className="text-muted-foreground">From Wind Rose →</span>
                        <span className="text-foreground">Prevailing: <span className="text-primary">{prevailingWind.direction} ({prevailingWind.center}°)</span></span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground">Suggested FATO heading (into wind): <span className="text-primary">{hdg((prevailingWind.center + 180) % 360)}°</span></span>
                        {fatoResult?.optimalHeading != null && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-foreground">Optimal: <span className="text-primary">{hdg(fatoResult.optimalHeading)}° / {hdg((fatoResult.optimalHeading + 180) % 360)}°</span></span>
                            {fatoResult.usabilityPercent != null && (
                              <span className="ml-auto text-primary font-medium">{fatoResult.usabilityPercent.toFixed(1)}% usability</span>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {heliSelected ? (
                      <InstrumentCard title="Helicopter Crosswind Sensitivity">
                        <div className="grid grid-cols-2 gap-4 text-[11px] font-mono-data">
                          <div className="space-y-2">
                            {(selectionMode === "specific" && helicopter ? [
                              ["Mode", "Specific Helicopter"],
                              ["Design Helicopter", `${helicopter.manufacturer} ${helicopter.model}`],
                              ["ICAO", helicopter.icao],
                              ["MTOW", `${helicopter.mtow_kg.toLocaleString()} kg`],
                              ["Planning Crosswind Limit", heliXwLimit != null ? `${heliXwLimit} kt` : "—"],
                            ] : [
                              ["Mode", "Generic Planning Category"],
                              ["Category", planningCategory || "—"],
                              ["Planning Crosswind Limit", heliXwLimit != null ? `${heliXwLimit} kt` : "—"],
                            ]).map(([k, v]) => (
                              <div key={k} className="flex justify-between border-b border-border pb-1">
                                <span className="text-muted-foreground">{k}</span>
                                <span className={k === "Planning Crosswind Limit" ? "text-primary font-medium" : "text-foreground"}>{v}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Planning Notes</p>
                            {[
                              heliXwLimit != null ? `${heliXwLimit} kt crosswind limit applied (planning level).` : "Crosswind limit pending selection.",
                              "FATO heading should achieve ≥95% usability within this limit (ICAO Annex 14 Vol II §3.1.4).",
                              "Planning value only — operational limit defined in Flight Manual.",
                            ].map((note, i) => (
                              <p key={i} className="text-[9px] border-b border-border pb-1 text-muted-foreground">{note}</p>
                            ))}
                          </div>
                        </div>
                        {prevailingWind && heliXwLimit != null && (
                          <div className="mt-3 p-2 border border-border/50 bg-secondary/20 rounded-sm text-[9px] font-mono-data text-muted-foreground">
                            Prevailing crosswind (90° offset): approx.
                            <span className="text-primary font-medium"> {(prevailingWind.freq * 0.7071).toFixed(1)}%</span> of observations may exceed {heliXwLimit} kt at peak — verify with usability analysis.
                          </div>
                        )}
                      </InstrumentCard>
                    ) : (
                      <InstrumentCard title="Helicopter Crosswind Sensitivity">
                        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                          <p className="text-sm text-muted-foreground">No helicopter selected</p>
                          <p className="text-[10px] text-muted-foreground/60 font-mono-data">Helicopter-dependent calculations pending selection</p>
                          <button onClick={() => setActiveTab("heli")} className="mt-2 text-[10px] px-3 py-1.5 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                            Select in Tab 6 →
                          </button>
                        </div>
                      </InstrumentCard>
                    )}

                    <HelipadUsability 
                      records={records} 
                      windRose={windRose} 
                      globalCrosswindLimit={heliXwLimit}
                      globalHelicopterName={helicopter ? `${helicopter.manufacturer} ${helicopter.model}` : planningCategory ? `Category: ${planningCategory}` : null}
                      globalHelicopterIcao={helicopter?.icao}
                      globalRotorDiameter={rotor}
                      globalDValue={dVal}
                      globalMtow={helicopter?.mtow_kg}
                      onResult={() => {}} 
                    />
                  </>
                )}
              </div>
            )}

            {/* TAB 5 — APPROACH / DEPARTURE */}
            {activeTab === "approach" && (
              <div className="space-y-4">
                {!windRose ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-border rounded-sm text-muted-foreground gap-3">
                    <Wind className="w-10 h-10 text-primary/30" />
                    <p className="text-sm">Wind data needed — go to <strong>Tab 2 Wind Data</strong> first</p>
                    <button onClick={() => setActiveTab("wind")} className="text-xs px-4 py-2 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                      Go to Wind Data →
                    </button>
                  </div>
                ) : (
                  <>
                    <WarningBanner message="Approach / departure paths per ICAO Annex 14 Vol II §3.4. Obstacle limitation surfaces (OLS) must be assessed separately." />

                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-sm text-[11px] font-mono-data">
                      {fatoResult?.optimalHeading != null ? (
                        <>
                          <span className="text-muted-foreground">From FATO Orientation →</span>
                          <span className="text-foreground">Selected FATO: <span className="text-primary">{hdg(fatoResult.optimalHeading)}° / {hdg((fatoResult.optimalHeading + 180) % 360)}°</span></span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-foreground">Primary approach (into wind): <span className="text-primary">{hdg(fatoResult.recommendedApproach ?? (fatoResult.optimalHeading + 180) % 360)}°</span></span>
                        </>
                      ) : prevailingWind ? (
                        <>
                          <span className="text-muted-foreground">From Wind Rose →</span>
                          <span className="text-foreground">Prevailing: <span className="text-primary">{prevailingWind.direction} ({prevailingWind.center}°)</span></span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-foreground">Recommended approach: <span className="text-primary">{hdg((prevailingWind.center + 180) % 360)}°</span></span>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Run FATO Orientation (Tab 4) to pre-fill approach sectors</span>
                      )}
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 lg:col-span-8">
                        <ApproachAdvisor windRose={windRose} mode="heliport" />
                      </div>
                      <div className="col-span-12 lg:col-span-4">
                        <InstrumentCard title="ICAO Approach Guidance Notes">
                          <div className="space-y-2 text-[11px] font-mono-data text-muted-foreground">
                            {[
                              "Preferred approach is INTO the prevailing wind.",
                              "Helicopter performance class governs climb gradient requirements.",
                              "Minimum 2 approach/departure paths recommended where possible.",
                              "Obstacle clearance: 152 m (500 ft) either side of approach path.",
                              "Class 1: clears all obstacles, continued safe flight after engine failure.",
                              "OLS slope inward surface: 1:12.5 (Class 1), 1:10 (Class 2/3).",
                            ].map((note, i) => (
                              <p key={i} className="border-b border-border pb-1.5">
                                <span className="text-primary mr-1.5">{i + 1}.</span>{note}
                              </p>
                            ))}
                          </div>
                        </InstrumentCard>
                      </div>
                    </div>

                    <div className="mt-8 space-y-8">
                      <OrientationOptimizer 
                        records={parsedData?.records || []} 
                        limit={perfClass === "1" ? 17 : perfClass === "2" ? 15 : perfClass === "3" ? 10 : 15} 
                        mode="heliport" 
                      />
                      <AdvancedWindAnalysis 
                        windRose={windRose || null} 
                        records={parsedData?.records || []} 
                        orientation={fatoResult?.optimalHeading ?? null} 
                        cwLimit={perfClass === "1" ? 17 : perfClass === "2" ? 15 : perfClass === "3" ? 10 : 15} 
                        mode="heliport" 
                        fileNamePrefix="heliport" 
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 6 — HELICOPTER SELECTION */}
            {activeTab === "heli" && (
              <div className="grid grid-cols-12 gap-4">
                {/* Units toggle */}
                <div className="col-span-12 flex justify-end">
                  <div className="flex border border-border rounded-sm overflow-hidden">
                    <button
                      onClick={() => setUnits("metric")}
                      className={`px-3 py-1 text-[10px] font-mono-data transition-colors ${isMetric ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Metric (m)
                    </button>
                    <button
                      onClick={() => setUnits("imperial")}
                      className={`px-3 py-1 text-[10px] font-mono-data transition-colors ${!isMetric ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Imperial (ft)
                    </button>
                  </div>
                </div>

                {/* Left column */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <InstrumentCard title="Design Helicopter Basis">
                    {/* Mode toggle */}
                    <div className="flex border border-border rounded-sm overflow-hidden mb-4">
                      <button
                        onClick={() => { setSelectionMode("specific"); setPlanningCategory(""); }}
                        className={`flex-1 py-1.5 text-[10px] font-mono-data transition-colors ${selectionMode === "specific" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Specific Helicopter
                      </button>
                      <button
                        onClick={() => { setSelectionMode("generic"); setSelectedHeli(""); }}
                        className={`flex-1 py-1.5 text-[10px] font-mono-data transition-colors ${selectionMode === "generic" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Planning Category
                      </button>
                    </div>

                    {/* Specific mode */}
                    {selectionMode === "specific" && (
                      <div className="space-y-4">
                        <AeroSelect
                          label="Reference Helicopter"
                          value={selectedHeli}
                          onChange={(v) => {
                            setSelectedHeli(v);
                            setDValue("");
                            setRotorDia("");
                            setMtow("");
                          }}
                          options={[
                            { value: "", label: "— Select helicopter —" },
                            ...helicopterDatabase.map((h) => ({
                              value: h.icao,
                              label: `${h.manufacturer} ${h.model}`,
                            })),
                          ]}
                        />
                        {!selectedHeli && (
                          <p className="text-[10px] text-warning font-mono-data">
                            ⚠ No helicopter selected — helicopter-dependent calculations pending selection
                          </p>
                        )}
                      </div>
                    )}

                    {/* Generic mode */}
                    {selectionMode === "generic" && (
                      <div className="space-y-4">
                        <AeroSelect
                          label="Planning Category (ICAO Annex 14 Vol II)"
                          value={planningCategory}
                          onChange={setPlanningCategory}
                          options={[
                            { value: "", label: "— Select category —" },
                            { value: "light", label: "Light (< 3 t MTOW) — 10 kt crosswind" },
                            { value: "medium", label: "Medium (3–9 t MTOW) — 15 kt crosswind" },
                            { value: "heavy", label: "Heavy (> 9 t MTOW) — 17 kt crosswind" },
                          ]}
                        />
                        {!planningCategory && (
                          <p className="text-[10px] text-warning font-mono-data">
                            ⚠ No category selected — helicopter-dependent calculations pending selection
                          </p>
                        )}
                      </div>
                    )}

                    {/* Override inputs */}
                    {heliSelected && (
                      <div className="mt-4 pt-3 border-t border-border space-y-3">
                        <AeroInput
                          label="D-Value Override"
                          placeholder={helicopter?.dValue_m ? helicopter.dValue_m.toFixed(1) : "—"}
                          unit={lenUnit.toUpperCase()}
                          value={dValue}
                          onChange={setDValue}
                        />
                        <AeroInput
                          label="Rotor Diameter Override"
                          placeholder={helicopter?.rotorDiameter_m ? helicopter.rotorDiameter_m.toFixed(1) : "—"}
                          unit={lenUnit.toUpperCase()}
                          value={rotorDia}
                          onChange={setRotorDia}
                        />
                        <AeroInput
                          label="MTOW"
                          placeholder={helicopter?.mtow_kg ? helicopter.mtow_kg.toLocaleString() : "—"}
                          unit={massUnit.toUpperCase()}
                          value={mtow}
                          onChange={setMtow}
                        />
                      </div>
                    )}
                  </InstrumentCard>

                  <InstrumentCard title="Heliport Classification (ICAO Annex 14 Vol II)">
                    <AeroDataTable
                      columns={["Class", "D-Value Range", "Typical Aircraft", "FATO Min"]}
                      rows={[
                        ["1H", "< 15 m", "Light singles (R44, AS350)", "≥ D-value"],
                        ["2H", "15–24 m", "Medium twins (BK117, AW139)", "≥ D-value × 1.5"],
                        ["3H", "> 24 m", "Heavy (S92, CH-47)", "≥ D-value × 1.5"],
                      ]}
                    />
                    <p className="text-[9px] text-muted-foreground/60 mt-2 italic">
                      Classification determines lighting, marking, and rescue requirements (GACAR Part 138).
                    </p>
                  </InstrumentCard>
                </div>

                {/* Right column */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  {/* Helicopter reference data — specific mode only */}
                  {helicopter && (
                    <InstrumentCard title="Design Helicopter — Reference Data">
                      <div className="grid grid-cols-2 gap-4 text-[11px] font-mono-data">
                        <div className="space-y-2">
                          {[
                            ["Model", `${helicopter.manufacturer} ${helicopter.model}`],
                            ["ICAO", helicopter.icao],
                            ["D-Value", `${fmtLen(helicopter.dValue_m)} ${lenUnit}`],
                            ["Category", helicopter.category],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span className={k === "ICAO" ? "text-primary" : "text-foreground capitalize"}>{v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {[
                            ["Rotor Ø", `${fmtLen(helicopter.rotorDiameter_m)} ${lenUnit}`],
                            ["MTOW", `${fmtMass(helicopter.mtow_kg)} ${massUnit}`],
                            ["Typical Use", helicopter.typicalUse],
                            ["Heliport Relevance", helicopter.heliportRelevance],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="text-foreground capitalize">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-[9px] text-muted-foreground/50 mt-3 pt-2 border-t border-border">
                        {DATA_LABELS.referenceMode}
                      </div>
                    </InstrumentCard>
                  )}

                  {/* Crosswind planning summary */}
                  {heliSelected && heliXwLimit != null && (
                    <InstrumentCard title="Crosswind Planning Summary">
                      <div className="grid grid-cols-2 gap-4 text-[11px] font-mono-data">
                        <div className="space-y-2">
                          {(selectionMode === "specific" && helicopter ? [
                            ["Selection Mode", "Specific Helicopter"],
                            ["Model", `${helicopter.manufacturer} ${helicopter.model}`],
                            ["MTOW", `${fmtMass(helicopter.mtow_kg)} ${massUnit}`],
                          ] : [
                            ["Selection Mode", "Generic Planning Category"],
                            ["Category", planningCategory],
                          ]).map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="text-foreground capitalize">{v}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">Planning Crosswind Limit</span>
                            <span className="text-primary font-medium">{heliXwLimit} kt</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Planning Notes</p>
                          {[
                            `${heliXwLimit} kt crosswind limit applied (planning level).`,
                            "FATO heading should achieve ≥95% usability within this limit (ICAO Annex 14 Vol II §3.1.4).",
                            "Planning value only — operational limit defined in Flight Manual.",
                          ].map((note, i) => (
                            <p key={i} className="text-[9px] border-b border-border pb-1 text-muted-foreground">{note}</p>
                          ))}
                        </div>
                      </div>
                    </InstrumentCard>
                  )}

                  {/* Empty state */}
                  {!heliSelected && (
                    <div className="flex flex-col items-center justify-center h-48 border border-border rounded-sm text-muted-foreground gap-2 text-center px-6">
                      <p className="text-sm">Select a helicopter or planning category to populate reference data</p>
                      <p className="text-[10px] font-mono-data text-muted-foreground/60">
                        TLOF, FATO, safety area, and crosswind limit calculations will auto-populate once a selection is made
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 7 — GEOMETRY GUIDANCE */}
            {activeTab === "geometry" && (
              <div className="space-y-4">
                <WarningBanner message={HELIPORT_DISCLAIMER} />

                {dVal === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 border border-border rounded-sm text-muted-foreground gap-3">
                    <p className="text-sm">No helicopter selected — go to <strong>Tab 6 Helicopter</strong> first</p>
                    <button onClick={() => setActiveTab("heli")} className="text-xs px-4 py-2 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-all">
                      Go to Helicopter →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <DataReadout value={fmtLen(tlof)} unit={lenUnit.toUpperCase()} label="TLOF Dimension" />
                      <DataReadout value={fmtLen(fato)} unit={lenUnit.toUpperCase()} label="FATO Dimension" />
                      <DataReadout value={fmtLen(safetyArea)} unit={lenUnit.toUpperCase()} label="Safety Area" />
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 lg:col-span-6 space-y-4">
                        <InstrumentCard title="Dimension Derivation">
                          <div className="space-y-3 text-xs font-mono-data">
                            {[
                              ["TLOF", `max(D, Rotor Ø) = max(${fmtLen(dVal)}, ${fmtLen(rotor)}) = ${fmtLen(tlof)} ${lenUnit}`, "Touchdown & Lift-Off area"],
                              ["FATO", `1.5 × D = 1.5 × ${fmtLen(dVal)} = ${fmtLen(fato)} ${lenUnit}`, "Final Approach & Take-Off area"],
                              ["Safety Area", `FATO + 2 × (0.25 D) = ${fmtLen(fato)} + ${fmtLen(0.5 * dVal)} = ${fmtLen(safetyArea)} ${lenUnit}`, "Extends 0.25 D from FATO edge"],
                            ].map(([name, formula, desc]) => (
                              <div key={name as string} className="border-b border-border pb-2">
                                <p className="text-primary">{name as string}</p>
                                <p className="text-foreground mt-0.5">{formula as string}</p>
                                <p className="text-muted-foreground text-[10px]">{desc as string}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-muted-foreground/60 mt-3 italic">
                            Per ICAO Annex 14 Vol II §3.1 — §3.3
                          </p>
                        </InstrumentCard>

                        <InstrumentCard title="Marking Requirements (ICAO §5)">
                          <div className="space-y-1.5 text-[11px] font-mono-data text-muted-foreground">
                            {[
                              "TLOF marking: white circle or square, 0.3 m stroke",
                              "FATO boundary: white dashed line, 0.3 m wide",
                              "Heliport identification: H marking, 3 m height",
                              "TLOF perimeter light: yellow, 2 m spacing",
                              "Aiming point: at centre of TLOF",
                            ].map((s, i) => <p key={i} className="border-b border-border pb-1">▸ {s}</p>)}
                          </div>
                        </InstrumentCard>
                      </div>

                      <div className="col-span-12 lg:col-span-6">
                        <InstrumentCard title="Obstacle Limitation Surfaces — ICAO Annex 14 Vol II §4">
                          <AeroDataTable
                            columns={["Surface", "Slope", "Width/Half-width", "Clearway"]}
                            rows={OLS_ROWS}
                          />
                          <p className="text-[9px] text-muted-foreground/60 mt-3 italic">
                            Planning reference only. Detailed OLS assessment per ICAO Doc 9261 required.
                          </p>
                        </InstrumentCard>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 8 — HELIPORT REPORT */}
            {activeTab === "report" && (
              <div className="space-y-4">
                <WarningBanner message={HELIPORT_DISCLAIMER} />

                <InstrumentCard title="Heliport Design Summary Report">
                  <div className="space-y-6 text-xs font-mono-data">

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Project Identification</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                        {[
                          ["Project", projectName || "—"],
                          ["Location", projectLoc || "—"],
                          ["Elevation", elevation ? `${elevation} m AMSL` : "—"],
                          ["Performance Class", `Class ${perfClass}`],
                          ["Heliport Type", heliType],
                          ["Regulatory Basis", "ICAO Annex 14 Vol II / GACAR Part 138"],
                        ].map(([k, v]) => (
                          <div key={k as string} className="flex justify-between border-b border-border pb-1">
                            <span className="text-muted-foreground">{k as string}</span>
                            <span className="text-foreground capitalize">{v as string}</span>
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
                            ["Dataset Type", parsedData.datasetType],
                            ["Date Range", parsedData.dateRange ? `${parsedData.dateRange.start} → ${parsedData.dateRange.end}` : "—"],
                            ["Prevailing Wind", prevailingWind ? `${prevailingWind.direction} (${prevailingWind.center}°) — ${prevailingWind.freq.toFixed(1)}%` : "—"],
                            ["Calm Frequency", windRose ? `${windRose.calmFrequency.toFixed(1)}% (${windRose.calmCount.toLocaleString()} obs)` : "—"],
                          ].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k as string}</span>
                              <span className="text-foreground">{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No wind data loaded — see Tab 2.</p>
                      )}
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">FATO Orientation Analysis</p>
                      {fatoResult?.optimalHeading != null ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {[
                            ["Optimal FATO Heading", `${hdg(fatoResult.optimalHeading)}° / ${hdg((fatoResult.optimalHeading + 180) % 360)}°`],
                            ["Wind Usability", fatoResult.usabilityPercent != null ? `${fatoResult.usabilityPercent.toFixed(2)}%` : "—"],
                            ["ICAO 95% Threshold", fatoResult.usabilityPercent != null ? (fatoResult.usabilityPercent >= 95 ? "✓ PASS" : "✗ BELOW 95%") : "—"],
                            ["Prevailing Wind", fatoResult.prevailingWind != null ? `${hdg(fatoResult.prevailingWind)}°` : "—"],
                          ].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k as string}</span>
                              <span className={`${(v as string).includes("PASS") ? "text-emerald-400" : (v as string).includes("BELOW") ? "text-warning" : "text-foreground"}`}>{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Run FATO orientation analysis (Tab 4) to populate this section.</p>
                      )}
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Approach / Departure</p>
                      {approachResult ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {[
                            ["Prevailing Wind Dir", `${hdg(approachResult.prevailingDir)}° (${approachResult.approachLabel})`],
                            ["Primary Approach", `${hdg(approachResult.approachDir)}° (into prevailing wind)`],
                            ["Secondary Wind Dir", approachResult.secondaryDir != null ? `${hdg(approachResult.secondaryDir)}°` : "—"],
                            ["Cross-angle to Primary", approachResult.secondaryCrossAngle != null ? `${approachResult.secondaryCrossAngle.toFixed(0)}°${approachResult.secondaryCrossAngle > 60 ? " — omnidirectional FATO advised" : ""}` : "—"],
                            ["OLS Reference", "ICAO Annex 14 Vol II §3.4"],
                          ].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k as string}</span>
                              <span className="text-foreground">{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">View Approach / Departure tab (Tab 5) to auto-populate this section.</p>
                      )}
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Design Helicopter</p>
                      {heliSelected ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {(selectionMode === "specific" && helicopter ? [
                            ["Selection Mode", "Specific Helicopter"],
                            ["Model", `${helicopter.manufacturer} ${helicopter.model}`],
                            ["ICAO", helicopter.icao],
                            ["D-Value", `${fmtLen(dVal)} ${lenUnit}`],
                            ["Rotor Ø", `${fmtLen(rotor)} ${lenUnit}`],
                            ["MTOW", `${fmtMass(helicopter.mtow_kg)} ${massUnit}`],
                            ["Planning Crosswind Limit", heliXwLimit != null ? `${heliXwLimit} kt` : "—"],
                          ] : [
                            ["Selection Mode", "Generic Planning Category"],
                            ["Category", planningCategory || "—"],
                            ["Planning Crosswind Limit", heliXwLimit != null ? `${heliXwLimit} kt` : "—"],
                            ["D-Value", dVal > 0 ? `${fmtLen(dVal)} ${lenUnit}` : "Not entered"],
                            ["Rotor Ø", rotor > 0 ? `${fmtLen(rotor)} ${lenUnit}` : "Not entered"],
                          ]).map(([k, v]) => (
                            <div key={k as string} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k as string}</span>
                              <span className={k === "Planning Crosswind Limit" ? "text-primary" : "text-foreground capitalize"}>{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-warning font-mono-data text-[10px]">⚠ No helicopter selected — helicopter-dependent calculations pending. See Tab 6.</p>
                      )}
                    </section>

                    <section>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-primary mb-2 border-b border-border pb-1">Derived Dimensions</p>
                      {dVal > 0 ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                          {[
                            ["TLOF", `${fmtLen(tlof)} ${lenUnit}`],
                            ["FATO", `${fmtLen(fato)} ${lenUnit}`],
                            ["Safety Area", `${fmtLen(safetyArea)} ${lenUnit}`],
                            ["OLS Basis", "ICAO Annex 14 Vol II §4"],
                          ].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between border-b border-border pb-1">
                              <span className="text-muted-foreground">{k as string}</span>
                              <span className="text-foreground">{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No helicopter selected — see Tab 6.</p>
                      )}
                    </section>

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

        {/* Prev / Next navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
          <button
            onClick={goPrev}
            disabled={tabIdx === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border text-muted-foreground rounded-sm hover:text-foreground hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {tabIdx > 0 ? TABS[tabIdx - 1].label : "Back"}
          </button>

          <span className="text-[10px] font-mono-data text-muted-foreground">
            Step {tabIdx + 1} of {TABS.length}
          </span>

          <button
            onClick={goNext}
            disabled={tabIdx === TABS.length - 1}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {tabIdx < TABS.length - 1 ? TABS[tabIdx + 1].label : "Done"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default HeliportPage;