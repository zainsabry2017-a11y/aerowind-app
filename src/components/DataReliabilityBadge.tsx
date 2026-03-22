interface DataReliabilityBadgeProps {
  level: "high" | "medium" | "low";
  reasons?: string[];
}

const colors = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-destructive/20 text-destructive border-destructive/30",
};

const DataReliabilityBadge = ({ level, reasons }: DataReliabilityBadgeProps) => (
  <div className={`inline-flex flex-col gap-1 px-3 py-2 border rounded-sm ${colors[level]}`}>
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${level === "high" ? "bg-emerald-400" : level === "medium" ? "bg-warning" : "bg-destructive"}`} />
      <span className="text-xs uppercase tracking-[0.15em] font-medium">
        {level} Reliability
      </span>
    </div>
    {reasons && reasons.length > 0 && (
      <div className="text-[10px] opacity-70 pl-4 space-y-0.5">
        {reasons.map((r, i) => <p key={i}>• {r}</p>)}
      </div>
    )}
  </div>
);

export default DataReliabilityBadge;
