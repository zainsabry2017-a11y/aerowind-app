import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import InstrumentCard from "@/components/InstrumentCard";
import AeroDataTable from "@/components/AeroDataTable";
import DataReadout from "@/components/DataReadout";
import { AeroInput, AeroSelect } from "@/components/AeroInput";
import { helicopterDatabase, type HelicopterData } from "@/data/aircraftDatabase";
import { calculateRunwayUsability, optimizeRunwayOrientation, type RunwayUsabilityResult } from "@/lib/windComponents";
import { useAnalysis } from "@/contexts/AnalysisContext";
import type { WindRoseResult } from "@/lib/windRoseCalculator";
import type { WindRecord } from "@/lib/windDataParser";

export interface HelipadUsabilityResult {
  optimalHeading: number | null;
  usabilityPercent: number | null;
  recommendedApproach: number | null;
  prevailingWind: number | null;
}

interface HelipadUsabilityProps {
  records: WindRecord[];
  windRose: WindRoseResult;
  globalCrosswindLimit: number | null;
  globalHelicopterName: string | null;
  globalHelicopterIcao?: string;
  globalRotorDiameter?: number;
  globalDValue?: number;
  globalMtow?: number;
  /** Optional — called whenever the best FATO heading or usability changes */
  onResult?: (result: HelipadUsabilityResult) => void;
}

function formatHdg(deg: number): string {
  const d = ((deg % 360) + 360) % 360 || 360;
  return String(Math.round(d)).padStart(3, "0");
}

