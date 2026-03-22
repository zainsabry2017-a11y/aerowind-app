import { useState, useMemo } from "react";
import InstrumentCard from "@/components/InstrumentCard";
import { AeroInput, AeroSelect } from "@/components/AeroInput";
import { calculateWindComponents } from "@/lib/windComponents";
import { Plane, Wind } from "lucide-react";

interface CrosswindCalculatorProps {
  defaultWindDir?: number;
  defaultWindSpeed?: number;
}

const CrosswindCalculator = ({ defaultWindDir, defaultWindSpeed }: CrosswindCalculatorProps) => {
  const [windDir, setWindDir] = useState(String(defaultWindDir ?? ""));
  const [windSpeed, setWindSpeed] = useState(String(defaultWindSpeed ?? ""));
  const [runwayHdg, setRunwayHdg] = useState("");
  const [limitPreset, setLimitPreset] = useState("13");
  const [customLimit, setCustomLimit] = useState("");

  const xwLimit = limitPreset === "custom" ? parseFloat(customLimit) || 13 : parseFloat(limitPreset);

  const result = useMemo(() => {
    const dir = parseFloat(windDir);
    const spd = parseFloat(windSpeed);
    const hdg = parseFloat(runwayHdg);
    if (isNaN(dir) || isNaN(spd) || isNaN(hdg)) return null;
    const comp = calculateWindComponents(dir, spd, hdg);
    return { ...comp, exceedsCrosswind: comp.crosswind > xwLimit };
  }, [windDir, windSpeed, runwayHdg, xwLimit]);

  const angleOff = useMemo(() => {
    const dir = parseFloat(windDir);
    const hdg = parseFloat(runwayHdg);
    if (isNaN(dir) || isNaN(hdg)) return null;
    let diff = ((dir - hdg + 540) % 360) - 180;
    return diff;
  }, [windDir, runwayHdg]);

  return (
    <InstrumentCard title="Crosswind Calculator">
      <div className="space-y-3">
        <AeroInput label="Wind Direction" placeholder="270" unit="°" value={windDir} onChange={setWindDir} />
        <AeroInput label="Wind Speed" placeholder="15" unit="KT" value={windSpeed} onChange={setWindSpeed} />
        <AeroInput label="Runway / Helipad Heading" placeholder="180" unit="°" value={runwayHdg} onChange={setRunwayHdg} />
        <AeroSelect label="Crosswind Limit" value={limitPreset} onChange={setLimitPreset} options={[
          { value: "10", label: "10 kt (Code A / Light)" },
          { value: "13", label: "13 kt (Code B)" },
          { value: "20", label: "20 kt (Code C–F)" },
          { value: "custom", label: "Custom…" },
        ]} />
        {limitPreset === "custom" && <AeroInput label="Custom Limit" placeholder="15" unit="KT" value={customLimit} onChange={setCustomLimit} />}

        {result && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 border-l-2 border-l-primary bg-surface/50 rounded-sm">
                <p className="text-xl font-display text-foreground">{Math.abs(result.headwind).toFixed(1)} <span className="text-xs font-mono-data text-muted-foreground">kt</span></p>
                <p className="text-[10px] text-muted-foreground">{result.headwind >= 0 ? "Headwind ↑" : "Tailwind ↓"}</p>
              </div>
              <div className={`p-3 border-l-2 rounded-sm ${result.exceedsCrosswind ? "border-l-destructive bg-destructive/5" : "border-l-primary bg-surface/50"}`}>
                <p className="text-xl font-display text-foreground">{result.crosswind.toFixed(1)} <span className="text-xs font-mono-data text-muted-foreground">kt</span></p>
                <p className="text-[10px] text-muted-foreground">Crosswind {result.exceedsCrosswind ? "⚠ EXCEEDS" : "✓ OK"}</p>
              </div>
            </div>

            {angleOff !== null && (
              <div className="p-2 bg-secondary/30 rounded-sm">
                <p className="text-[10px] font-mono-data text-muted-foreground">
                  Wind angle off runway: <span className="text-foreground">{Math.abs(angleOff).toFixed(0)}° {angleOff > 0 ? "from right" : "from left"}</span>
                </p>
              </div>
            )}

            {result.exceedsCrosswind && (
              <div className="p-2 border border-destructive/30 bg-destructive/5 rounded-sm">
                <p className="text-[10px] text-destructive">⚠ Crosswind {result.crosswind.toFixed(1)} kt exceeds limit of {xwLimit} kt</p>
              </div>
            )}

            <p className="text-[9px] text-muted-foreground/60 italic">Planning reference only — not for operational decisions</p>
          </div>
        )}
      </div>
    </InstrumentCard>
  );
};

export default CrosswindCalculator;
