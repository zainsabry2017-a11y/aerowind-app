import { useMemo, useState } from "react";
import InstrumentCard from "@/components/InstrumentCard";
import AeroDataTable from "@/components/AeroDataTable";
import { calculateWindRose, DEFAULT_WIND_ROSE_OPTIONS } from "@/lib/windRoseCalculator";
import { optimizeRunwayOrientation } from "@/lib/windComponents";
import type { WindRecord } from "@/lib/windDataParser";

const hdg = (d: number) => String(Math.round(((d % 360) + 360) % 360 || 360)).padStart(3, "0");

function parseList(s: string, fallback: number[]) {
  const nums = s
    .split(/[,\s]+/)
    .map((x) => parseFloat(x))
    .filter((n) => Number.isFinite(n));
  return nums.length ? nums : fallback;
}

export default function ScenarioComparison(props: {
  records: WindRecord[];
  sectorSizeDeg?: number;
  monthFilter?: number[] | null;
  useGust?: boolean;
}) {
  const { records, sectorSizeDeg = 22.5, monthFilter = null, useGust = false } = props;
  const [calmList, setCalmList] = useState("0, 3, 5");
  const [xwList, setXwList] = useState("10, 13, 15, 17, 20");

  const calmThresholds = useMemo(() => parseList(calmList, [0, 3, 5]).slice(0, 8), [calmList]);
  const crosswindLimits = useMemo(() => parseList(xwList, [10, 13, 20]).slice(0, 8), [xwList]);

  const calmRows = useMemo(() => {
    if (!records.length) return [];
    return calmThresholds.map((t) => {
      const wr = calculateWindRose(records, {
        ...DEFAULT_WIND_ROSE_OPTIONS,
        sectorSize: sectorSizeDeg,
        calmThreshold: t,
        useGust,
        monthFilter,
        seasonFilter: null,
      });
      const prevailing = wr.bins.reduce((a, b) => (a.totalFrequency > b.totalFrequency ? a : b));
      return [
        `${t.toFixed(1)} kt`,
        `${wr.calmFrequency.toFixed(1)}%`,
        `${prevailing.label} (${prevailing.directionCenter}°)`,
        `${wr.totalObservations.toLocaleString()}`,
      ];
    });
  }, [records, calmThresholds, sectorSizeDeg, useGust, monthFilter]);

  const xwRows = useMemo(() => {
    if (!records.length) return [];
    return crosswindLimits.map((lim) => {
      const opt = optimizeRunwayOrientation(records, lim);
      return [
        `${lim.toFixed(1)} kt`,
        opt.bestHeading == null ? "—" : `${hdg(opt.bestHeading)}°/${hdg((opt.bestHeading + 180) % 360)}°`,
        `${opt.bestUsability.toFixed(1)}%`,
        `${opt.top5?.[0]?.usability?.toFixed?.(1) ?? opt.bestUsability.toFixed(1)}%`,
      ];
    });
  }, [records, crosswindLimits]);

  return (
    <InstrumentCard title="Scenario Engine (Side-by-Side)" accentColor="primary">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Calm thresholds (kt)</label>
              <input value={calmList} onChange={(e) => setCalmList(e.target.value)} className="aero-input w-full h-9" />
            </div>
          </div>
          <AeroDataTable
            columns={["Calm threshold", "Calm %", "Prevailing sector", "Obs"]}
            rows={calmRows}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Crosswind limits (kt)</label>
              <input value={xwList} onChange={(e) => setXwList(e.target.value)} className="aero-input w-full h-9" />
            </div>
          </div>
          <AeroDataTable
            columns={["XW limit", "Best heading", "Best usability", "Top rank"]}
            rows={xwRows}
          />
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Notes: calm-threshold scenarios affect wind-rose binning; crosswind scenarios rerun orientation optimization on the same records.
      </p>
    </InstrumentCard>
  );
}

