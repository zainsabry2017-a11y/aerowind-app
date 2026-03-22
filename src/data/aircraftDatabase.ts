// ── ICAO Aircraft & Helicopter Database ────────────────
// Reference: ICAO Doc 8643 (Aircraft Type Designators)
// All dimensions in METRIC (metres, kg, knots)
// WARNING: Planning reference only — not operational performance

export interface AircraftData {
  icao: string;
  manufacturer: string;
  model: string;
  aac: string;          // Aeroplane Approach Category (A–E)
  adg: string;          // Aerodrome Design Group (I–VI)
  tdg: string;          // Taxiway Design Group
  wingspan_m: number;
  length_m: number;
  gearWidth_m: number;
  mtow_kg: number;
  approachSpeed_kts: number;
  refFieldLength_m: number;  // Typical reference field length (planning)
  category: "commercial" | "regional" | "military" | "business" | "utility";
  notes: string;
}

export interface HelicopterData {
  icao: string;
  manufacturer: string;
  model: string;
  rotorDiameter_m: number;
  dValue_m: number;       // D-value (overall length incl. rotors)
  length_m: number;       // fuselage length
  mtow_kg: number;
  approachSpeed_kts: number;
  category: "light" | "medium" | "heavy";
  typicalUse: string;
  heliportRelevance: string;
  notes: string;
}

// ── Unit conversion helpers ────────────────────────────
export const M_TO_FT = 3.28084;
export const FT_TO_M = 0.3048;
export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 0.453592;
export const KTS_TO_MS = 0.514444;
export const MS_TO_KTS = 1.94384;

export function toFeet(m: number): number { return m * M_TO_FT; }
export function toMetres(ft: number): number { return ft * FT_TO_M; }
export function toLbs(kg: number): number { return kg * KG_TO_LBS; }
export function toKg(lbs: number): number { return lbs * LBS_TO_KG; }
export function toMs(kts: number): number { return kts * KTS_TO_MS; }
export function toKts(ms: number): number { return ms * MS_TO_KTS; }