const HelipadUsability = ({ records, windRose, globalCrosswindLimit, globalHelicopterName, globalHelicopterIcao, globalRotorDiameter, globalDValue, globalMtow, onResult }: HelipadUsabilityProps) => {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const analysis = useAnalysis();
  
  const [helipadHdg, setHelipadHdg] = useState("");
  const [useCustomLimit, setUseCustomLimit] = useState(false);
  const [customLimit, setCustomLimit] = useState("");
  const [candidates, setCandidates] = useState<RunwayUsabilityResult[]>([]);
  const [showOptimal, setShowOptimal] = useState(false);

  const effectiveLimit = useCustomLimit ? (parseFloat(customLimit) || 15) : (globalCrosswindLimit || 15);

  // Prevailing wind vector mean
  const prevailing = useMemo(() => {
    let sinSum = 0, cosSum = 0, totalW = 0;
    for (const bin of windRose.bins) {
      const rad = (bin.directionCenter * Math.PI) / 180;
      sinSum += bin.totalFrequency * Math.sin(rad);
      cosSum += bin.totalFrequency * Math.cos(rad);
      totalW += bin.totalFrequency;
    }
    if (totalW === 0) return 0;
    return (((Math.atan2(sinSum, cosSum) * 180) / Math.PI) % 360 + 360) % 360;
  }, [windRose]);

  const effectiveHdg = helipadHdg ? parseInt(helipadHdg) : Math.round((prevailing + 180) % 360) || 360;

  const addCandidate = useCallback(() => {
    const h = effectiveHdg;
    if (isNaN(h) || h < 1 || h > 360) return;
    const result = calculateRunwayUsability(records, h, effectiveLimit);
    setCandidates((prev) => [...prev.filter((c) => c.runwayHeading !== h), result]);
    if (!helipadHdg) setHelipadHdg(String(h));
  }, [records, effectiveHdg, effectiveLimit, helipadHdg]);

  const optimization = useMemo(() => {
    if (!showOptimal) return null;
    return optimizeRunwayOrientation(records, effectiveLimit);
  }, [records, effectiveLimit, showOptimal]);

  const bestCandidate = candidates.length > 0
    ? candidates.reduce((a, b) => (a.usabilityPercent > b.usabilityPercent ? a : b))
    : null;

  // Surface result to parent (HeliportPage) via callback
  useEffect(() => {
    const heading    = optimization?.bestHeading    ?? bestCandidate?.runwayHeading   ?? null;
    const usability  = optimization?.bestUsability  ?? bestCandidate?.usabilityPercent ?? null;
    const approach   = heading !== null ? (heading + 180) % 360 : null;
    onResultRef.current?.({ optimalHeading: heading, usabilityPercent: usability, recommendedApproach: approach, prevailingWind: prevailing });
  }, [optimization, bestCandidate, prevailing]);

  // Sync helipad data to shared context
  useEffect(() => {
    analysis.setHelipad({
      helicopterModel: globalHelicopterName ?? "—",
      helicopterIcao: globalHelicopterIcao ?? "—",
      rotorDiameter: globalRotorDiameter ?? 0,
      dValue: globalDValue ?? 0,
      mtow: globalMtow ?? 0,
      optimalHeading: optimization?.bestHeading ?? null,
      usabilityPercent: bestCandidate?.usabilityPercent ?? optimization?.bestUsability ?? null,
      prevailingWind: prevailing,
      recommendedApproach: (prevailing + 180) % 360,
    });
  }, [globalHelicopterName, globalHelicopterIcao, globalRotorDiameter, globalDValue, globalMtow, optimization, bestCandidate, prevailing]);

  const tableRows = candidates.map((c) => [
    `${formatHdg(c.runwayHeading)}°`,
    `${c.usabilityPercent.toFixed(2)}%`,
    `${c.componentBreakdown.crosswindExceedPct.toFixed(2)}%`,
    `${c.exceedances}`,
    c.meets95 ? "✓ PASS" : "✗ FAIL",
  ]);

  if (globalCrosswindLimit === null && !useCustomLimit) {
    return (
      <div className="flex flex-col items-center justify-center py-10 border border-border rounded-sm text-center px-4 gap-2">
        <p className="text-sm text-muted-foreground">Waiting for Helicopter Selection</p>
        <p className="text-[10px] text-muted-foreground/60 font-mono-data">Select a helicopter or generic planning category in Tab 6 to define the crosswind limit</p>
      </div>
    );
  }

  return (
    <InstrumentCard title="Helipad Usability Analysis" accentColor="primary">
      <div className="space-y-4">
        {globalHelicopterName && (
          <div className="p-2.5 bg-secondary/30 border border-border rounded-sm space-y-1 text-[10px] font-mono-data">
            <span className="text-muted-foreground">Basis: </span><span className="text-primary">{globalHelicopterName}</span>
          </div>
        )}

        {/* FATO / approach heading */}
        <AeroInput label="FATO / Approach Heading" placeholder={`${formatHdg(effectiveHdg)}° (from prevailing wind)`} unit="°" value={helipadHdg} onChange={setHelipadHdg} />

        <div className="flex flex-col gap-1.5 pt-2">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data">Analysis Crosswind Limit</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setUseCustomLimit(false)}
              className={`flex-1 py-1.5 text-xs font-mono-data rounded-sm border transition-colors ${!useCustomLimit ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary/20"}`}
            >
              Inherited ({globalCrosswindLimit ?? "—"} kt)
            </button>
            <button 
              onClick={() => setUseCustomLimit(true)}
              className={`flex-1 py-1.5 text-xs font-mono-data rounded-sm border transition-colors ${useCustomLimit ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary/20"}`}
            >
              Custom Limit
            </button>
          </div>
          {useCustomLimit && (
            <div className="mt-2 text-warning text-[10px] font-mono-data border border-warning/30 bg-warning/5 rounded-sm p-2 flex items-center justify-between">
              <span>⚠ Overriding reference limit</span>
              <div className="w-1/2">
                <input 
                  type="number" 
                  value={customLimit} 
                  onChange={(e) => setCustomLimit(e.target.value)}
                  placeholder="20"
                  className="w-full bg-background border border-border rounded-sm px-2 py-1 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={addCandidate}
            className="flex-1 border border-primary text-primary hover:bg-primary hover:text-primary-foreground py-2 text-sm rounded-sm transition-all"
          >
            Analyze Heading
          </button>
          <button
            onClick={() => setShowOptimal(true)}
            className="flex-1 bg-primary text-primary-foreground py-2 text-sm rounded-sm transition-all"
          >
            Find Optimal
          </button>
        </div>

        {/* Prevailing approach recommendation */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Recommended Approach (into wind)</p>
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-display text-primary">{formatHdg((prevailing + 180) % 360)}°</span>
              <span className="text-xs text-muted-foreground">approach into prevailing {formatHdg(prevailing)}° wind</span>
            </div>
          </div>
        </div>

        {/* Results */}
        {bestCandidate && (
          <div className="grid grid-cols-3 gap-2">
            <DataReadout value={bestCandidate.usabilityPercent.toFixed(1)} unit="%" label="Usability" className="p-3 text-sm" />
            <DataReadout value={bestCandidate.exceedances.toLocaleString()} unit="obs" label="Exceedances" className="p-3 text-sm" />
            <DataReadout value={bestCandidate.componentBreakdown.crosswindExceedPct.toFixed(1)} unit="%" label="XW Exceed" className="p-3 text-sm" />
          </div>
        )}

        {candidates.length > 0 && (
          <AeroDataTable
            columns={["Heading", "Usability", "XW Exceed %", "Count", "≥95%"]}
            rows={tableRows}
          />
        )}

        {optimization && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Optimal FATO Orientation — Top 5</p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-display text-foreground">
                {formatHdg(optimization.bestHeading)}° / {formatHdg((optimization.bestHeading + 180) % 360)}°
              </span>
              <span className="text-xs text-muted-foreground">{optimization.bestUsability.toFixed(2)}% usability</span>
            </div>
            <AeroDataTable
              columns={["Rank", "Heading", "Usability"]}
              rows={optimization.top5.map((t, i) => [
                `#${i + 1}`,
                `${formatHdg(t.heading)}° / ${formatHdg((t.heading + 180) % 360)}°`,
                `${t.usability.toFixed(2)}%`,
              ])}
            />
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/60 italic">
          ICAO Annex 14 Vol II — Heliport planning reference. Not for operational use.
        </p>
      </div>
    </InstrumentCard>
  );
};

export default HelipadUsability;
