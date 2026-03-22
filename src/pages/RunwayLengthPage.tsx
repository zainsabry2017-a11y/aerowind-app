import { useState, useMemo, useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import DataReadout from "@/components/DataReadout";
import SafetyWarnings from "@/components/SafetyWarnings";
import WarningBanner from "@/components/WarningBanner";
import { AeroInput, AeroSelect } from "@/components/AeroInput";
import { calculateRunwayLength, type RunwayLengthInputs } from "@/lib/runwayLength";
import { generateSafetyWarnings, DATA_LABELS, PLANNING_DISCLAIMER } from "@/lib/engineeringSafety";
import { exportCSV, exportXLSX } from "@/lib/exportUtils";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { Download, FileSpreadsheet } from "lucide-react";

const BREAKDOWN_COLORS = ["bg-primary", "bg-primary/70", "bg-warning", "bg-warning/70", "bg-destructive/60", "bg-primary/50", "bg-warning/50"];

const RunwayLengthPage = () => {
  const analysis = useAnalysis();
  const [baseLength, setBaseLength] = useState("1800");
  const [elevation, setElevation] = useState("400");
  const [temperature, setTemperature] = useState("40");
  const [gradient, setGradient] = useState("1.0");
  const [surface, setSurface] = useState("paved");
  const [headwind, setHeadwind] = useState("0");
  const [tailwind, setTailwind] = useState("0");
  const [wetRunway, setWetRunway] = useState("no");

  const inputs: RunwayLengthInputs = {
    baseLength: parseFloat(baseLength) || 0,
    airportElevation: parseFloat(elevation) || 0,
    referenceTemperature: parseFloat(temperature) || 15,
    effectiveGradient: parseFloat(gradient) || 0,
    surfaceCondition: surface as "paved" | "turf" | "gravel",
    headwindComponent: parseFloat(headwind) || 0,
    tailwindComponent: parseFloat(tailwind) || 0,
    wetRunway: wetRunway === "yes",
  };

  const result = useMemo(() => calculateRunwayLength(inputs), [baseLength, elevation, temperature, gradient, surface, headwind, tailwind, wetRunway]);

  // Sync to shared context
  useEffect(() => {
    analysis.setRunwayLength(result, {
      baseLength: inputs.baseLength,
      elevation: inputs.airportElevation,
      temperature: inputs.referenceTemperature,
      gradient: inputs.effectiveGradient,
      surface: inputs.surfaceCondition,
    });
  }, [result]);

  const warnings = useMemo(() => generateSafetyWarnings(null, { hasElevation: !!elevation, hasTemperature: !!temperature }), [elevation, temperature]);

  const totalBarLength = result.breakdown.reduce((s, b) => s + Math.abs(b.addedLength), 0) + result.baseLength;

  const exportRows = [["Base Length", "1.000", result.baseLength.toString(), "Uncorrected base length"], ...result.breakdown.map(b => [b.label, b.factor.toFixed(3), Math.round(b.addedLength).toString(), b.description])];

  const handleExport = () => {
    exportCSV("runway_length_correction.csv",
      ["Factor", "Multiplier", "Added (m)", "Description"],
      exportRows
    );
  };

  const handleExportXLSX = () => {
    exportXLSX("runway_length_correction.xlsx",
      ["Factor", "Multiplier", "Added (m)", "Description"],
      exportRows
    );
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader
          title="Runway Length Correction"
          subtitle="ICAO Doc 9157 — Planning-Level Corrections"
          action={
            <div className="flex gap-2">
              <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-sm transition-all"><Download className="w-4 h-4" /> CSV</button>
              <button onClick={handleExportXLSX} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm transition-all"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
            </div>
          }
        />

        <div className="mb-3 flex items-center gap-3">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-warning/30 text-warning rounded-sm font-mono-data">{DATA_LABELS.planningMode}</span>
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/20 text-muted-foreground rounded-sm font-mono-data">ICAO Doc 9157</span>
        </div>

        {warnings.length > 0 && <div className="mb-4"><SafetyWarnings warnings={warnings} /></div>}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <InstrumentCard title="Airport Parameters">
              <div className="space-y-4">
                <AeroInput label="Base Runway Length" placeholder="1800" unit="M" value={baseLength} onChange={setBaseLength} />
                <AeroInput label="Aerodrome Elevation" placeholder="400" unit="M AMSL" value={elevation} onChange={setElevation} />
                <AeroInput label="Reference Temperature" placeholder="40" unit="°C" value={temperature} onChange={setTemperature} />
                <AeroInput label="Effective Gradient" placeholder="1.0" unit="%" value={gradient} onChange={setGradient} />
                <AeroSelect label="Surface Condition" value={surface} onChange={setSurface} options={[
                  { value: "paved", label: "Paved" },
                  { value: "turf", label: "Turf" },
                  { value: "gravel", label: "Gravel" },
                ]} />
                <AeroInput label="Headwind Component" placeholder="0" unit="KTS" value={headwind} onChange={setHeadwind} />
                <AeroInput label="Tailwind Component" placeholder="0" unit="KTS" value={tailwind} onChange={setTailwind} />
                <AeroSelect label="Wet Runway" value={wetRunway} onChange={setWetRunway} options={[
                  { value: "no", label: "Dry" },
                  { value: "yes", label: "Wet" },
                ]} />
              </div>
            </InstrumentCard>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DataReadout value={result.correctedLength.toLocaleString()} unit="M" label="Corrected Length" />
              <DataReadout value={result.totalMultiplier.toFixed(3)} unit="×" label="Total Multiplier" />
              <DataReadout value={(result.correctedLength - result.baseLength).toLocaleString()} unit="M" label="Total Adjustment" />
            </div>

            {result.warnings.map((w, i) => <WarningBanner key={i} message={w} />)}

            <InstrumentCard title="Length Correction Breakdown">
              <div className="space-y-4">
                <div className="flex h-10 rounded-sm overflow-hidden border border-border">
                  <div className="bg-secondary flex items-center justify-center" style={{ width: `${(result.baseLength / totalBarLength) * 100}%` }}>
                    <span className="text-[9px] font-mono-data text-foreground truncate px-1">Base</span>
                  </div>
                  {result.breakdown.map((item, i) => {
                    const w = Math.abs(item.addedLength) / totalBarLength * 100;
                    if (w < 0.5) return null;
                    return (
                      <div key={i} className={`${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} flex items-center justify-center`} style={{ width: `${w}%` }}>
                        <span className="text-[8px] font-mono-data text-primary-foreground truncate px-0.5">{item.addedLength > 0 ? "+" : ""}{Math.round(item.addedLength)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-xs text-muted-foreground">Base Length</span>
                    <span className="text-sm font-mono-data text-foreground">{result.baseLength.toLocaleString()} M</span>
                  </div>
                  {result.breakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-sm ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`} />
                        <div>
                          <p className="text-xs text-foreground">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono-data text-foreground">{item.addedLength > 0 ? "+" : ""}{Math.round(item.addedLength).toLocaleString()} M</p>
                        <p className="text-[10px] font-mono-data text-muted-foreground">×{item.factor.toFixed(3)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t-2 border-primary/30 flex justify-between items-center">
                  <span className="text-sm text-foreground font-medium">Corrected Length</span>
                  <span className="text-3xl font-display text-foreground">{result.correctedLength.toLocaleString()}<span className="text-sm font-mono-data text-muted-foreground ml-2">M</span></span>
                </div>
              </div>
            </InstrumentCard>

            <div className="text-[10px] text-muted-foreground/50 p-4 border border-border/30 rounded-sm font-mono-data">{PLANNING_DISCLAIMER}</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RunwayLengthPage;
