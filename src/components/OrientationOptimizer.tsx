import { useMemo } from "react";
import { ArrowDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { WindRecord } from "@/lib/windDataParser";
import InstrumentCard from "@/components/InstrumentCard";

interface OrientationOptimizerProps {
  records: WindRecord[];
  limit: number;
  mode: "airport" | "heliport" | "water";
}

export function OrientationOptimizer({ records, limit, mode }: OrientationOptimizerProps) {
  // 1) Compute usability for 0-359
  const curve = useMemo(() => {
    const valid = records.filter(r => r.isValid);
    const total = valid.length;
    if (total === 0) return [];

    return Array.from({ length: 360 }, (_, theta) => {
      let usable = 0;
      for (const r of valid) {
        if (r.isCalm || r.wind_speed_kt === 0) {
          usable++;
          continue;
        }

        let diff = Math.abs(r.wind_direction_deg - theta);
        if (diff > 180) diff = 360 - diff;

        const crosswind = r.wind_speed_kt * Math.sin((diff * Math.PI) / 180);
        
        if (crosswind <= limit) {
          usable++;
        }
      }
      return { theta, usability: (usable / total) * 100 };
    });
  }, [records, limit]);

  // 2) Derive optimal endpoints
  const { optimal, secondary } = useMemo(() => {
    if (curve.length === 0) return { optimal: null, secondary: null };

    // find absolute max
    let maxIter = curve[0];
    for (const c of curve) {
      if (c.usability > maxIter.usability) {
        maxIter = c;
      }
    }

    // find secondary peak (must be offset by at least 30 degrees)
    let secIter = null;
    for (const c of curve) {
      let diff = Math.abs(c.theta - maxIter.theta);
      if (diff > 180) diff = 360 - diff;
      
      // Also ignore exact reciprocal as secondary peak, it's virtually identical in standard metrics
      if (diff >= 30 && diff <= 150) {
        if (!secIter || c.usability > secIter.usability) {
          secIter = c;
        }
      }
    }

    return { optimal: maxIter, secondary: secIter };
  }, [curve]);

  if (curve.length === 0 || !optimal) return null;

  const isPass = optimal.usability >= 95;

  // 3) SVG Generation Parameters
  const W = 600;
  const H = 200;
  const PAD_X = 40;
  const PAD_Y = 20;

  // find min/max for Y axis mapping (limit to 100% top, floor to nearest 10 below min)
  let minU = Math.min(...curve.map(c => c.usability));
  minU = Math.floor(minU / 10) * 10;
  // ensure we don't zoom in so tight that a 99-100% curve looks dramatic
  if (100 - minU < 15) minU = 80;

  const mapX = (theta: number) => PAD_X + (theta / 359) * (W - PAD_X * 2);
  const mapY = (u: number) => H - PAD_Y - ((u - minU) / (100 - minU)) * (H - PAD_Y * 2);

  const pointsString = curve.map(c => `${mapX(c.theta)},${mapY(c.usability)}`).join(" ");

  const y95 = mapY(95);

  return (
    <InstrumentCard title={`Optimization Solver Layout — ${mode.toUpperCase()} LIMIT: ${limit} kt`} className="mt-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Metric Outputs */}
        <div className="md:col-span-1 space-y-4">
          <div className="p-3 bg-primary/10 border-l-2 border-primary rounded-r">
            <span className="text-[10px] uppercase text-muted-foreground font-mono-data tracking-wider">Optimal Heading</span>
            <div className="text-2xl font-display text-primary mt-1">
              {String(optimal.theta).padStart(3, "0")}° <span className="text-sm opacity-50 font-normal">/ {String((optimal.theta + 180) % 360).padStart(3, "0")}°</span>
            </div>
          </div>

          <div className={`p-3 border-l-2 rounded-r ${isPass ? 'bg-emerald-500/10 border-emerald-500' : 'bg-red-500/10 border-red-500'}`}>
            <span className="text-[10px] uppercase text-muted-foreground font-mono-data tracking-wider">Max Yield Capacity</span>
            <div className={`text-2xl font-display mt-1 ${isPass ? 'text-emerald-500' : 'text-red-500'} flex items-center justify-between`}>
              {optimal.usability.toFixed(2)}%
              {isPass ? <CheckCircle2 className="w-5 h-5 opacity-50" /> : <AlertTriangle className="w-5 h-5 opacity-50" />}
            </div>
            <div className="text-[10px] mt-1 font-mono-data text-muted-foreground">
              {isPass ? 'Meets ICAO ≥95% requirement' : `Fails single ${mode === 'heliport' ? 'FATO' : mode === 'water' ? 'channel' : 'runway'} requirement`}
            </div>
          </div>

          {secondary && (
            <div className="p-3 border border-border bg-card rounded-sm shadow-sm">
              <span className="text-[10px] uppercase text-muted-foreground font-mono-data tracking-wider">Alt Alignment Peak</span>
              <div className="text-lg font-display text-foreground mt-1">
                {String(secondary.theta).padStart(3, "0")}° / {String((secondary.theta + 180) % 360).padStart(3, "0")}°
              </div>
              <div className="text-[11px] font-mono-data text-muted-foreground mt-0.5">Yield: {secondary.usability.toFixed(2)}%</div>
            </div>
          )}
        </div>

        {/* SVG Curve Matrix */}
        <div className="md:col-span-3 border border-border bg-zinc-950 rounded-sm relative shadow-inner overflow-x-auto">
          <div className="min-w-[500px] h-[220px]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full text-muted-foreground overflow-visible">
              
              {/* Background scale hashes */}
              {[minU, (minU + 100) / 2, 100].map((u) => (
                <g key={u}>
                  <line x1={PAD_X} x2={W - PAD_X} y1={mapY(u)} y2={mapY(u)} stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" />
                  <text x={PAD_X - 8} y={mapY(u) + 3} fontSize="10" textAnchor="end" fill="currentColor" opacity="0.6">
                    {u.toFixed(0)}%
                  </text>
                </g>
              ))}

              {/* 95% Threshold Line */}
              {100 >= 95 && minU <= 95 && (
                <g>
                  <line x1={PAD_X} x2={W - PAD_X} y1={y95} y2={y95} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
                  <text x={W - PAD_X + 6} y={y95 + 3} fontSize="10" fill="#ef4444" opacity="0.8">95%</text>
                </g>
              )}

              {/* Angle X-Axis Labels */}
              {[0, 60, 120, 180, 240, 300, 360].map(deg => {
                 let dStr = deg === 360 ? "0" : deg;
                 return (
                   <g key={deg}>
                     <line x1={mapX(deg === 360 ? 359 : deg)} x2={mapX(deg === 360 ? 359 : deg)} y1={H - PAD_Y} y2={H - PAD_Y + 4} stroke="currentColor" opacity="0.3" />
                     <text x={mapX(deg === 360 ? 359 : deg)} y={H - PAD_Y + 14} fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">{dStr}°</text>
                   </g>
                 )
              })}

              {/* The Yield Curve */}
              <polyline 
                points={pointsString} 
                fill="none" 
                stroke="var(--color-primary, #0ea5e9)" 
                strokeWidth="2.5" 
                strokeLinejoin="round" 
              />

              {/* Optimal Peak Pin */}
              <g transform={`translate(${mapX(optimal.theta)}, ${mapY(optimal.usability)})`}>
                 <circle r="4" fill="var(--color-primary, #0ea5e9)" />
                 <line x1="0" y1="0" x2="0" y2="25" stroke="var(--color-primary, #0ea5e9)" strokeWidth="1.5" opacity="0.6" />
                 <text x="0" y="-10" fontSize="12" fill="white" fontWeight="bold" textAnchor="middle">{optimal.theta}°</text>
              </g>

            </svg>
          </div>
          
          <div className="absolute top-2 left-3 flex items-center gap-2">
            <span className="w-3 h-0.5 bg-primary rounded-full"></span>
            <span className="text-[10px] font-mono-data uppercase tracking-widest text-muted-foreground">360° Usability Yield Sequence</span>
          </div>
        </div>
      </div>
    </InstrumentCard>
  );
}
