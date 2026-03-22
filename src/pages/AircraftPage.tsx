import { useState, useMemo } from "react";
import AppSidebar from "@/components/AppSidebar";
import SectionHeader from "@/components/SectionHeader";
import InstrumentCard from "@/components/InstrumentCard";
import AeroDataTable from "@/components/AeroDataTable";
import { AeroSelect } from "@/components/AeroInput";
import { Search, Download } from "lucide-react";
import {
  aircraftDatabase, helicopterDatabase,
  searchAircraft, searchHelicopters, filterByGroup, filterByCategory,
  type AircraftData, type HelicopterData,
  toFeet, toLbs,
} from "@/data/aircraftDatabase";
import { DATA_LABELS } from "@/lib/engineeringSafety";
import { exportCSV } from "@/lib/exportUtils";

type UnitMode = "metric" | "imperial";

const AircraftPage = () => {
  const [query, setQuery] = useState("");
  const [aacFilter, setAacFilter] = useState("all");
  const [adgFilter, setAdgFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [tab, setTab] = useState<"airplane" | "helicopter">("airplane");
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftData | null>(null);
  const [selectedHeli, setSelectedHeli] = useState<HelicopterData | null>(null);
  const [units, setUnits] = useState<UnitMode>("metric");

  const isMetric = units === "metric";
  const lenUnit = isMetric ? "m" : "ft";
  const massUnit = isMetric ? "kg" : "lbs";
  const fmtLen = (m: number) => isMetric ? m.toFixed(1) : toFeet(m).toFixed(1);
  const fmtMass = (kg: number) => isMetric ? kg.toLocaleString() : toLbs(kg).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const filteredAircraft = useMemo(() => {
    let data = searchAircraft(query, aircraftDatabase);
    data = filterByGroup(data, aacFilter, adgFilter);
    data = filterByCategory(data, catFilter);
    return data;
  }, [query, aacFilter, adgFilter, catFilter]);

  const filteredHeli = useMemo(() => {
    return searchHelicopters(query, helicopterDatabase);
  }, [query]);

  const handleExport = () => {
    if (tab === "airplane") {
      exportCSV("aircraft_database.csv",
        ["ICAO", "Manufacturer", "Model", "Category", `Wingspan (${lenUnit})`, `MTOW (${massUnit})`, "Approach (kt)", `Ref Field Length (${lenUnit})`],
        filteredAircraft.map(a => [a.icao, a.manufacturer, a.model, `${a.aac}-${a.adg} (${a.category})`, fmtLen(a.wingspan_m), fmtMass(a.mtow_kg), a.approachSpeed_kts.toString(), fmtLen(a.refFieldLength_m)])
      );
    } else {
      exportCSV("helicopter_database.csv",
        ["ICAO", "Manufacturer", "Model", "Category", `Rotor Ø (${lenUnit})`, `D-Value (${lenUnit})`, `MTOW (${massUnit})`, "Use", "Heliport Relevance"],
        filteredHeli.map(h => [h.icao, h.manufacturer, h.model, h.category, fmtLen(h.rotorDiameter_m), fmtLen(h.dValue_m), fmtMass(h.mtow_kg), h.typicalUse, h.heliportRelevance])
      );
    }
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SectionHeader
          title="Aircraft & Helicopter Library"
          subtitle="ICAO Doc 8643 Type Designators — Reference / Planning Data"
          action={<button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm"><Download className="w-4 h-4" /> Export CSV</button>}
        />

        <div className="mb-3 flex items-center gap-3">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] border border-primary/20 text-muted-foreground rounded-sm font-mono-data">{DATA_LABELS.referenceMode}</span>
          <div className="flex border border-border rounded-sm overflow-hidden ml-auto">
            <button onClick={() => setUnits("metric")} className={`px-3 py-1 text-[10px] font-mono-data transition-colors ${isMetric ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Metric (m/kg)</button>
            <button onClick={() => setUnits("imperial")} className={`px-3 py-1 text-[10px] font-mono-data transition-colors ${!isMetric ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Imperial (ft/lbs)</button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <InstrumentCard title="Search & Filter">
              <div className="space-y-4">
                <div className="flex border border-border rounded-sm overflow-hidden">
                  <button onClick={() => { setTab("airplane"); setQuery(""); setSelectedAircraft(null); setSelectedHeli(null); }} className={`flex-1 py-1.5 text-xs transition-colors ${tab === "airplane" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Airplanes</button>
                  <button onClick={() => { setTab("helicopter"); setQuery(""); setSelectedAircraft(null); setSelectedHeli(null); }} className={`flex-1 py-1.5 text-xs transition-colors ${tab === "helicopter" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Helicopters</button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Search ICAO, model, use..." value={query} onChange={(e) => setQuery(e.target.value)} className="aero-input w-full pl-9 rounded-sm" />
                </div>
                {tab === "airplane" && (
                  <>
                    <AeroSelect label="Category" value={catFilter} onChange={setCatFilter} options={[{ value: "all", label: "All" }, { value: "commercial", label: "Commercial Jets" }, { value: "regional", label: "Regional" }, { value: "military", label: "Military / Utility" }, { value: "business", label: "Business Jets" }, { value: "utility", label: "Utility" }]} />
                    <AeroSelect label="AAC Group" value={aacFilter} onChange={setAacFilter} options={[{ value: "all", label: "All" }, { value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }, { value: "D", label: "D" }, { value: "E", label: "E" }]} />
                    <AeroSelect label="ADG Group" value={adgFilter} onChange={setAdgFilter} options={[{ value: "all", label: "All" }, { value: "I", label: "I" }, { value: "II", label: "II" }, { value: "III", label: "III" }, { value: "IV", label: "IV" }, { value: "V", label: "V" }, { value: "VI", label: "VI" }]} />
                  </>
                )}
                <p className="text-[10px] text-muted-foreground font-mono-data">
                  {tab === "airplane" ? `${filteredAircraft.length} of ${aircraftDatabase.length} aircraft` : `${filteredHeli.length} of ${helicopterDatabase.length} helicopters`}
                </p>
              </div>
            </InstrumentCard>

            {/* Selected aircraft detail */}
            {tab === "airplane" && selectedAircraft && (
              <InstrumentCard title="Selected — Reference Data" accentColor="primary">
                <div className="space-y-2 text-xs">
                  <p className="text-lg font-display text-foreground">{selectedAircraft.manufacturer} {selectedAircraft.model}</p>
                  <div className="grid grid-cols-2 gap-2 font-mono-data">
                    <div><span className="text-muted-foreground">ICAO:</span> <span className="text-primary">{selectedAircraft.icao}</span></div>
                    <div><span className="text-muted-foreground">Cat:</span> <span className="text-foreground">{selectedAircraft.aac}-{selectedAircraft.adg}</span></div>
                    <div><span className="text-muted-foreground">Wingspan:</span> <span className="text-foreground">{fmtLen(selectedAircraft.wingspan_m)} {lenUnit}</span></div>
                    <div><span className="text-muted-foreground">MTOW:</span> <span className="text-foreground">{fmtMass(selectedAircraft.mtow_kg)} {massUnit}</span></div>
                    <div><span className="text-muted-foreground">Approach:</span> <span className="text-foreground">{selectedAircraft.approachSpeed_kts} kt</span></div>
                    <div><span className="text-muted-foreground">Ref Length:</span> <span className="text-foreground">{fmtLen(selectedAircraft.refFieldLength_m)} {lenUnit}</span></div>
                  </div>
                  <p className="text-muted-foreground mt-2">{selectedAircraft.notes}</p>
                  <div className="text-[9px] text-muted-foreground/50 mt-2 pt-2 border-t border-border">{DATA_LABELS.referenceMode}</div>
                </div>
              </InstrumentCard>
            )}

            {tab === "helicopter" && selectedHeli && (
              <InstrumentCard title="Selected — Reference Data" accentColor="primary">
                <div className="space-y-2 text-xs">
                  <p className="text-lg font-display text-foreground">{selectedHeli.manufacturer} {selectedHeli.model}</p>
                  <div className="grid grid-cols-2 gap-2 font-mono-data">
                    <div><span className="text-muted-foreground">ICAO:</span> <span className="text-primary">{selectedHeli.icao}</span></div>
                    <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{selectedHeli.category}</span></div>
                    <div><span className="text-muted-foreground">Rotor Ø:</span> <span className="text-foreground">{fmtLen(selectedHeli.rotorDiameter_m)} {lenUnit}</span></div>
                    <div><span className="text-muted-foreground">D-Value:</span> <span className="text-foreground">{fmtLen(selectedHeli.dValue_m)} {lenUnit}</span></div>
                    <div><span className="text-muted-foreground">MTOW:</span> <span className="text-foreground">{fmtMass(selectedHeli.mtow_kg)} {massUnit}</span></div>
                    <div><span className="text-muted-foreground">Use:</span> <span className="text-foreground">{selectedHeli.typicalUse}</span></div>
                  </div>
                  <p className="text-muted-foreground mt-1"><strong>Heliport:</strong> {selectedHeli.heliportRelevance}</p>
                  <p className="text-muted-foreground">{selectedHeli.notes}</p>
                  <div className="text-[9px] text-muted-foreground/50 mt-2 pt-2 border-t border-border">{DATA_LABELS.referenceMode}</div>
                </div>
              </InstrumentCard>
            )}
          </div>

          <div className="col-span-12 lg:col-span-9">
            {tab === "airplane" ? (
              <InstrumentCard title="Aircraft Database">
                <div className="border border-border rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/50">
                        {["Aircraft", "ICAO", "Category", `Wingspan (${lenUnit})`, `MTOW (${massUnit})`, "Approach (kt)", `Ref Field (${lenUnit})`].map((col, i) => (
                          <th key={i} className="px-4 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAircraft.map((a, ri) => (
                        <tr key={a.icao + ri} onClick={() => setSelectedAircraft(a)} className={`border-t border-border cursor-pointer transition-colors ${selectedAircraft?.icao === a.icao ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                          <td className="px-4 py-2.5 text-xs text-foreground/90">{a.manufacturer} {a.model}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-primary">{a.icao}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{a.aac}-{a.adg}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{fmtLen(a.wingspan_m)}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{fmtMass(a.mtow_kg)}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{a.approachSpeed_kts}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{fmtLen(a.refFieldLength_m)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InstrumentCard>
            ) : (
              <InstrumentCard title="Helicopter Database">
                <div className="border border-border rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/50">
                        {["Helicopter", "ICAO", "Category", `Rotor Ø (${lenUnit})`, `D-Value (${lenUnit})`, `MTOW (${massUnit})`, "Use"].map((col, i) => (
                          <th key={i} className="px-4 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHeli.map((h, ri) => (
                        <tr key={h.icao + ri} onClick={() => setSelectedHeli(h)} className={`border-t border-border cursor-pointer transition-colors ${selectedHeli?.icao === h.icao ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                          <td className="px-4 py-2.5 text-xs text-foreground/90">{h.manufacturer} {h.model}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-primary">{h.icao}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80 capitalize">{h.category}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{fmtLen(h.rotorDiameter_m)}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{fmtLen(h.dValue_m)}</td>
                          <td className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">{fmtMass(h.mtow_kg)}</td>
                          <td className="px-4 py-2.5 text-xs text-foreground/70">{h.typicalUse}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InstrumentCard>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AircraftPage;