// ── Commercial Jets ───────────────────────────────────
export const aircraftDatabase: AircraftData[] = [
  // Category 1 — Commercial Jets
  { icao: "A319", manufacturer: "Airbus", model: "A319-100", aac: "C", adg: "III", tdg: "5", wingspan_m: 34.1, length_m: 33.8, gearWidth_m: 7.8, mtow_kg: 75500, approachSpeed_kts: 134, refFieldLength_m: 1850, category: "commercial", notes: "Short-range narrow-body" },
  { icao: "A320", manufacturer: "Airbus", model: "A320-200", aac: "C", adg: "III", tdg: "5", wingspan_m: 34.1, length_m: 37.6, gearWidth_m: 7.8, mtow_kg: 77000, approachSpeed_kts: 137, refFieldLength_m: 2100, category: "commercial", notes: "Narrow-body workhorse" },
  { icao: "A20N", manufacturer: "Airbus", model: "A320neo", aac: "C", adg: "III", tdg: "5", wingspan_m: 35.8, length_m: 37.6, gearWidth_m: 7.8, mtow_kg: 79000, approachSpeed_kts: 137, refFieldLength_m: 2100, category: "commercial", notes: "New engine option narrow-body" },
  { icao: "A321", manufacturer: "Airbus", model: "A321-200", aac: "C", adg: "III", tdg: "5", wingspan_m: 34.1, length_m: 44.5, gearWidth_m: 7.8, mtow_kg: 93500, approachSpeed_kts: 140, refFieldLength_m: 2400, category: "commercial", notes: "Stretched narrow-body" },
  { icao: "A333", manufacturer: "Airbus", model: "A330-300", aac: "D", adg: "IV", tdg: "7", wingspan_m: 60.3, length_m: 63.7, gearWidth_m: 10.8, mtow_kg: 233000, approachSpeed_kts: 138, refFieldLength_m: 2600, category: "commercial", notes: "Wide-body long-range" },
  { icao: "A359", manufacturer: "Airbus", model: "A350-900", aac: "D", adg: "IV", tdg: "7", wingspan_m: 64.8, length_m: 66.8, gearWidth_m: 10.6, mtow_kg: 280000, approachSpeed_kts: 140, refFieldLength_m: 2600, category: "commercial", notes: "Wide-body next-gen" },
  { icao: "A388", manufacturer: "Airbus", model: "A380-800", aac: "E", adg: "VI", tdg: "16", wingspan_m: 79.8, length_m: 73.0, gearWidth_m: 14.0, mtow_kg: 575000, approachSpeed_kts: 141, refFieldLength_m: 3000, category: "commercial", notes: "Super jumbo — Code F" },
  { icao: "B738", manufacturer: "Boeing", model: "737-800", aac: "C", adg: "III", tdg: "5", wingspan_m: 34.3, length_m: 39.5, gearWidth_m: 5.6, mtow_kg: 79010, approachSpeed_kts: 141, refFieldLength_m: 2300, category: "commercial", notes: "Narrow-body workhorse" },
  { icao: "B739", manufacturer: "Boeing", model: "737-900ER", aac: "C", adg: "III", tdg: "5", wingspan_m: 34.3, length_m: 42.1, gearWidth_m: 5.6, mtow_kg: 85100, approachSpeed_kts: 143, refFieldLength_m: 2500, category: "commercial", notes: "Extended range narrow-body" },
  { icao: "B39M", manufacturer: "Boeing", model: "737 MAX 8", aac: "C", adg: "III", tdg: "5", wingspan_m: 35.9, length_m: 39.5, gearWidth_m: 5.6, mtow_kg: 82600, approachSpeed_kts: 140, refFieldLength_m: 2300, category: "commercial", notes: "MAX variant narrow-body" },
  { icao: "B752", manufacturer: "Boeing", model: "757-200", aac: "C", adg: "III", tdg: "5", wingspan_m: 38.1, length_m: 47.3, gearWidth_m: 7.3, mtow_kg: 115700, approachSpeed_kts: 135, refFieldLength_m: 2100, category: "commercial", notes: "Mid-range narrow-body" },
  { icao: "B763", manufacturer: "Boeing", model: "767-300ER", aac: "C", adg: "IV", tdg: "6", wingspan_m: 47.6, length_m: 54.9, gearWidth_m: 9.8, mtow_kg: 187000, approachSpeed_kts: 140, refFieldLength_m: 2600, category: "commercial", notes: "Wide-body medium-range" },
  { icao: "B77W", manufacturer: "Boeing", model: "777-300ER", aac: "D", adg: "V", tdg: "8", wingspan_m: 64.8, length_m: 73.9, gearWidth_m: 11.0, mtow_kg: 352000, approachSpeed_kts: 145, refFieldLength_m: 3050, category: "commercial", notes: "Long-haul wide-body" },
  { icao: "B748", manufacturer: "Boeing", model: "747-8", aac: "E", adg: "V", tdg: "14", wingspan_m: 68.4, length_m: 76.3, gearWidth_m: 11.0, mtow_kg: 448000, approachSpeed_kts: 155, refFieldLength_m: 3300, category: "commercial", notes: "Large quad-engine freighter/pax" },

  // Category 2 — Regional Aircraft
  { icao: "AT42", manufacturer: "ATR", model: "ATR 42-600", aac: "A", adg: "II", tdg: "2", wingspan_m: 24.6, length_m: 22.7, gearWidth_m: 4.1, mtow_kg: 18600, approachSpeed_kts: 102, refFieldLength_m: 1050, category: "regional", notes: "Regional turboprop 48-seat" },
  { icao: "AT76", manufacturer: "ATR", model: "ATR 72-600", aac: "B", adg: "III", tdg: "3", wingspan_m: 27.1, length_m: 27.2, gearWidth_m: 4.1, mtow_kg: 23000, approachSpeed_kts: 108, refFieldLength_m: 1290, category: "regional", notes: "Regional turboprop 70-seat" },
  { icao: "DH8D", manufacturer: "De Havilland", model: "Dash 8 Q400", aac: "B", adg: "III", tdg: "3", wingspan_m: 28.4, length_m: 32.8, gearWidth_m: 7.9, mtow_kg: 29574, approachSpeed_kts: 118, refFieldLength_m: 1400, category: "regional", notes: "High-speed turboprop 76-seat" },
  { icao: "E190", manufacturer: "Embraer", model: "E190", aac: "C", adg: "III", tdg: "4", wingspan_m: 28.7, length_m: 36.2, gearWidth_m: 6.0, mtow_kg: 51800, approachSpeed_kts: 131, refFieldLength_m: 2000, category: "regional", notes: "Regional jet 100-seat" },
  { icao: "E135", manufacturer: "Embraer", model: "ERJ-135", aac: "B", adg: "II", tdg: "2", wingspan_m: 20.0, length_m: 26.3, gearWidth_m: 4.1, mtow_kg: 20000, approachSpeed_kts: 128, refFieldLength_m: 1580, category: "regional", notes: "Regional jet 37-seat" },
  { icao: "CRJ2", manufacturer: "Bombardier", model: "CRJ-200", aac: "B", adg: "II", tdg: "2", wingspan_m: 21.2, length_m: 26.8, gearWidth_m: 4.7, mtow_kg: 24041, approachSpeed_kts: 132, refFieldLength_m: 1780, category: "regional", notes: "Regional jet 50-seat" },

  // Category 3 — Military / Utility
  { icao: "C130", manufacturer: "Lockheed Martin", model: "C-130J Super Hercules", aac: "B", adg: "III", tdg: "4", wingspan_m: 40.4, length_m: 29.8, gearWidth_m: 4.4, mtow_kg: 79380, approachSpeed_kts: 110, refFieldLength_m: 1050, category: "military", notes: "Military tactical transport — STOL capable" },
  { icao: "C172", manufacturer: "Cessna", model: "172 Skyhawk", aac: "A", adg: "I", tdg: "1a", wingspan_m: 11.0, length_m: 8.3, gearWidth_m: 2.6, mtow_kg: 1157, approachSpeed_kts: 61, refFieldLength_m: 450, category: "utility", notes: "Single-engine piston trainer" },
  { icao: "C208", manufacturer: "Cessna", model: "208B Grand Caravan", aac: "A", adg: "II", tdg: "1b", wingspan_m: 15.9, length_m: 12.7, gearWidth_m: 4.3, mtow_kg: 3995, approachSpeed_kts: 80, refFieldLength_m: 660, category: "utility", notes: "Single turboprop utility" },
  { icao: "DHC6", manufacturer: "Viking", model: "DHC-6 Twin Otter", aac: "A", adg: "II", tdg: "1b", wingspan_m: 19.8, length_m: 15.8, gearWidth_m: 5.1, mtow_kg: 5670, approachSpeed_kts: 75, refFieldLength_m: 370, category: "utility", notes: "STOL utility — bush/water operations" },
  { icao: "PC12", manufacturer: "Pilatus", model: "PC-12 NGX", aac: "A", adg: "II", tdg: "1b", wingspan_m: 16.3, length_m: 14.4, gearWidth_m: 4.0, mtow_kg: 4740, approachSpeed_kts: 85, refFieldLength_m: 800, category: "utility", notes: "Single turboprop executive utility" },

  // Category 4 — Business Jets
  { icao: "BE40", manufacturer: "Beechcraft", model: "Beechjet 400A", aac: "B", adg: "I", tdg: "1b", wingspan_m: 13.3, length_m: 14.8, gearWidth_m: 2.5, mtow_kg: 7303, approachSpeed_kts: 122, refFieldLength_m: 1100, category: "business", notes: "Light business jet" },
  { icao: "BE20", manufacturer: "Beechcraft", model: "King Air 200", aac: "A", adg: "II", tdg: "2", wingspan_m: 16.6, length_m: 13.3, gearWidth_m: 5.0, mtow_kg: 5670, approachSpeed_kts: 103, refFieldLength_m: 900, category: "business", notes: "Twin turboprop executive" },
  { icao: "C525", manufacturer: "Cessna", model: "Citation CJ1+", aac: "A", adg: "I", tdg: "1a", wingspan_m: 14.3, length_m: 12.7, gearWidth_m: 3.0, mtow_kg: 4853, approachSpeed_kts: 107, refFieldLength_m: 1000, category: "business", notes: "Very light jet" },
  { icao: "C56X", manufacturer: "Cessna", model: "Citation Excel/XLS+", aac: "B", adg: "I", tdg: "1b", wingspan_m: 17.0, length_m: 16.0, gearWidth_m: 3.6, mtow_kg: 9163, approachSpeed_kts: 117, refFieldLength_m: 1100, category: "business", notes: "Mid-size business jet" },
  { icao: "C680", manufacturer: "Cessna", model: "Citation Sovereign+", aac: "B", adg: "II", tdg: "2", wingspan_m: 19.3, length_m: 19.4, gearWidth_m: 4.3, mtow_kg: 13744, approachSpeed_kts: 118, refFieldLength_m: 1100, category: "business", notes: "Super-midsize business jet" },
  { icao: "GLF4", manufacturer: "Gulfstream", model: "G450", aac: "C", adg: "II", tdg: "3", wingspan_m: 23.7, length_m: 27.2, gearWidth_m: 4.5, mtow_kg: 33838, approachSpeed_kts: 126, refFieldLength_m: 1600, category: "business", notes: "Large-cabin long-range" },
  { icao: "GLF5", manufacturer: "Gulfstream", model: "G550", aac: "C", adg: "II", tdg: "3", wingspan_m: 28.5, length_m: 29.4, gearWidth_m: 4.5, mtow_kg: 41277, approachSpeed_kts: 128, refFieldLength_m: 1800, category: "business", notes: "Ultra-long-range large cabin" },
  { icao: "GLF6", manufacturer: "Gulfstream", model: "G650ER", aac: "C", adg: "III", tdg: "3", wingspan_m: 30.4, length_m: 30.4, gearWidth_m: 4.4, mtow_kg: 45178, approachSpeed_kts: 130, refFieldLength_m: 1800, category: "business", notes: "Flagship ultra-long-range" },
  { icao: "GL7T", manufacturer: "Gulfstream", model: "G700", aac: "C", adg: "III", tdg: "3", wingspan_m: 31.4, length_m: 33.5, gearWidth_m: 4.4, mtow_kg: 48807, approachSpeed_kts: 131, refFieldLength_m: 1900, category: "business", notes: "Largest purpose-built business jet" },
];

