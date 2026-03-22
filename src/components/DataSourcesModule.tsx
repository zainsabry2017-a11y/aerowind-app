import { useState } from "react";
import InstrumentCard from "./InstrumentCard";
import FileUploadZone from "./FileUploadZone";
import DataValidationReport from "./DataValidationReport";
import type { ParsedWindData } from "@/lib/windDataParser";
import { parsePublicData, fetchAndParseMeteostat, type NormalizedPublicData } from "@/lib/publicWeatherParser";
import { Download, Database, CheckCircle2, MapPin } from "lucide-react";
import { STATION_DATABASE, type WeatherStation } from "@/data/stationsDatabase";

interface DataSourcesModuleProps {
  onFile: (file: File) => void;
  parsedData: ParsedWindData | null;
  isLoading: boolean;
  error: string | null;
  onLoadSample?: (index: number) => void;
  samplePresets?: { label: string }[];
  onDataAccepted?: (data: ParsedWindData) => void;
}

export default function DataSourcesModule({ onFile, parsedData, isLoading, error, onLoadSample, samplePresets, onDataAccepted }: DataSourcesModuleProps) {
  const [provider, setProvider] = useState<"official" | "ogimet" | "meteostat">("official");
  const [sourceType, setSourceType] = useState<"manual" | "template" | "rp5">("manual");

  const [ogiIcao, setOgiIcao] = useState("");
  const [ogiStation, setOgiStation] = useState("");
  const [ogiLatLon, setOgiLatLon] = useState("");
  const [ogiText, setOgiText] = useState("");

  const [metCity, setMetCity] = useState("");
  const [metCountry, setMetCountry] = useState("");
  const [metLatLon, setMetLatLon] = useState("");
  const [metStartDate, setMetStartDate] = useState("");
  const [metEndDate, setMetEndDate] = useState("");
  const [metText, setMetText] = useState("");

  const [publicParsedData, setPublicParsedData] = useState<NormalizedPublicData | null>(null);
  const [publicParsing, setPublicParsing] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  // Geo-locator States
  const [locatorResults, setLocatorResults] = useState<(WeatherStation & { distance: number })[]>([]);
  const [locatorError, setLocatorError] = useState("");
  const [locatorActiveMode, setLocatorActiveMode] = useState<"ogimet" | "meteostat" | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const handleLocateStations = (sourceType: "ogimet" | "meteostat") => {
    setLocatorError("");
    setLocatorResults([]);
    setLocatorActiveMode(sourceType);
    
    let coordsStr = sourceType === "meteostat" ? metLatLon : ogiLatLon;
    
    // Universal Coordinate Parser (Decimal & WGS-84 DMS)
    const parseCoordinates = (input: string): [number, number] | null => {
      const dmsRegex = /(\d+)[^\d]+(\d+)(?:[^\d]+([\d.]+))?[^NSEW]*([NSEW])/gi;
      const matches = [...input.matchAll(dmsRegex)];

      if (matches.length >= 2) {
        const parseMatch = (m: RegExpMatchArray) => {
          const deg = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          const sec = m[3] ? parseFloat(m[3]) : 0;
          let val = deg + min / 60 + sec / 3600;
          const dir = m[4].toUpperCase();
          if (dir === 'S' || dir === 'W') val = -val;
          return { val, dir };
        };

        const p1 = parseMatch(matches[0]);
        const p2 = parseMatch(matches[1]);

        const latMatch = [p1, p2].find(p => p.dir === 'N' || p.dir === 'S');
        const lonMatch = [p1, p2].find(p => p.dir === 'E' || p.dir === 'W');

        if (latMatch && lonMatch) return [latMatch.val, lonMatch.val];
      }

      const parts = input.replace(/[()]/g, '').split(/[,;\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        const nums = parts.map(p => {
          let num = parseFloat(p);
          if (isNaN(num)) return NaN;
          if (p.toUpperCase().includes('S') || p.toUpperCase().includes('W')) num = -Math.abs(num);
          return num;
        });
        if (!isNaN(nums[0]) && !isNaN(nums[1])) return [nums[0], nums[1]];
      }
      return null;
    };

    const parsedCoords = parseCoordinates(coordsStr);

    if (!parsedCoords) {
      setLocatorError("Please enter valid coordinates first (e.g. 51.4, -0.4 or 20°46'51\"N 45°50'47\"E)");
      return;
    }
    
    const [lat, lon] = parsedCoords;
    const candidates = STATION_DATABASE.filter(s => s.source_type === "both" || s.source_type === sourceType);
    
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      return R * c;
    };

    const distances = candidates.map(s => ({
      ...s,
      distance: calculateDistance(lat, lon, s.lat, s.lon)
    })).sort((a, b) => a.distance - b.distance);
    
    setLocatorResults(distances.slice(0, 3));
  };

  const handleSelectStation = (st: WeatherStation & { distance: number }, mode: "ogimet" | "meteostat") => {
    if (mode === "ogimet") {
      setOgiIcao(st.id);
      setOgiStation(`${st.name}`);
      setOgiLatLon(`${st.lat.toFixed(4)}, ${st.lon.toFixed(4)}`);
    } else {
      setMetCity(`${st.name}`);
      setMetCountry(st.country);
      setMetLatLon(`${st.lat.toFixed(4)}, ${st.lon.toFixed(4)}`);
    }
    setSelectedStationId(st.id);
    // Keep list visible so user can see the selection was applied
  };

  // ── Inline station results renderer (plain function, NOT a React component)
  // Using a component defined inside render causes React to remount it on every
  // state change (new function reference = new component type). Inlining as a
  // function avoids this and guarantees the Applied badge stays visible.
  const renderStationResults = (mode: "ogimet" | "meteostat") => {
    if (locatorActiveMode !== mode) return null;
    return (
      <div className="pt-2">
        {locatorError && <p className="text-[10px] text-destructive mb-2">{locatorError}</p>}
        {locatorResults.length > 0 && (
          <div className="border border-primary/20 rounded-sm bg-primary/5 p-3 space-y-2">
            <span className="text-[10px] uppercase font-mono-data text-muted-foreground block mb-2">Top 3 Nearest Stations Detected:</span>
            {locatorResults.map((st, i) => {
              const isSelected = selectedStationId === st.id;
              return (
                <div key={i} className={`flex items-center justify-between p-2 border rounded-sm transition-colors ${
                  isSelected ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-background border-border hover:border-primary/50'
                }`}>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-foreground">{st.name} ({st.id})</span>
                    <span className="text-[10px] font-mono-data text-muted-foreground">{st.country} — {st.distance.toFixed(1)} km away</span>
                  </div>
                  {isSelected ? (
                    <span className="px-3 py-1 bg-emerald-600/80 text-white text-[10px] rounded-sm font-mono-data uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Applied
                    </span>
                  ) : (
                    <button onClick={() => handleSelectStation(st, mode)} className="px-3 py-1 bg-primary text-primary-foreground text-[10px] rounded-sm font-mono-data uppercase tracking-wider hover:bg-primary/90 transition-colors">Select</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handleParsePublic = async (type: "ogimet" | "meteostat") => {
    setPublicParsing(true);
    setPublicError(null);
    setPublicParsedData(null);
    try {
      const txt = type === "ogimet" ? ogiText : metText;
      const stn = type === "ogimet" ? ogiStation : metCity;
      const id = type === "ogimet" ? ogiIcao : "";
      const data = await parsePublicData(txt, type, stn, id);
      setPublicParsedData(data);
    } catch (e: any) {
      setPublicError(e.message);
    } finally {
      setPublicParsing(false);
    }
  };

  const handleFetchMeteostat = async () => {
    setPublicParsing(true);
    setPublicError(null);
    setPublicParsedData(null);
    try {
      const data = await fetchAndParseMeteostat(metCity, metCountry, metLatLon, metStartDate, metEndDate);
      setPublicParsedData(data);
    } catch (e: any) {
      setPublicError(e.message);
    } finally {
      setPublicParsing(false);
    }
  };

  const handleAcceptLayout = () => {
    if (!publicParsedData) return;
    
    if (parsedData && (!parsedData.sourceType || parsedData.sourceType === "official")) {
      if (!confirm("Official engineering data is currently active.\nAre you sure you want to switch to a public/planning dataset?")) {
        return;
      }
    }

    const converted: ParsedWindData = {
      records: publicParsedData.records.map((r: any) => ({
        observation_date: r.observation_date,
        observation_time: r.observation_time,
        wind_direction_deg: r.wind_direction_deg ?? 0,
        wind_speed_kt: r.wind_speed_kt ?? 0,
        wind_gust_kt: r.wind_gust_kt,
        isCalm: (r.wind_speed_kt ?? 0) === 0,
        isValid: true,
        raw: {}
      })),
      totalRows: publicParsedData.totalRows,
      validRows: publicParsedData.validRows,
      invalidRows: publicParsedData.rejectedRows,
      missingValues: 0,
      dateRange: publicParsedData.dateRange,
      datasetType: "unknown",
      reliability: publicParsedData.reliabilityClass === "High" ? "high" : publicParsedData.reliabilityClass === "Moderate" ? "medium" : "low",
      reliabilityReasons: publicParsedData.warnings,
      columns: { date: "date", time: "time", direction: "dir", speed: "spd", gust: "gst" },
      warnings: [`Source: ${publicParsedData.source_name} (${publicParsedData.station_name})`, "⚠ Public data is for planning support only. Official meteorological data remains preferred for formal reporting."],
      sourceType: publicParsedData.source_type,
      sourceName: publicParsedData.source_name,
      stationName: publicParsedData.station_name
    };

    if (onDataAccepted) {
      onDataAccepted(converted);
    } else {
      alert("Application engine is not configured to receive this dataset directly yet.");
    }

    setPublicParsedData(null);
    setOgiText("");
    setMetText("");
  };

  const handleProviderChange = (p: any) => {
    setProvider(p);
    setPublicParsedData(null);
    setPublicError(null);
  };

  const handleDownloadTemplate = () => {
    const csvContent = "observation_date,observation_time,wind_direction_deg,wind_speed_kt,wind_gust_kt\n2025-01-01,00:00,360,15,20\n2025-01-01,01:00,090,5,";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Standard_Aerodrome_Wind_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {parsedData && (
        <div className={`p-4 rounded-sm border ${parsedData.sourceType && parsedData.sourceType !== 'official' ? 'border-warning/50 bg-warning/10' : 'border-emerald-500/50 bg-emerald-500/10'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                <CheckCircle2 className={`w-3.5 h-3.5 ${parsedData.sourceType && parsedData.sourceType !== 'official' ? 'text-warning' : 'text-emerald-500'}`} />
                <span className={parsedData.sourceType && parsedData.sourceType !== 'official' ? 'text-warning' : 'text-emerald-600 dark:text-emerald-400'}>
                  Active Dataset: {parsedData.sourceName || "Official Meteorological Data"}
                </span>
              </h4>
              <p className="text-[10px] font-mono-data text-muted-foreground ml-5.5">{parsedData.stationName || "Uploaded File Source"}</p>
            </div>
            {parsedData.sourceType && parsedData.sourceType !== 'official' && (
              <span className="px-2 py-0.5 rounded-sm bg-warning/20 text-warning text-[9px] font-bold uppercase tracking-wider border border-warning/30">
                Planning Use Only
              </span>
            )}
          </div>
          {parsedData.sourceType && parsedData.sourceType !== "official" && (
            <div className="mt-3 ml-5.5 text-[10px] text-warning/90 flex flex-col gap-0.5 border-l-2 border-warning/30 pl-2">
              <span>⚠ Public/archive data is suitable for planning support only.</span>
              <span>Official meteorological data remains preferred for formal engineering reporting.</span>
            </div>
          )}
        </div>
      )}

      <InstrumentCard title="Meteorological Data Source" accentColor="primary">
        
        {/* ── PHASE 1: TOP-LEVEL PROVIDER SELECTOR ── */}
        <div className="flex flex-col md:flex-row gap-2 mb-6 bg-secondary/10 p-1.5 rounded-sm border border-border">
          {[
            { id: "official", label: "Official Meteorological Data", desc: "Preferred Engineering Source" },
            { id: "ogimet", label: "Aviation METAR Data (Ogimet)", desc: "Aviation-oriented public source for planning" },
            { id: "meteostat", label: "Public Weather Data (Meteostat)", desc: "Public weather source for early-stage planning" }
          ].map(prov => (
            <button
              key={prov.id}
              onClick={() => handleProviderChange(prov.id)}
              className={`flex-1 flex flex-col items-center justify-center p-2 rounded-sm border transition-all ${provider === prov.id ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-transparent hover:border-border hover:bg-secondary/30"}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-center">{prov.label}</span>
              <span className={`text-[9px] mt-1 text-center font-mono-data opacity-80 ${(provider === prov.id) ? "text-primary-foreground/80" : ""}`}>{prov.desc}</span>
            </button>
          ))}
        </div>

        {/* ── BRANCH A: OFFICIAL DATA (EXISTING SAFE UPLOADER) ── */}
        {provider === "official" && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-4 p-2 bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-mono-data">
              ✓ Formal Upload Branch Active. Data processed here is validated for aerodynamic compliance.
            </div>
            
            <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto pb-1 custom-scrollbar">
          <button onClick={() => setSourceType("manual")} className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] font-mono-data border-b-2 transition-colors whitespace-nowrap ${sourceType === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"}`}>Manual Upload</button>
          <button onClick={() => setSourceType("template")} className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] font-mono-data border-b-2 transition-colors whitespace-nowrap ${sourceType === "template" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"}`}>Template</button>
          <button onClick={() => setSourceType("rp5")} className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] font-mono-data border-b-2 transition-colors whitespace-nowrap ${sourceType === "rp5" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"}`}>RP5 Historical</button>
        </div>

        {sourceType === "manual" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">Upload standard CSV, TXT, or Excel files. The engine will auto-detect observation date, time, wind direction, speed, and gusts.</p>
            <FileUploadZone title="Upload manual dataset" accept=".csv,.txt,.xlsx,.xls" onFile={onFile} />
          </div>
        )}

        {sourceType === "template" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">Download the strict engineering template to guarantee 100% accurate column mapping. Fill the template and re-upload.</p>
            <button onClick={handleDownloadTemplate} className="w-full flex items-center justify-center gap-2 py-2 border border-primary/50 hover:bg-primary/10 text-primary text-sm rounded-sm transition-colors">
              <Download className="w-4 h-4" /> Download Strict Template (.csv)
            </button>
            <FileUploadZone title="Upload populated template" accept=".csv" onFile={onFile} />
          </div>
        )}

        {sourceType === "rp5" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">Import historical weather archives directly from <a href="https://rp5.ru" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">RP5.ru</a>. The parsing engine will automatically detect and translate RP5's localized syntax formats.</p>
            <FileUploadZone title="Upload RP5 archive (.xls, .csv)" accept=".xls,.xlsx,.csv" onFile={onFile} />
          </div>
        )}
        
        {isLoading && (
          <div className="mt-4 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-progress-load" />
          </div>
        )}
        
        {error && <p className="mt-3 text-[11px] font-mono-data text-destructive border-l-2 border-destructive pl-2 py-1 bg-destructive/5 rounded-r-sm">{error}</p>}

        {onLoadSample && samplePresets && samplePresets.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border space-y-2">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Simulated Data Loaders</p>
            <div className="flex flex-col gap-1.5">
              {samplePresets.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 bg-background border border-border rounded-sm text-[11px] font-mono-data">
                  <span className="text-foreground">{p.label}</span>
                  <button onClick={() => onLoadSample(i)} className="px-3 py-1 border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-sm transition-colors">Load</button>
                </div>
              ))}
            </div>
          </div>
        )}
          </div>
        )}

        {/* ── BRANCH B: OGIMET METAR (PLACEHOLDER) ── */}
        {provider === "ogimet" && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div className="mb-4 p-2 bg-warning/10 border-l-2 border-warning text-warning text-xs font-mono-data">
              ⚠ Planning Support Only. Public METAR sequences do not replace official climatological surveys.
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 md:col-span-1 border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">ICAO Code</label>
                <input type="text" value={ogiIcao} onChange={e => setOgiIcao(e.target.value)} placeholder="e.g. KJFK" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm font-mono-data uppercase" />
              </div>
              <div className="col-span-2 md:col-span-2 border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Station Name (Optional)</label>
                <input type="text" value={ogiStation} onChange={e => setOgiStation(e.target.value)} placeholder="Kennedy International" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1 border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Lat / Lon (Opt)</label>
                <input type="text" value={ogiLatLon} onChange={e => setOgiLatLon(e.target.value)} placeholder="40.6,-73.7" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm font-mono-data" />
              </div>
            </div>

            <div className="flex justify-end mt-1">
              <button onClick={() => handleLocateStations("ogimet")} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono-data border border-primary/40 text-primary hover:bg-primary/10 rounded-sm transition-colors">
                <MapPin className="w-3.5 h-3.5" /> Auto Detect Nearest Station
              </button>
            </div>
            
            {renderStationResults("ogimet")}

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Start Date</label>
                <input type="date" aria-label="Start Date" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm text-foreground" />
              </div>
              <div className="border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">End Date</label>
                <input type="date" aria-label="End Date" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm text-foreground" />
              </div>
            </div>
            
            <div className="border border-border rounded-sm p-3">
              <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2 block">Paste Raw Ogimet Data (Tabular)</label>
              <textarea value={ogiText} onChange={e => setOgiText(e.target.value)} className="w-full h-32 bg-background border border-border focus:border-primary outline-none p-2 text-xs font-mono-data resize-vertical" placeholder="YYYY-MM-DD, HH:MM, Dir, Speed..."></textarea>
            </div>
            
            <button onClick={() => handleParsePublic("ogimet")} disabled={publicParsing || !ogiText.trim()} className="w-full py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium disabled:opacity-50 transition-colors">
              {publicParsing ? "Parsing & Validating..." : "Parse & Normalize Aviation Data"}
            </button>
            
            {publicError && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-sm border-l-2 border-destructive">{publicError}</p>}
            
            {!publicParsedData && !publicError && (
              <div className="mt-6 border border-dashed border-primary/50 bg-primary/5 p-4 rounded-sm flex flex-col items-center justify-center text-center space-y-2 opacity-60">
                <Database className="w-8 h-8 text-primary/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">Aviation Integration Preview</p>
                <p className="text-[10px] font-mono-data text-muted-foreground mt-2 uppercase tracking-wide">Awaiting Data Parse</p>
              </div>
            )}
          </div>
        )}

        {/* ── BRANCH C: METEOSTAT PUBLIC WEATHER (PLACEHOLDER) ── */}
        {provider === "meteostat" && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div className="mb-4 p-2 bg-warning/10 border-l-2 border-warning text-warning text-xs font-mono-data">
              ⚠ Early-Stage Planning Only. Public weather models interpolate data and may hallucinate localized phenomena.
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 md:col-span-2 border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Station / City</label>
                <input type="text" value={metCity} onChange={e => setMetCity(e.target.value)} placeholder="e.g. London Heathrow" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1 border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Country</label>
                <input type="text" value={metCountry} onChange={e => setMetCountry(e.target.value)} placeholder="UK" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1 border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Lat / Lon (Opt)</label>
                <input type="text" value={metLatLon} onChange={e => setMetLatLon(e.target.value)} placeholder="51.4,-0.4" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm font-mono-data" />
              </div>
            </div>

            <div className="flex justify-end mt-1">
              <button onClick={() => handleLocateStations("meteostat")} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono-data border border-primary/40 text-primary hover:bg-primary/10 rounded-sm transition-colors">
                <MapPin className="w-3.5 h-3.5" /> Auto Detect Nearest Station
              </button>
            </div>
            
            {renderStationResults("meteostat")}

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Start Date *</label>
                <input type="date" value={metStartDate} onChange={e => setMetStartDate(e.target.value)} aria-label="Start Date" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm text-foreground" />
              </div>
              <div className="border border-border rounded-sm p-3 space-y-1">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">End Date *</label>
                <input type="date" value={metEndDate} onChange={e => setMetEndDate(e.target.value)} aria-label="End Date" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 text-sm text-foreground" />
              </div>
            </div>

            <button onClick={handleFetchMeteostat} disabled={publicParsing || !metStartDate || !metEndDate || (!metCity && !metLatLon)} className="w-full py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium disabled:opacity-50 transition-colors shadow-sm">
              {publicParsing ? "Connecting to Global Meteorological Grid..." : "Auto-Fetch Historical Model Data"}
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-[10px] tracking-wider uppercase text-muted-foreground">Or Paste Raw Data</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="border border-border rounded-sm p-3">
              <label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2 block">Paste Raw Meteostat Data (Tabular)</label>
              <textarea value={metText} onChange={e => setMetText(e.target.value)} className="w-full h-24 bg-background border border-border focus:border-primary outline-none p-2 text-xs font-mono-data resize-vertical" placeholder="YYYY-MM-DD, HH:MM, Dir, Speed..."></textarea>
            </div>
            
            <button onClick={() => handleParsePublic("meteostat")} disabled={publicParsing || !metText.trim()} className="w-full py-2 bg-transparent border border-primary text-primary hover:bg-primary/10 rounded-sm text-sm font-medium disabled:opacity-50 transition-colors">
              {publicParsing ? "Parsing & Validating..." : "Parse & Normalize Manually"}
            </button>
            
            {publicError && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-sm border-l-2 border-destructive">{publicError}</p>}

            {!publicParsedData && !publicError && (
              <div className="mt-6 border border-dashed border-primary/50 bg-primary/5 p-4 rounded-sm flex flex-col items-center justify-center text-center space-y-2 opacity-60">
                <Database className="w-8 h-8 text-primary/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">Global Weather Model Preview</p>
                <p className="text-[10px] font-mono-data text-muted-foreground mt-2 uppercase tracking-wide">Awaiting Data Parse</p>
              </div>
            )}
          </div>
        )}

        {/* ── SHARED PUBLIC DATA PREVIEW PANEL ── */}
        {publicParsedData && provider !== "official" && (
          <div className="mt-8 border-t border-border pt-6 animate-in fade-in duration-500">
            <h3 className="text-sm font-serif-report text-foreground mb-4">Normalization Preview & Validation</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-secondary/20 rounded-sm border border-border">
                <span className="block text-[10px] text-muted-foreground uppercase opacity-70">Source</span>
                <span className="text-xs font-mono-data text-foreground">{publicParsedData.source_name}</span>
              </div>
              <div className="p-3 bg-secondary/20 rounded-sm border border-border">
                <span className="block text-[10px] text-muted-foreground uppercase opacity-70">Station</span>
                <span className="text-[10px] truncate block font-mono-data text-foreground">{publicParsedData.station_name}</span>
              </div>
              <div className="p-3 bg-secondary/20 rounded-sm border border-border">
                <span className="block text-[10px] text-muted-foreground uppercase opacity-70">Extraction Yield</span>
                <span className="text-xs font-mono-data text-foreground">{publicParsedData.validRows} / {publicParsedData.totalRows} ({((publicParsedData.validRows/publicParsedData.totalRows)*100).toFixed(1)}%)</span>
              </div>
              <div className="p-3 bg-secondary/20 rounded-sm border border-border">
                <span className="block text-[10px] text-muted-foreground uppercase opacity-70">Reliability Class</span>
                <span className={`text-xs font-bold font-mono-data ${publicParsedData.reliabilityClass === "High" ? "text-emerald-500" : publicParsedData.reliabilityClass === "Moderate" ? "text-amber-500" : "text-destructive"}`}>{publicParsedData.reliabilityClass.toUpperCase()}</span>
              </div>
            </div>

            {publicParsedData.warnings.length > 0 && (
              <div className="mb-6 p-3 bg-warning/10 border-l-2 border-warning text-xs space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                <span className="font-semibold text-warning block mb-2">Parsing Warnings ({publicParsedData.warnings.length})</span>
                {publicParsedData.warnings.map((w, i) => <p key={i} className="text-warning/90 font-mono-data">{w}</p>)}
              </div>
            )}

            <div className="border border-border rounded-sm overflow-hidden mb-6">
              <table className="w-full text-left text-xs font-mono-data">
                <thead className="bg-secondary/30 text-[10px] text-muted-foreground uppercase">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Time</th>
                    <th className="p-2 text-right">Dir (°)</th>
                    <th className="p-2 text-right">Spd (kt)</th>
                    <th className="p-2 text-right">Gust (kt)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {publicParsedData.records.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/10">
                      <td className="p-2 text-foreground">{r.observation_date}</td>
                      <td className="p-2 text-foreground">{r.observation_time || "—"}</td>
                      <td className="p-2 text-right text-foreground">{r.wind_direction_deg ?? "—"}</td>
                      <td className="p-2 text-right text-foreground">{r.wind_speed_kt ?? "—"}</td>
                      <td className="p-2 text-right text-muted-foreground">{r.wind_gust_kt ?? "—"}</td>
                    </tr>
                  ))}
                  {publicParsedData.records.length > 5 && (
                    <tr><td colSpan={5} className="p-2 text-center text-[10px] text-muted-foreground bg-secondary/10 border-t border-border">... and {publicParsedData.records.length - 5} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={handleAcceptLayout} className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-sm transition-all hover:bg-primary/90">
              <CheckCircle2 className="w-4 h-4" /> Accept for Analysis Later
            </button>
          </div>
        )}

      </InstrumentCard>

      {/* Validation Report Mount */}
      {parsedData && <DataValidationReport data={parsedData} />}
    </div>
  );
}
