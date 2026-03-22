import type { ParsedWindData } from "@/lib/windDataParser";
import InstrumentCard from "./InstrumentCard";
import DataReadout from "./DataReadout";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function DataValidationReport({ data }: { data: ParsedWindData }) {
  
  const qualIcon = data.reliability === "high" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                   data.reliability === "medium" ? <AlertTriangle className="w-5 h-5 text-warning" /> :
                   <XCircle className="w-5 h-5 text-destructive" />;
  
  const qualLabel = data.reliability === "high" ? "Good" : data.reliability === "medium" ? "Moderate" : "Poor";
  const qualColor = data.reliability === "high" ? "text-emerald-400" : data.reliability === "medium" ? "text-warning" : "text-destructive";

  return (
    <InstrumentCard title="Engineering Validation Report">
      <div className="mb-4 p-3 bg-secondary/10 border border-border rounded-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data mb-1">Dataset Quality Indicator</p>
          <div className="flex items-center gap-2">
            {qualIcon}
            <span className={`text-xl font-display uppercase tracking-widest ${qualColor}`}>{qualLabel}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-display text-foreground">{((data.validRows / data.totalRows) * 100).toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground uppercase font-mono-data">Yield Rate</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <DataReadout value={data.totalRows.toLocaleString()} unit="Rows" label="Submitted" className="p-2" />
        <DataReadout value={data.validRows.toLocaleString()} unit="Rows" label="Accepted" className="p-2 border-primary/30" />
        <DataReadout value={(data.invalidRows || 0).toLocaleString()} unit="Rows" label="Rejected (Outliers)" className={`p-2 ${data.invalidRows > 0 ? "border-warning/50 bg-warning/5 text-warning" : ""}`} />
        <DataReadout value={data.missingValues.toLocaleString()} unit="Fields" label="Missing Data" className="p-2" />
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border pb-1 mb-2">Column Mapping</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 text-[10px] font-mono-data">
            {Object.entries(data.columns).map(([key, val]) => {
              const isFound = val !== null;
              const isCritical = key === "speed" || key === "direction";
              return (
                <div key={key} className="flex flex-col p-1.5 bg-secondary/20 border border-border rounded-sm">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  {isFound ? (
                    <span className="text-emerald-400 truncate">"{val}"</span>
                  ) : (
                    <span className={isCritical ? "text-destructive" : "text-muted-foreground/50"}>{isCritical ? "CRITICAL: MISSING" : "Not Provided"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {data.warnings.length > 0 && (
           <div>
             <p className="text-[10px] uppercase tracking-[0.15em] text-warning border-b border-warning/30 pb-1 mb-2">Warnings & Outlier Rejections</p>
             <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
               {data.warnings.map((w, i) => (
                 <p key={i} className={`text-[10px] font-mono-data ${w.includes("CRITICAL") || w.includes("Rejected") ? "text-destructive" : "text-warning"}`}>• {w}</p>
               ))}
             </div>
           </div>
        )}
      </div>
    </InstrumentCard>
  );
}
