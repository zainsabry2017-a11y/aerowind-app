import React, { useMemo } from "react";
import { Download, Compass, ArrowDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { WindRoseResult } from "@/lib/windRoseCalculator";
import type { WindRecord } from "@/lib/windDataParser";
import { calculateWindComponents, resolvedFatoSecondAxisDeg } from "@/lib/windComponents";
import { exportCSV } from "@/lib/exportUtils";

interface AdvancedWindAnalysisProps {
  windRose: WindRoseResult | null;
  records: WindRecord[];
  orientation: number | null;
  /** Second FATO inbound (°); when null, reciprocal of orientation is used */
  orientation2?: number | null;
  cwLimit: number | null;
  mode: "airport" | "heliport" | "water";
  fileNamePrefix: string;
  /** When set with heliport mode, calm classification matches wind rose / FATO analysis */
  calmThresholdKts?: number;
  useGust?: boolean;
  /** Must match the calm threshold used to build `windRose` (for Speed Distribution calm row label). */
  windRoseCalmThresholdKt?: number;
}

export const AdvancedWindAnalysis = ({
  windRose,
  records,
  orientation,
  orientation2 = null,
  cwLimit,
  mode,
  fileNamePrefix,
  calmThresholdKts,
  useGust = false,
  windRoseCalmThresholdKt,
}: AdvancedWindAnalysisProps) => {

  const prevailingSummary = useMemo(() => {
    if (!windRose) return null;
    const sorted = [...windRose.bins].sort((a, b) => b.totalFrequency - a.totalFrequency);
    return {
      primary: sorted[0] || null,
      secondary: sorted.length > 1 ? sorted[1] : null
    };
  }, [windRose]);

  const speedBinRows = useMemo(() => {
    if (!windRose) return [];
    return windRose.speedBinRanges.map((range, i) => {
      let count = 0;
      let freq = 0;
      windRose.bins.forEach((bin) => {
        if (bin.speedBins[i]) {
          count += bin.speedBins[i].count;
          freq += bin.speedBins[i].frequency;
        }
      });
      return { label: range.label, count, freq, calm: false as const };
    });
  }, [windRose]);

  const speedDistRows = useMemo(() => {
    if (!windRose) return [];
    const calmLabel =
      windRoseCalmThresholdKt != null && Number.isFinite(windRoseCalmThresholdKt)
        ? `Calm (≤ ${windRoseCalmThresholdKt} kt)`
        : "Calm (≤ threshold)";
    return [
      ...speedBinRows,
      {
        label: calmLabel,
        count: windRose.calmCount,
        freq: windRose.calmFrequency,
        calm: true as const,
      },
    ];
  }, [windRose, speedBinRows, windRoseCalmThresholdKt]);

  const crosswindData = useMemo(() => {
    if (orientation === null || cwLimit === null || !records.length) return null;
    let within = 0;
    let totalValid = 0;
    const useDynamicCalm = calmThresholdKts !== undefined && Number.isFinite(calmThresholdKts);
    const bins = [
      { label: "0-5 kt", min: 0, max: 5, count: 0 },
      { label: "6-10 kt", min: 5, max: 10, count: 0 },
      { label: "11-15 kt", min: 10, max: 15, count: 0 },
      { label: "16-20 kt", min: 15, max: 20, count: 0 },
      { label: "21-25 kt", min: 20, max: 25, count: 0 },
      { label: "25+ kt", min: 25, max: Infinity, count: 0 }
    ];

    records.forEach(r => {
      if (!r.isValid) return;
      const windSpd = useGust && r.wind_gust_kt !== null ? r.wind_gust_kt : r.wind_speed_kt;
      const isCalmObs = useDynamicCalm ? windSpd <= calmThresholdKts! : r.isCalm;
      if (isCalmObs) {
        bins[0].count++;
        within++;
        totalValid++;
        return;
      }
      totalValid++;
      const sec = resolvedFatoSecondAxisDeg(orientation, orientation2);
      const comp1 = calculateWindComponents(r.wind_direction_deg, windSpd, orientation);
      const comp2 = calculateWindComponents(r.wind_direction_deg, windSpd, sec);
      const cw = Math.min(comp1.crosswind, comp2.crosswind);

      if (cw <= cwLimit) within++;

      const idx = bins.findIndex((b, i) => {
        const lowerOk = cw >= b.min;
        const upperOk = i === bins.length - 1 ? cw <= b.max : cw < b.max;
        return lowerOk && upperOk;
      });
      if (idx >= 0) bins[idx].count++;
    });

    return {
      bins: bins.map(b => ({ ...b, freq: totalValid > 0 ? (b.count / totalValid) * 100 : 0 })),
      coverage: totalValid > 0 ? (within / totalValid) * 100 : 0,
      totalValid
    };
  }, [records, orientation, orientation2, cwLimit, calmThresholdKts, useGust]);

  if (!windRose || !records.length) {
    return (
      <div className="p-8 border border-border border-dashed bg-muted/10 text-center rounded-sm">
        <p className="text-muted-foreground text-sm italic">No wind data available.</p>
      </div>
    );
  }

  const handleDownloadCrosswind = () => {
    if (!crosswindData) return;
    const rows = crosswindData.bins.map(b => [b.label, b.count.toString(), b.freq.toFixed(2)]);
    exportCSV(`${fileNamePrefix}_crosswind.csv`, ["Crosswind Range", "Count", "Frequency (%)"], rows);
  };

  const handleDownloadSpeed = () => {
    const rows = speedDistRows.map(r => [r.label, r.count.toString(), r.freq.toFixed(2)]);
    exportCSV(`${fileNamePrefix}_speed_dist.csv`, ["Speed Range", "Count", "Frequency (%)"], rows);
  };

  const handleDownloadFreq = () => {
    const rows = windRose.bins.map(b => [b.label, `${b.directionCenter}°`, b.totalFrequency.toFixed(2), b.speedBins.reduce((s, sp) => s + sp.count, 0).toString()]);
    exportCSV(`${fileNamePrefix}_wind_freq.csv`, ["Direction", "Center (°)", "Frequency (%)", "Observations"], rows);
  };

  return (
    <div className="space-y-8 report-facility-block">
      <style>{`
        .aw-clip-coverage { clip-path: inset(0 0 ${crosswindData ? 100 - crosswindData.coverage : 0}% 0); }
        .aw-rot-primary { transform: rotate(${prevailingSummary?.primary?.directionCenter || 0}deg); }
        .aw-rot-orientation { transform: rotate(${orientation || 0}deg); }
        ${speedDistRows.map((r, i) => { const mx = Math.max(...speedDistRows.map(x => x.freq)) || 1; return '.aw-w-spd-' + i + ' { width: ' + ((r.freq / mx) * 100) + '%; }'; }).join('\n')}
        ${crosswindData?.bins.map((r, i) => { const mx = Math.max(...crosswindData.bins.map(x => x.freq)) || 1; return '.aw-w-cw-' + i + ' { width: ' + ((r.freq / mx) * 100) + '%; }'; }).join('\n') || ''}
      `}</style>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Coverage Indicator */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">Wind Coverage (ICAO)</p>
          {crosswindData ? (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center border-4 border-muted">
                {/* Pure CSS Donut overlay via absolute positioning */}
                <div 
                  className={`absolute inset-0 rounded-full border-4 aw-clip-coverage ${crosswindData.coverage >= 95 ? 'border-emerald-500' : 'border-warning'}`}
                />
                <span className="text-xl font-display font-bold relative z-10">{crosswindData.coverage.toFixed(1)}%</span>
              </div>
              <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${crosswindData.coverage >= 95 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-warning/20 text-warning'}`}>
                {crosswindData.coverage >= 95 ? "✓ PASS" : "⚠ FAIL (<95%)"}
              </div>
              <p className="text-[9px] text-muted-foreground border-t border-border w-full text-center pt-2">Limit applied: {cwLimit} kt</p>
            </div>
          ) : (
             <p className="text-xs text-muted-foreground italic text-center py-8">Orientation pending selection</p>
          )}
        </div>

        {/* Prevailing Wind Summary */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">Prevailing Wind</p>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-muted-foreground">Primary Sector</p>
              <div className="flex items-end gap-2 text-primary">
                <span className="text-2xl font-display font-medium leading-none">{prevailingSummary?.primary?.label}</span>
                <span className="text-sm pb-0.5">{prevailingSummary?.primary?.directionCenter}°</span>
              </div>
              <p className="text-xs text-muted-foreground">{prevailingSummary?.primary?.totalFrequency.toFixed(1)}% Frequency</p>
            </div>
            {prevailingSummary?.secondary && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground">Secondary Sector</p>
                <div className="flex items-baseline gap-1.5 text-foreground">
                  <span className="font-medium text-sm">{prevailingSummary.secondary.label}</span>
                  <span className="text-[10px]">({prevailingSummary.secondary.directionCenter}°) — {prevailingSummary.secondary.totalFrequency.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Approach / Orientation Diagram */}
        <div className="bg-card border border-border rounded-sm p-5 flex flex-col">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Orientation Diagram</p>
          <div className="flex-1 flex items-center justify-center">
            {orientation !== null && prevailingSummary?.primary ? (
              <div className="relative w-32 h-32 rounded-full border border-border bg-muted/20 flex flex-col items-center justify-center">
                <div className="absolute top-1 text-[8px] text-muted-foreground">N</div>
                <div className="absolute bottom-1 text-[8px] text-muted-foreground">S</div>
                <div className="absolute right-1 text-[8px] text-muted-foreground">E</div>
                <div className="absolute left-1 text-[8px] text-muted-foreground">W</div>
                
                {/* Wind Arrow Pointing AWAY from origin (Wind is FROM dir but flows TOWARD reciprocal) */}
                <div className="absolute w-full h-full flex items-center justify-center aw-rot-primary">
                  <ArrowDown className="text-primary w-5 h-5 absolute top-2 opacity-80" strokeWidth={3} />
                </div>
                
                {/* Orientation Runway/FATO line */}
                <div className="absolute w-1 h-20 bg-foreground rounded-sm z-10 aw-rot-orientation" />
              </div>
            ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Pending Orientation</p>
            )}
          </div>
        </div>
      </div>

      {/* Speed Distribution (Table + Chart) */}
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
          <div>
            <p className="text-sm uppercase tracking-[0.15em] text-foreground font-medium">Speed Distribution</p>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-xl leading-snug">
              Table matches the wind rose: same month/season filter and calm threshold. Frequencies are % of all filtered observations; the calm row completes the total to 100%.
            </p>
          </div>
          <button onClick={handleDownloadSpeed} className="text-[10px] flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground rounded-sm transition-all shadow-sm no-print shrink-0">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <table className="w-full text-xs font-mono-data text-center">
            <thead className="text-[10px] text-muted-foreground uppercase bg-muted/40">
              <tr>
                <th className="py-1 px-2 border-b border-border text-left">Speed Range</th>
                <th className="py-1 px-2 border-b border-border text-right">Count</th>
                <th className="py-1 px-2 border-b border-border text-right">Frequency (%)</th>
              </tr>
            </thead>
            <tbody>
              {speedDistRows.map((r, i) => (
                <tr key={i} className={`border-b border-border/50 ${r.calm ? "bg-muted/20" : ""}`}>
                  <td className="py-1.5 px-2 text-left">{r.label}</td>
                  <td className="py-1.5 px-2 text-right">{r.count.toLocaleString()}</td>
                  <td className="py-1.5 px-2 text-right">{r.freq.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col justify-center space-y-3 px-4 border-l border-border/50">
            {speedDistRows.map((r, i) => {
              const maxFreq = Math.max(...speedDistRows.map((x) => x.freq)) || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] w-12 text-right text-muted-foreground shrink-0">{r.calm ? "Calm" : r.label}</span>
                  <div className="flex-1 bg-muted/30 h-3 rounded-sm overflow-hidden border border-border/30 min-w-0">
                    <div
                      className={`h-full aw-w-spd-${i} ${r.calm ? "bg-muted-foreground/45" : "bg-cyan-600"}`}
                    />
                  </div>
                  <span className="text-[10px] w-10 text-right font-mono-data shrink-0">{r.freq.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Crosswind Chart & Table */}
      {crosswindData && (
        <div className="pt-4 mt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3 border-b border-border pb-2 gap-3">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.15em] text-foreground font-medium">Crosswind Analysis</p>
              <p className="text-[10px] text-muted-foreground mt-1 max-w-xl leading-snug">
                Crosswind is the smaller of the two components at this heading and its reciprocal (±180°), matching runway/FATO usability — not the same as counting rows with wind speed above the limit in Excel.
              </p>
            </div>
            <button onClick={handleDownloadCrosswind} className="text-[10px] flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground rounded-sm transition-all shadow-sm no-print shrink-0">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <table className="w-full text-xs font-mono-data text-center">
              <thead className="text-[10px] text-muted-foreground uppercase bg-muted/40">
                <tr>
                  <th className="py-1 px-2 border-b border-border text-left">CW Range</th>
                  <th className="py-1 px-2 border-b border-border text-right">Count</th>
                  <th className="py-1 px-2 border-b border-border text-right">Frequency (%)</th>
                </tr>
              </thead>
              <tbody>
                {crosswindData.bins.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 text-left">{r.label}</td>
                    <td className="py-1.5 px-2 text-right">{r.count}</td>
                    <td className="py-1.5 px-2 text-right">{r.freq.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col justify-center space-y-3 px-4 border-l border-border/50 relative">
              {/* Virtual vertical limit line for chart context */}
              <div className="absolute top-0 bottom-0 border-l border-dashed border-warning/50 z-0 left-1/2" />
              
              {crosswindData.bins.map((r, i) => {
                const maxFreq = Math.max(...crosswindData.bins.map(x => x.freq)) || 1;
                const pct = (r.freq / maxFreq) * 100;
                const isOver = r.min > cwLimit;
                return (
                  <div key={i} className="flex items-center gap-3 relative z-10">
                    <span className="text-[10px] w-12 text-right text-muted-foreground">{r.label}</span>
                    <div className="flex-1 bg-muted/30 h-3 rounded-sm overflow-hidden border border-border/30 flex">
                      <div className={`h-full aw-w-cw-${i} ${isOver ? 'bg-warning/80' : 'bg-emerald-500/80'}`} />
                    </div>
                    <span className="text-[10px] w-10 text-right font-mono-data">{r.freq.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wind Frequency Mapping */}
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-border pb-2 pt-4 mt-6">
          <p className="text-sm uppercase tracking-[0.15em] text-foreground font-medium">Frequency By Direction</p>
          <button onClick={handleDownloadFreq} className="text-[10px] flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground rounded-sm transition-all shadow-sm no-print">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
           {windRose.bins.map((b, i) => (
              <div key={i} className="p-2 border border-border bg-card rounded-sm text-center">
                <p className="font-bold text-xs">{b.label}</p>
                <p className="text-[9px] text-muted-foreground border-b border-border/50 pb-1 mb-1">{b.directionCenter}°</p>
                <p className="text-sm font-mono-data text-primary">{b.totalFrequency.toFixed(1)}%</p>
              </div>
           ))}
        </div>
      </div>

      <div className="p-4 bg-muted/20 border border-border/50 text-[10px] text-muted-foreground/80 italic mt-6 space-y-1">
        <p className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-primary" /> Engineering & Safety Note:</p>
        <p>This visualization panel is an algorithmic dashboard derived directly from the loaded meteorological array. Target compliance limits are processed exclusively per ICAO Annex 14 / GACAR Part 138 references.</p>
        <p>Professional use dictates this dashboard forms a "planning support baseline" only. Final construction authorization is gated pending authenticated regulatory submissions.</p>
      </div>

    </div>
  );
};
