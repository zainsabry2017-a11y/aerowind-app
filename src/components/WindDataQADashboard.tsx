import { useMemo } from "react";
import InstrumentCard from "@/components/InstrumentCard";
import { CALENDAR_MONTHS, METEOROLOGICAL_SEASONS, sumMonthCountsForSeason } from "@/lib/windCalendarLabels";
import { getObservationUtcMonthIndex0, type ParsedWindData } from "@/lib/windDataParser";

function pct(n: number, d: number) {
  if (!d) return "—";
  return ((n / d) * 100).toFixed(1) + "%";
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
    let monthUnknown = 0;
    for (const r of data.records) {
      const mi = getObservationUtcMonthIndex0(r);
      if (mi === null) monthUnknown++;
      else monthCounts[mi]++;
    }
    const seasonCounts = [0, 1, 2, 3].map((i) => sumMonthCountsForSeason(monthCounts, i)) as [
      number,
      number,
      number,
      number,
    ];
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
      monthUnknown,
      seasonCounts,
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
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono-data mb-1">
            Season / month coverage
          </p>
          <p className="text-[9px] text-muted-foreground/80 mb-2 leading-snug">
            Rows are counted by calendar month from your file (column <span className="text-foreground/90">Month</span> / date).
            Month <span className="font-mono-data">1</span> = January, <span className="font-mono-data">2</span> = February, …{" "}
            <span className="font-mono-data">12</span> = December.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 [grid-auto-rows:1fr]">
            {CALENDAR_MONTHS.map((m, i) => {
              const shortName = new Date(2000, i, 1).toLocaleString("en", { month: "short" });
              return (
                <div
                  key={m.num}
                  className="flex min-h-[4.5rem] min-w-0 flex-col justify-between gap-1.5 overflow-hidden rounded-sm border border-border bg-card/30 px-2.5 py-2"
                >
                  <div className="min-w-0 text-[9px] font-mono-data leading-tight text-muted-foreground">
                    <span className="tabular-nums text-foreground/90">{m.num}</span>
                    <span className="mx-1 opacity-40">·</span>
                    <span className="break-words">{shortName}</span>
                  </div>
                  <p className="text-right text-sm font-mono-data tabular-nums leading-none tracking-tight text-foreground">
                    {qa.monthCounts[i].toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {METEOROLOGICAL_SEASONS.map((s, i) => (
              <div
                key={s.label}
                className="flex min-h-[4.75rem] min-w-0 flex-col gap-2 overflow-hidden rounded-sm border border-border bg-card/30 px-3 py-2.5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-mono-data text-foreground">{s.label}</p>
                  <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{s.monthsNamed}</p>
                </div>
                <div className="shrink-0 border-t border-border pt-2 sm:flex sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 sm:text-right">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Rows</p>
                  <p className="mt-0.5 text-sm font-mono-data tabular-nums text-foreground sm:mt-1">
                    {qa.seasonCounts[i].toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Non-empty months: <span className="text-foreground font-mono-data">{qa.nonZeroMonths}/12</span> • Season bias index:{" "}
            <span className="text-foreground font-mono-data">{qa.bias ? qa.bias.toFixed(2) : "—"}</span>
            {qa.monthUnknown > 0 ? (
              <>
                {" "}
                • <span className="text-warning">{qa.monthUnknown.toLocaleString()} row(s) with unknown month</span>
              </>
            ) : null}
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

