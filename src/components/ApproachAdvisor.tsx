import { useMemo, useEffect, useRef } from "react";
import InstrumentCard from "@/components/InstrumentCard";
import { Compass, PlaneTakeoff } from "lucide-react";
import type { WindRoseResult } from "@/lib/windRoseCalculator";

export interface ApproachAnalysisResult {
  prevailingDir: number;
  approachDir: number;
  approachLabel: string;
  rwyDesignator: string;
  secondaryDir: number | null;
  secondaryCrossAngle: number | null;
}

interface ApproachAdvisorProps {
  windRose: WindRoseResult;
  mode?: "airport" | "heliport";
  /** Optional — fires whenever the computed approach analysis updates */
  onAnalysis?: (result: ApproachAnalysisResult) => void;
}

function formatHeading(deg: number): string {
  const d = ((deg % 360) + 360) % 360 || 360;
  return String(Math.round(d)).padStart(3, "0");
}

function getCardinal(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360 + 360) % 360) / 22.5) % 16];
}

function computePrevailing(windRose: WindRoseResult) {
  // Weighted vector mean of all non-calm winds
  let sinSum = 0, cosSum = 0, totalWeight = 0;
  for (const bin of windRose.bins) {
    const rad = (bin.directionCenter * Math.PI) / 180;
    const w = bin.totalFrequency;
    sinSum += w * Math.sin(rad);
    cosSum += w * Math.cos(rad);
    totalWeight += w;
  }
  if (totalWeight === 0) return null;

  let meanDir = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  meanDir = ((meanDir % 360) + 360) % 360;

  // Also find peak bin
  const peak = windRose.bins.reduce((a, b) => a.totalFrequency > b.totalFrequency ? a : b);

  return {
    vectorMeanDir: meanDir,
    peakDir: peak.directionCenter,
    peakLabel: peak.label,
    peakFreq: peak.totalFrequency,
  };
}

const ApproachAdvisor = ({ windRose, mode = "airport", onAnalysis }: ApproachAdvisorProps) => {
  const onAnalysisRef = useRef(onAnalysis);
  onAnalysisRef.current = onAnalysis;
  const analysis = useMemo(() => {
    const prev = computePrevailing(windRose);
    if (!prev) return null;

    // Preferred approach = INTO the wind (reciprocal of prevailing)
    const approachDir = (prev.vectorMeanDir + 180) % 360;

    // Recommended runway heading aligned with prevailing wind
    const rwHeading = prev.vectorMeanDir <= 180 ? prev.vectorMeanDir : prev.vectorMeanDir - 180;
    const rwReciprocal = (rwHeading + 180) % 360;

    // Runway designator
    const rwyNum1 = Math.round(rwHeading / 10) || 36;
    const rwyNum2 = Math.round(rwReciprocal / 10) || 36;

    // Secondary wind (second strongest direction)
    const sorted = [...windRose.bins].sort((a, b) => b.totalFrequency - a.totalFrequency);
    const secondary = sorted.length > 1 ? sorted[1] : null;

    // Cross-runway angle for secondary
    let secondaryCrossAngle: number | null = null;
    if (secondary) {
      let diff = Math.abs(secondary.directionCenter - prev.vectorMeanDir);
      if (diff > 180) diff = 360 - diff;
      secondaryCrossAngle = diff;
    }

    return {
      prevailingDir: prev.vectorMeanDir,
      prevailingLabel: getCardinal(prev.vectorMeanDir),
      peakDir: prev.peakDir,
      peakLabel: prev.peakLabel,
      peakFreq: prev.peakFreq,
      approachDir,
      approachLabel: getCardinal(approachDir),
      rwHeading,
      rwReciprocal,
      rwyDesignator: `${String(rwyNum1).padStart(2, "0")}/${String(rwyNum2).padStart(2, "0")}`,
      secondaryDir: secondary?.directionCenter ?? null,
      secondaryLabel: secondary?.label ?? null,
      secondaryFreq: secondary?.totalFrequency ?? 0,
      secondaryCrossAngle,
    };
  }, [windRose]);

  // Surface computed analysis to parent
  useEffect(() => {
    if (!analysis) return;
    onAnalysisRef.current?.({
      prevailingDir: analysis.prevailingDir,
      approachDir:   analysis.approachDir,
      approachLabel: analysis.approachLabel,
      rwyDesignator: analysis.rwyDesignator,
      secondaryDir:  analysis.secondaryDir,
      secondaryCrossAngle: analysis.secondaryCrossAngle,
    });
  }, [analysis]);

  if (!analysis) return null;

  return (
    <InstrumentCard title="Approach & Alignment Advisor" accentColor="primary">
      <div className="space-y-4">
        {/* Prevailing Wind */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Prevailing Wind Direction</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display text-foreground">{formatHeading(analysis.prevailingDir)}°</span>
            <span className="text-sm text-muted-foreground">({analysis.prevailingLabel})</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono-data">
            Peak sector: {analysis.peakLabel} ({analysis.peakDir}°) — {analysis.peakFreq.toFixed(1)}% of observations
          </p>
        </div>

        {/* Runway/FATO Recommendation */}
        <div className="border-t border-border pt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
            {mode === "airport" ? <PlaneTakeoff className="w-3 h-3 text-primary" /> : <Compass className="w-3 h-3 text-primary" />} 
            {mode === "airport" ? "Recommended Runway Orientation" : "Preferred FATO Orientation"}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display text-foreground">
              {mode === "airport" ? `RWY ${analysis.rwyDesignator}` : `FATO ${formatHeading(analysis.rwHeading)}°/${formatHeading(analysis.rwReciprocal)}°`}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono-data">
            Heading: {formatHeading(analysis.rwHeading)}° / {formatHeading(analysis.rwReciprocal)}°
          </p>
          <p className="text-[10px] text-muted-foreground font-mono-data">
            Aligned with prevailing wind for maximum headwind component
          </p>
        </div>

        {/* Approach Direction */}
        <div className="border-t border-border pt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Preferred Approach Direction</p>
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-display text-primary">{formatHeading(analysis.approachDir)}°</span>
              <span className="text-sm text-muted-foreground">({analysis.approachLabel})</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {mode === "airport" 
                ? "Approach into the prevailing wind — applies to both runway and helipad operations"
                : "Approach into the prevailing wind — primary approach and departure path"}
            </p>
          </div>
        </div>

        {/* Helipad Specific */}
        <div className="border-t border-border pt-3 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Helipad Approach Guidance</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-mono-data">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-foreground">Primary approach: {formatHeading(analysis.approachDir)}° ({analysis.approachLabel})</span>
            </div>
            {analysis.secondaryDir !== null && (
              <div className="flex items-center gap-2 text-[10px] font-mono-data">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-foreground">
                  Secondary wind: {analysis.secondaryLabel} ({analysis.secondaryDir}°) — {analysis.secondaryFreq.toFixed(1)}%
                </span>
              </div>
            )}
            {analysis.secondaryCrossAngle !== null && analysis.secondaryCrossAngle > 60 && (
              <p className="text-[10px] text-warning">
                ⚠ Secondary wind at {analysis.secondaryCrossAngle.toFixed(0)}° to primary — consider omnidirectional FATO
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              ICAO Annex 14 Vol II: Helipad approach/departure paths should be aligned with prevailing wind where practicable
            </p>
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground/60 italic border-t border-border pt-2">
          Planning guidance only — final approach paths require obstacle assessment per ICAO Annex 14
        </p>
      </div>
    </InstrumentCard>
  );
};

export default ApproachAdvisor;
