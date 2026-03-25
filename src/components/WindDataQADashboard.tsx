import { useMemo } from "react";
import InstrumentCard from "@/components/InstrumentCard";
import type { ParsedWindData } from "@/lib/windDataParser";

function pct(n: number, d: number) {
  if (!d) return "—";
  return ((n / d) * 100).toFixed(1) + "%";
}

function monthName(i: number) {
  try {
    return new Date(2000, i, 1).toLocaleString("en", { month: "short" });
  } catch {
    return String(i + 1);
  }
}

export default function WindDataQADashboard(props: { data: ParsedWindData }) {
  const { data } = props;

  const qa = useMemo(() => {
    const total = data.totalRows || 0;
    const valid = data.validRows || 0;
    const invalid = data.invalidRows || Math.max(0, total - valid);

    const speeds = data.records.map((r) => r.wind_speed_kt).filter((v) => Number.isFinite(v));
    const gusts = data.records.map((r) => r.wind_gust_kt ?? NaN).filter((v) => Number.isFinite(v));

    const maxSpeed = speeds.length ? Math.max(...speeds) : null;
    const maxGust = gusts.length ? Math.max(...gusts) : null;

    const outSpeed = speeds.filter((s) => s >= 50).length;
    const outGust = gusts.filter((g) => g >= 70).length;

    const monthCounts = Array.from({ length: 12 }, () => 0);
    for (const r of data.records) {
      const d = new Date(`${r.observation_date}T00:00:00Z`);
      if (!isNaN(d.getTime())) monthCounts[d.getUTCMonth()]++;
    }
    const monthTotal = monthCounts.reduce((a, b) => a + b, 0);
    const nonZeroMonths = monthCounts.filter((c) => c > 0).length;
    const expected = monthTotal ? monthTotal / Math.max(1, nonZeroMonths) : 0;
    const bias = monthTotal
      ? Math.max(...monthCounts) / Math.max(1, expected)
      : 0;

    const confidenceGrade = (() => {
      const invalidRate = total ? invalid / total : 1;
      const hasFullYear = nonZeroMonths >= 10;
      if (data.reliability === "high" && invalidRate <= 0.05 && hasFullYear) return "A";
      if (data.reliability === "high" && invalidRate <= 0.1) return "B";
      if (data.reliability === "medium" && invalidRate <= 0.15) return "B";
      if (data.reliability === "medium") return "C";
      return "D";
    })();

    return {
      total,
      valid,
      invalid,
      outSpeed,
      outGust,
      maxSpeed,
      maxGust,
      monthCounts,
      monthTotal,
      nonZeroMonths,
      bias,
      confidenceGrade,
    };
  }, [data]);

  return (
    <InstrumentCard title="QA Dashboard (Before Analysis)" accentColor="primary">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 border border-border rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Valid</p>
          <p className="text-xl font-display text-foreground">{qa.valid.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground font-mono-data">{pct(qa.valid, qa.total)} of rows</p>
        </div>
        <div className="p-3 border border-border rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Missing / invalid</p>
          <p className="text-xl font-display text-foreground">{qa.invalid.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground font-mono-data">{pct(qa.invalid, qa.total)} of rows</p>
        </div>
        <div className="p-3 border border-border rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Outliers</p>
          <p className="text-xl font-display text-foreground">{(qa.outSpeed + qa.outGust).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground font-mono-data">Speed ≥50kt: {qa.outSpeed} • Gust ≥70kt: {qa.outGust}</p>
        </div>
        <div className="p-3 border border-border rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data">Confidence grade</p>
          <p className="text-xl font-display text-primary">{qa.confidenceGrade}</p>
          <p className="text-[10px] text-muted-foreground font-mono-data">Reliability: {data.reliability.toUpperCase()}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 border border-border rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data mb-2">Season / month coverage</p>
          <div className="grid grid-cols-4 gap-2">
            {qa.monthCounts.map((c, i) => (
              <div key={i} className="border border-border rounded-sm px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-data text-muted-foreground">{monthName(i)}</span>
                  <span className="text-[10px] font-mono-data text-foreground">{c}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Non-empty months: <span className="text-foreground font-mono-data">{qa.nonZeroMonths}/12</span> • Season bias index:{" "}
            <span className="text-foreground font-mono-data">{qa.bias ? qa.bias.toFixed(2) : "—"}</span>
          </p>
        </div>

        <div className="p-3 border border-border rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data mb-2">Extremes</p>
          <div className="space-y-2 text-[11px] font-mono-data">
            <div className="flex justify-between border-b border-border pb-1">
              <span className="text-muted-foreground">Max speed</span>
              <span className="text-foreground">{qa.maxSpeed == null ? "—" : `${qa.maxSpeed.toFixed(1)} kt`}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-1">
              <span className="text-muted-foreground">Max gust</span>
              <span className="text-foreground">{qa.maxGust == null ? "—" : `${qa.maxGust.toFixed(1)} kt`}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-1">
              <span className="text-muted-foreground">Missing values (cells)</span>
              <span className="text-foreground">{data.missingValues.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date range</span>
              <span className="text-foreground">{data.dateRange ? `${data.dateRange.start} → ${data.dateRange.end}` : "—"}</span>
            </div>
          </div>
          {data.reliabilityReasons?.length ? (
            <div className="mt-3 text-[10px] text-muted-foreground">
              {data.reliabilityReasons.slice(0, 4).map((r, i) => (
                <div key={i} className="border-b border-border pb-1">- {r}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </InstrumentCard>
  );
}