// ── Helicopter Database ───────────────────────────────
// Source: User reference table (MTOW, Length, Rotor, Tire Press, Gear Type)
// D-value estimated as: max(fuselage_length, rotorDiameter) + tail rotor offset
export const helicopterDatabase: HelicopterData[] = [
  // ── Sikorsky ──────────────────────────────────────────────────────────────
  { icao: "S92",  manufacturer: "Sikorsky", model: "S-92",                  rotorDiameter_m: 17.17, dValue_m: 20.9,  length_m: 17.31, mtow_kg: 12020, approachSpeed_kts: 85, category: "heavy",  typicalUse: "Offshore / SAR / Head of State",      heliportRelevance: "Offshore — primary",    notes: "Heavy twin | Gear: Tricycle | Tire: 900 kPa" },
  { icao: "S76D", manufacturer: "Sikorsky", model: "S-76D",                 rotorDiameter_m: 13.41, dValue_m: 16.0,  length_m: 13.22, mtow_kg: 5307,  approachSpeed_kts: 80, category: "medium", typicalUse: "Offshore / VIP / EMS",               heliportRelevance: "Offshore / General",    notes: "Medium twin | Gear: Tricycle | Tire: 750 kPa" },
  { icao: "S76C", manufacturer: "Sikorsky", model: "S-76C++",               rotorDiameter_m: 13.41, dValue_m: 16.0,  length_m: 13.22, mtow_kg: 5307,  approachSpeed_kts: 80, category: "medium", typicalUse: "Offshore / VIP / EMS",               heliportRelevance: "Offshore / General",    notes: "Medium twin variant | Gear: Tricycle | Tire: 750 kPa" },
  { icao: "UH60", manufacturer: "Sikorsky", model: "S-70/UH-60 Black Hawk", rotorDiameter_m: 16.36, dValue_m: 19.76, length_m: 19.76, mtow_kg: 10660, approachSpeed_kts: 80, category: "heavy",  typicalUse: "Military / SAR / Utility",           heliportRelevance: "Military / SAR",        notes: "Military utility | Gear: Tricycle | Tire: 850 kPa" },
  { icao: "CH53", manufacturer: "Sikorsky", model: "CH-53K King Stallion",  rotorDiameter_m: 24.08, dValue_m: 30.18, length_m: 30.18, mtow_kg: 39916, approachSpeed_kts: 85, category: "heavy",  typicalUse: "Military Heavy Lift",                heliportRelevance: "Military — heavy",      notes: "Heavy military | Gear: Tricycle | Tire: 1200 kPa" },
  { icao: "MH60", manufacturer: "Sikorsky", model: "MH-60 Seahawk",         rotorDiameter_m: 16.36, dValue_m: 19.76, length_m: 19.76, mtow_kg: 10659, approachSpeed_kts: 80, category: "heavy",  typicalUse: "Naval SAR / ASW",                    heliportRelevance: "Naval / Offshore",      notes: "Naval variant | Gear: Tricycle | Tire: 850 kPa" },

  // ── Leonardo (AgustaWestland) ─────────────────────────────────────────────
  { icao: "A139", manufacturer: "Leonardo", model: "AW139",                 rotorDiameter_m: 13.8,  dValue_m: 16.66, length_m: 16.66, mtow_kg: 7000,  approachSpeed_kts: 80, category: "medium", typicalUse: "EMS / Offshore / VIP / SAR",         heliportRelevance: "Hospital / Offshore",   notes: "Best-selling medium twin | Gear: Tricycle | Tire: 750 kPa" },
  { icao: "A169", manufacturer: "Leonardo", model: "AW169",                 rotorDiameter_m: 12.12, dValue_m: 14.65, length_m: 14.65, mtow_kg: 4800,  approachSpeed_kts: 75, category: "medium", typicalUse: "EMS / VIP / Offshore",               heliportRelevance: "Hospital / General",    notes: "New-generation medium twin | Gear: Tricycle | Tire: 700 kPa" },
  { icao: "A189", manufacturer: "Leonardo", model: "AW189",                 rotorDiameter_m: 14.6,  dValue_m: 17.60, length_m: 17.60, mtow_kg: 8600,  approachSpeed_kts: 82, category: "heavy",  typicalUse: "Offshore / SAR",                     heliportRelevance: "Offshore",              notes: "Super-medium/heavy twin | Gear: Tricycle | Tire: 800 kPa" },
  { icao: "A101", manufacturer: "Leonardo", model: "AW101 Merlin",          rotorDiameter_m: 18.59, dValue_m: 22.81, length_m: 22.81, mtow_kg: 15600, approachSpeed_kts: 85, category: "heavy",  typicalUse: "SAR / Military / VIP",               heliportRelevance: "Military / Offshore",   notes: "Heavy tri-engine | Gear: Tricycle | Tire: 900 kPa" },
  { icao: "A109", manufacturer: "Leonardo", model: "AW109 GrandNew",        rotorDiameter_m: 11.0,  dValue_m: 13.04, length_m: 13.04, mtow_kg: 3175,  approachSpeed_kts: 75, category: "light",  typicalUse: "EMS / VIP / Law Enforcement",        heliportRelevance: "Hospital / General",    notes: "Light twin | Gear: Tricycle | Tire: 650 kPa" },
  { icao: "AW19", manufacturer: "Leonardo", model: "AW119Kx",               rotorDiameter_m: 10.83, dValue_m: 12.92, length_m: 12.92, mtow_kg: 2850,  approachSpeed_kts: 70, category: "light",  typicalUse: "EMS / Law Enforcement / Utility",    heliportRelevance: "Hospital / General",    notes: "Single-engine light | Gear: Skid | Tire: 620 kPa" },
  { icao: "A609", manufacturer: "Leonardo", model: "AW609",                 rotorDiameter_m: 7.92,  dValue_m: 13.30, length_m: 13.30, mtow_kg: 8165,  approachSpeed_kts: 80, category: "medium", typicalUse: "VTOL Transport / Offshore",           heliportRelevance: "Offshore / VIP",        notes: "Tiltrotor — unique class | Gear: Tricycle | Tire: 800 kPa" },

  // ── Airbus Helicopters ────────────────────────────────────────────────────
  { icao: "H175", manufacturer: "Airbus", model: "H175",                    rotorDiameter_m: 14.8,  dValue_m: 19.50, length_m: 19.50, mtow_kg: 7800,  approachSpeed_kts: 80, category: "medium", typicalUse: "Offshore / VIP",                    heliportRelevance: "Offshore",              notes: "Medium-heavy twin | Gear: Tricycle | Tire: 780 kPa" },
  { icao: "H160", manufacturer: "Airbus", model: "H160",                    rotorDiameter_m: 13.3,  dValue_m: 15.30, length_m: 15.30, mtow_kg: 6050,  approachSpeed_kts: 78, category: "medium", typicalUse: "EMS / Offshore / VIP",              heliportRelevance: "Hospital / Offshore",   notes: "Next-gen medium twin | Gear: Tricycle | Tire: 720 kPa" },
  { icao: "EC55", manufacturer: "Airbus", model: "H155 (EC155)",            rotorDiameter_m: 12.6,  dValue_m: 14.30, length_m: 14.30, mtow_kg: 4920,  approachSpeed_kts: 78, category: "medium", typicalUse: "Offshore / EMS / VIP",              heliportRelevance: "Offshore / General",    notes: "Medium twin | Gear: Tricycle | Tire: 700 kPa" },
  { icao: "EC45", manufacturer: "Airbus", model: "H145 (EC145)",            rotorDiameter_m: 11.0,  dValue_m: 13.64, length_m: 13.64, mtow_kg: 3700,  approachSpeed_kts: 75, category: "medium", typicalUse: "EMS / SAR / Law Enforcement",        heliportRelevance: "Hospital / Offshore",   notes: "Twin-engine multi-role | Gear: Tricycle | Tire: 680 kPa" },
  { icao: "EC35", manufacturer: "Airbus", model: "H135 (EC135)",            rotorDiameter_m: 10.2,  dValue_m: 12.16, length_m: 12.16, mtow_kg: 2950,  approachSpeed_kts: 70, category: "light",  typicalUse: "EMS / Law Enforcement",             heliportRelevance: "Hospital helipad — primary", notes: "Purpose-built EMS | Gear: Skid | Tire: 650 kPa" },
  { icao: "EC30", manufacturer: "Airbus", model: "H130 (EC130)",            rotorDiameter_m: 10.69, dValue_m: 12.60, length_m: 12.60, mtow_kg: 2427,  approachSpeed_kts: 67, category: "light",  typicalUse: "Tourism / Utility",                 heliportRelevance: "General aviation",      notes: "Single-engine light | Gear: Skid | Tire: 600 kPa" },
  { icao: "AS50", manufacturer: "Airbus", model: "H125 (AS350)",            rotorDiameter_m: 10.69, dValue_m: 12.94, length_m: 12.94, mtow_kg: 2250,  approachSpeed_kts: 65, category: "light",  typicalUse: "Utility / EMS / Law Enforcement",   heliportRelevance: "Hospital / General",    notes: "Versatile single workhorse | Gear: Skid | Tire: 580 kPa" },
  { icao: "AS20", manufacturer: "Airbus", model: "H120 (EC120)",            rotorDiameter_m: 10.0,  dValue_m: 11.52, length_m: 11.52, mtow_kg: 1715,  approachSpeed_kts: 62, category: "light",  typicalUse: "Training / Private",                heliportRelevance: "General aviation",      notes: "Light single | Gear: Skid | Tire: 550 kPa" },
  { icao: "AS32", manufacturer: "Airbus", model: "H215 (Super Puma)",       rotorDiameter_m: 16.2,  dValue_m: 18.70, length_m: 18.70, mtow_kg: 9350,  approachSpeed_kts: 83, category: "heavy",  typicalUse: "Offshore / Military / SAR",         heliportRelevance: "Offshore",              notes: "Heavy twin | Gear: Tricycle | Tire: 850 kPa" },
  { icao: "H225", manufacturer: "Airbus", model: "H225 (EC225)",            rotorDiameter_m: 16.2,  dValue_m: 19.50, length_m: 19.50, mtow_kg: 11200, approachSpeed_kts: 85, category: "heavy",  typicalUse: "Offshore / SAR / Military",         heliportRelevance: "Offshore",              notes: "Heavy twin long-range | Gear: Tricycle | Tire: 900 kPa" },

  // ── Bell ──────────────────────────────────────────────────────────────────
  { icao: "B505", manufacturer: "Bell", model: "505 Jet Ranger X",          rotorDiameter_m: 10.59, dValue_m: 11.03, length_m: 11.03, mtow_kg: 1932,  approachSpeed_kts: 62, category: "light",  typicalUse: "Training / Private / Utility",      heliportRelevance: "General aviation",      notes: "Light single | Gear: Skid | Tire: 550 kPa" },
  { icao: "B407", manufacturer: "Bell", model: "Bell 407",                  rotorDiameter_m: 10.67, dValue_m: 12.70, length_m: 12.70, mtow_kg: 2268,  approachSpeed_kts: 70, category: "light",  typicalUse: "EMS / Utility / Law Enforcement",   heliportRelevance: "Hospital / General",    notes: "Single-engine | Gear: Skid | Tire: 600 kPa" },
  { icao: "B40G", manufacturer: "Bell", model: "Bell 407GXi",               rotorDiameter_m: 10.67, dValue_m: 12.70, length_m: 12.70, mtow_kg: 2381,  approachSpeed_kts: 70, category: "light",  typicalUse: "EMS / Utility / Law Enforcement",   heliportRelevance: "Hospital / General",    notes: "Updated single | Gear: Skid | Tire: 620 kPa" },
  { icao: "B412", manufacturer: "Bell", model: "Bell 412EP/EPi",            rotorDiameter_m: 14.02, dValue_m: 17.10, length_m: 17.10, mtow_kg: 5397,  approachSpeed_kts: 80, category: "medium", typicalUse: "Transport / SAR / Offshore",         heliportRelevance: "Offshore / General",    notes: "Medium twin | Gear: Skid | Tire: 700 kPa" },
  { icao: "B429", manufacturer: "Bell", model: "Bell 429",                  rotorDiameter_m: 11.28, dValue_m: 13.47, length_m: 13.47, mtow_kg: 3402,  approachSpeed_kts: 75, category: "medium", typicalUse: "EMS / Offshore / SAR",              heliportRelevance: "Hospital / Offshore",   notes: "Medium twin | Gear: Skid | Tire: 680 kPa" },
  { icao: "B42W", manufacturer: "Bell", model: "Bell 429WLG",               rotorDiameter_m: 11.28, dValue_m: 13.47, length_m: 13.47, mtow_kg: 3402,  approachSpeed_kts: 75, category: "medium", typicalUse: "EMS / Offshore",                    heliportRelevance: "Hospital / Offshore",   notes: "Wheeled landing gear | Gear: Tricycle | Tire: 680 kPa" },
  { icao: "B430", manufacturer: "Bell", model: "Bell 430",                  rotorDiameter_m: 12.8,  dValue_m: 15.29, length_m: 15.29, mtow_kg: 4218,  approachSpeed_kts: 78, category: "medium", typicalUse: "VIP / EMS / Offshore",              heliportRelevance: "General / Offshore",    notes: "Medium twin | Gear: Tricycle | Tire: 700 kPa" },
  { icao: "B525", manufacturer: "Bell", model: "Bell 525 Relentless",       rotorDiameter_m: 15.85, dValue_m: 19.97, length_m: 19.97, mtow_kg: 9072,  approachSpeed_kts: 83, category: "heavy",  typicalUse: "Offshore / SAR",                    heliportRelevance: "Offshore",              notes: "Heavy twin fly-by-wire | Gear: Tricycle | Tire: 850 kPa" },
  { icao: "AH1Z", manufacturer: "Bell", model: "Bell AH-1Z Viper",         rotorDiameter_m: 14.63, dValue_m: 17.80, length_m: 17.80, mtow_kg: 8390,  approachSpeed_kts: 80, category: "heavy",  typicalUse: "Military Attack",                   heliportRelevance: "Military",              notes: "Attack helicopter | Gear: Tricycle | Tire: 800 kPa" },
  { icao: "UH1Y", manufacturer: "Bell", model: "Bell UH-1Y Venom",         rotorDiameter_m: 14.63, dValue_m: 17.78, length_m: 17.78, mtow_kg: 8390,  approachSpeed_kts: 80, category: "heavy",  typicalUse: "Military Utility",                  heliportRelevance: "Military",              notes: "Military utility | Gear: Tricycle | Tire: 800 kPa" },
  { icao: "B206", manufacturer: "Bell", model: "Bell 206B JetRanger",       rotorDiameter_m: 10.16, dValue_m: 11.82, length_m: 11.82, mtow_kg: 1451,  approachSpeed_kts: 60, category: "light",  typicalUse: "Training / Private / Utility",      heliportRelevance: "General aviation",      notes: "Classic light single | Gear: Skid | Tire: 520 kPa" },
  { icao: "B20L", manufacturer: "Bell", model: "Bell 206L LongRanger",      rotorDiameter_m: 11.28, dValue_m: 13.02, length_m: 13.02, mtow_kg: 1882,  approachSpeed_kts: 65, category: "light",  typicalUse: "Utility / VIP",                     heliportRelevance: "General aviation",      notes: "Extended JetRanger | Gear: Skid | Tire: 550 kPa" },
  { icao: "B222", manufacturer: "Bell", model: "Bell 222/230",              rotorDiameter_m: 12.8,  dValue_m: 15.36, length_m: 15.36, mtow_kg: 3810,  approachSpeed_kts: 75, category: "medium", typicalUse: "EMS / VIP / Offshore",              heliportRelevance: "Hospital / General",    notes: "Medium twin | Gear: Tricycle | Tire: 680 kPa" },

  // ── MD Helicopters ────────────────────────────────────────────────────────
  { icao: "MD50", manufacturer: "MD Helicopters", model: "MD 500E",         rotorDiameter_m: 8.05,  dValue_m: 9.40,  length_m: 9.40,  mtow_kg: 1361,  approachSpeed_kts: 58, category: "light",  typicalUse: "Utility / Training / Law Enforcement", heliportRelevance: "General aviation",   notes: "Light single | Gear: Skid | Tire: 480 kPa" },
  { icao: "MD52", manufacturer: "MD Helicopters", model: "MD 520N",         rotorDiameter_m: 8.38,  dValue_m: 9.70,  length_m: 9.70,  mtow_kg: 1519,  approachSpeed_kts: 60, category: "light",  typicalUse: "Law Enforcement / Utility",           heliportRelevance: "General aviation",   notes: "NOTAR single | Gear: Skid | Tire: 500 kPa" },
  { icao: "MD53", manufacturer: "MD Helicopters", model: "MD 530F",         rotorDiameter_m: 8.38,  dValue_m: 9.75,  length_m: 9.75,  mtow_kg: 1406,  approachSpeed_kts: 60, category: "light",  typicalUse: "Utility / Training",                  heliportRelevance: "General aviation",   notes: "Hot-high performance | Gear: Skid | Tire: 500 kPa" },
  { icao: "MD60", manufacturer: "MD Helicopters", model: "MD 600N",         rotorDiameter_m: 8.38,  dValue_m: 11.84, length_m: 11.84, mtow_kg: 1882,  approachSpeed_kts: 62, category: "light",  typicalUse: "Utility / EMS",                       heliportRelevance: "General aviation",   notes: "NOTAR 6-blade | Gear: Skid | Tire: 520 kPa" },
  { icao: "MD90", manufacturer: "MD Helicopters", model: "MD 902 Explorer", rotorDiameter_m: 10.31, dValue_m: 11.84, length_m: 11.84, mtow_kg: 2835,  approachSpeed_kts: 70, category: "light",  typicalUse: "EMS / Law Enforcement",               heliportRelevance: "Hospital / General", notes: "NOTAR twin | Gear: Skid | Tire: 620 kPa" },

  // ── Robinson ──────────────────────────────────────────────────────────────
  { icao: "R22",  manufacturer: "Robinson", model: "Robinson R22",          rotorDiameter_m: 7.67,  dValue_m: 8.76,  length_m: 8.76,  mtow_kg: 621,   approachSpeed_kts: 50, category: "light",  typicalUse: "Training / Private",                heliportRelevance: "General aviation",      notes: "Piston 2-seat | Gear: Skid | Tire: 380 kPa" },
  { icao: "R44",  manufacturer: "Robinson", model: "Robinson R44",          rotorDiameter_m: 10.06, dValue_m: 11.66, length_m: 11.66, mtow_kg: 1134,  approachSpeed_kts: 60, category: "light",  typicalUse: "Training / Private",                heliportRelevance: "General aviation",      notes: "Piston 4-seat | Gear: Skid | Tire: 450 kPa" },
  { icao: "R66",  manufacturer: "Robinson", model: "Robinson R66",          rotorDiameter_m: 10.06, dValue_m: 11.66, length_m: 11.66, mtow_kg: 1225,  approachSpeed_kts: 60, category: "light",  typicalUse: "Training / Private / Utility",      heliportRelevance: "General aviation",      notes: "Turbine 5-seat | Gear: Skid | Tire: 480 kPa" },

  // ── Enstrom ───────────────────────────────────────────────────────────────
  { icao: "F28",  manufacturer: "Enstrom", model: "Enstrom 480B",           rotorDiameter_m: 9.75,  dValue_m: 12.70, length_m: 12.70, mtow_kg: 1361,  approachSpeed_kts: 58, category: "light",  typicalUse: "Training / Private",                heliportRelevance: "General aviation",      notes: "Turbine light | Gear: Skid | Tire: 500 kPa" },

  // ── Boeing ────────────────────────────────────────────────────────────────
  { icao: "CH47", manufacturer: "Boeing", model: "Boeing CH-47F Chinook",   rotorDiameter_m: 18.29, dValue_m: 30.18, length_m: 30.18, mtow_kg: 24494, approachSpeed_kts: 80, category: "heavy",  typicalUse: "Military Heavy Lift / Cargo",        heliportRelevance: "Military — heavy",      notes: "Tandem rotor | Gear: Quadricycle | Tire: 1100 kPa" },
  { icao: "AH64", manufacturer: "Boeing", model: "Boeing AH-64E Apache",    rotorDiameter_m: 14.63, dValue_m: 17.76, length_m: 17.76, mtow_kg: 8006,  approachSpeed_kts: 80, category: "heavy",  typicalUse: "Military Attack",                   heliportRelevance: "Military",              notes: "Attack helicopter | Gear: Tricycle | Tire: 780 kPa" },

  // ── NHI ───────────────────────────────────────────────────────────────────
  { icao: "NH90", manufacturer: "NHI", model: "NH90",                       rotorDiameter_m: 16.3,  dValue_m: 19.56, length_m: 19.56, mtow_kg: 10600, approachSpeed_kts: 82, category: "heavy",  typicalUse: "Military / Naval SAR",              heliportRelevance: "Military / Naval",      notes: "Heavy twin military | Gear: Tricycle | Tire: 850 kPa" },

  // ── Kamov ─────────────────────────────────────────────────────────────────
  { icao: "KA32", manufacturer: "Kamov", model: "Kamov Ka-32",              rotorDiameter_m: 15.9,  dValue_m: 15.90, length_m: 15.90, mtow_kg: 11000, approachSpeed_kts: 80, category: "heavy",  typicalUse: "SAR / Firefighting / Offshore",     heliportRelevance: "Offshore / SAR",        notes: "Coaxial twin | Gear: Tricycle | Tire: 800 kPa" },
  { icao: "KA62", manufacturer: "Kamov", model: "Kamov Ka-62",              rotorDiameter_m: 13.8,  dValue_m: 15.54, length_m: 15.54, mtow_kg: 6500,  approachSpeed_kts: 78, category: "medium", typicalUse: "Offshore / VIP / EMS",              heliportRelevance: "Offshore / General",    notes: "Medium twin | Gear: Tricycle | Tire: 720 kPa" },

  // ── Mil ───────────────────────────────────────────────────────────────────
  { icao: "MI8",  manufacturer: "Mil", model: "Mi-8 / Mi-17",               rotorDiameter_m: 21.29, dValue_m: 25.24, length_m: 25.24, mtow_kg: 13000, approachSpeed_kts: 80, category: "heavy",  typicalUse: "Transport / SAR / Military",         heliportRelevance: "Military / General",   notes: "Heavy twin | Gear: Tricycle | Tire: 900 kPa" },
  { icao: "MI17", manufacturer: "Mil", model: "Mi-171A2",                   rotorDiameter_m: 21.29, dValue_m: 25.24, length_m: 25.24, mtow_kg: 13500, approachSpeed_kts: 80, category: "heavy",  typicalUse: "Transport / Military",              heliportRelevance: "Military / General",   notes: "Upgraded Mi-8 | Gear: Tricycle | Tire: 920 kPa" },
  { icao: "MI38", manufacturer: "Mil", model: "Mi-38",                      rotorDiameter_m: 21.1,  dValue_m: 25.10, length_m: 25.10, mtow_kg: 15600, approachSpeed_kts: 82, category: "heavy",  typicalUse: "Transport / Offshore",              heliportRelevance: "Offshore / Military",  notes: "Heavy twin modern | Gear: Tricycle | Tire: 950 kPa" },

  // ── Kazan ─────────────────────────────────────────────────────────────────
  { icao: "ANZA", manufacturer: "Kazan", model: "Kazan Ansat",              rotorDiameter_m: 11.5,  dValue_m: 13.47, length_m: 13.47, mtow_kg: 3600,  approachSpeed_kts: 70, category: "light",  typicalUse: "EMS / Training",                    heliportRelevance: "Hospital / General",   notes: "Light twin | Gear: Skid | Tire: 650 kPa" },

  // ── HAL ───────────────────────────────────────────────────────────────────
  { icao: "DHRV", manufacturer: "HAL", model: "HAL Dhruv ALH",              rotorDiameter_m: 13.2,  dValue_m: 15.87, length_m: 15.87, mtow_kg: 5500,  approachSpeed_kts: 75, category: "medium", typicalUse: "Military / SAR / EMS",              heliportRelevance: "Military / General",   notes: "Indian medium twin | Gear: Tricycle | Tire: 700 kPa" },

  // ── KAI ───────────────────────────────────────────────────────────────────
  { icao: "SURI", manufacturer: "KAI", model: "KAI Surion",                 rotorDiameter_m: 15.8,  dValue_m: 19.06, length_m: 19.06, mtow_kg: 8709,  approachSpeed_kts: 80, category: "heavy",  typicalUse: "Military Transport / SAR",          heliportRelevance: "Military",             notes: "Korean medium-heavy | Gear: Tricycle | Tire: 820 kPa" },

  // ── AVIC ──────────────────────────────────────────────────────────────────
  { icao: "AC31", manufacturer: "AVIC", model: "AVIC AC313",                rotorDiameter_m: 18.9,  dValue_m: 23.00, length_m: 23.00, mtow_kg: 13800, approachSpeed_kts: 80, category: "heavy",  typicalUse: "SAR / Disaster Relief / Transport", heliportRelevance: "Military / SAR",       notes: "Chinese heavy twin | Gear: Tricycle | Tire: 900 kPa" },
  { icao: "Z15",  manufacturer: "AVIC", model: "AVIC Z-15",                 rotorDiameter_m: 13.8,  dValue_m: 16.16, length_m: 16.16, mtow_kg: 7500,  approachSpeed_kts: 78, category: "medium", typicalUse: "Offshore / Transport / VIP",         heliportRelevance: "Offshore / General",   notes: "Sino-French medium twin | Gear: Tricycle | Tire: 780 kPa" },
];


