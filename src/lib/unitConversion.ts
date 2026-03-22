// ── Unit Conversion System ─────────────────────────────
// Primary system: ICAO-friendly mixed aviation units
// metres, knots, °C, kg

export type LengthUnit = "m" | "ft";
export type SpeedUnit = "kts" | "ms";
export type MassUnit = "kg" | "lbs";

export interface UnitPreferences {
  length: LengthUnit;
  speed: SpeedUnit;
  mass: MassUnit;
}

export const DEFAULT_UNITS: UnitPreferences = {
  length: "m",
  speed: "kts",
  mass: "kg",
};

const M_TO_FT = 3.28084;
const KTS_TO_MS = 0.514444;
const KG_TO_LBS = 2.20462;

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return from === "m" ? value * M_TO_FT : value / M_TO_FT;
}

export function convertSpeed(value: number, from: SpeedUnit, to: SpeedUnit): number {
  if (from === to) return value;
  return from === "kts" ? value * KTS_TO_MS : value / KTS_TO_MS;
}

export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  if (from === to) return value;
  return from === "kg" ? value * KG_TO_LBS : value / KG_TO_LBS;
}

export function lengthLabel(unit: LengthUnit): string {
  return unit === "m" ? "m" : "ft";
}

export function speedLabel(unit: SpeedUnit): string {
  return unit === "kts" ? "kt" : "m/s";
}

export function massLabel(unit: MassUnit): string {
  return unit === "kg" ? "kg" : "lbs";
}