// ── Search & filter functions ─────────────────────────
export function searchAircraft(query: string, data: AircraftData[]): AircraftData[] {
  const q = query.toLowerCase().trim();
  if (!q) return data;
  return data.filter(
    (a) =>
      a.icao.toLowerCase().includes(q) ||
      a.manufacturer.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.aac.toLowerCase() === q ||
      `${a.aac}-${a.adg}`.toLowerCase() === q
  );
}

export function searchHelicopters(query: string, data: HelicopterData[]): HelicopterData[] {
  const q = query.toLowerCase().trim();
  if (!q) return data;
  return data.filter(
    (h) =>
      h.icao.toLowerCase().includes(q) ||
      h.manufacturer.toLowerCase().includes(q) ||
      h.model.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q) ||
      h.typicalUse.toLowerCase().includes(q)
  );
}

export function filterByGroup(data: AircraftData[], aac?: string, adg?: string): AircraftData[] {
  let result = data;
  if (aac && aac !== "all") result = result.filter((a) => a.aac.toLowerCase() === aac.toLowerCase());
  if (adg && adg !== "all") result = result.filter((a) => a.adg === adg);
  return result;
}

export function filterByCategory(data: AircraftData[], category?: string): AircraftData[] {
  if (!category || category === "all") return data;
  return data.filter((a) => a.category === category);
}
