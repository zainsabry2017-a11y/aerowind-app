// ── ICAO-Aligned Runway Length Correction ──────────────
// Reference: ICAO Doc 9157 (Aerodrome Design Manual)
// Note: Planning-level corrections only — NOT operational performance

export interface RunwayLengthInputs {
  baseLength: number;           // metres
  airportElevation: number;     // metres AMSL
  referenceTemperature: number; // °C (ICAO reference temp concept)
  effectiveGradient: number;    // percent
  surfaceCondition: "paved" | "turf" | "gravel";
  headwindComponent: number;    // knots
  tailwindComponent: number;    // knots
  wetRunway: boolean;
}

export interface LengthCorrectionBreakdown {
  label: string;
  factor: number;
  addedLength: number;
  description: string;
}

export interface RunwayLengthResult {
  baseLength: number;
  correctedLength: number;
  totalMultiplier: number;
  breakdown: LengthCorrectionBreakdown[];
  warnings: string[];
}

// ISA at sea level: 15°C, lapse rate 6.5°C/1000m
const ISA_SEA_LEVEL = 15; // °C
const ISA_LAPSE_RATE = 6.5; // °C per 1000m

function getStandardTemp(elevationM: number): number {
  return ISA_SEA_LEVEL - (elevationM / 1000) * ISA_LAPSE_RATE;
}

export function calculateRunwayLength(inputs: RunwayLengthInputs): RunwayLengthResult {
  const { baseLength, airportElevation, referenceTemperature, effectiveGradient, surfaceCondition, headwindComponent, tailwindComponent, wetRunway } = inputs;

  const breakdown: LengthCorrectionBreakdown[] = [];
  const warnings: string[] = [];
  let length = baseLength;

  // 1. Elevation correction: ICAO — +7% per 300m (1000 ft)
  const elevFactor = 1 + (airportElevation / 300) * 0.07;
  breakdown.push({
    label: "Elevation",
    factor: elevFactor,
    addedLength: baseLength * (elevFactor - 1),
    description: `+7% per 300 m elevation (ICAO Doc 9157) — ${airportElevation.toLocaleString()} m AMSL`,
  });
  length = baseLength * elevFactor;

  // 2. Temperature correction: ICAO reference temperature concept
  // +1% per °C above ISA at airport elevation
  const stdTemp = getStandardTemp(airportElevation);
  const tempExcess = referenceTemperature - stdTemp;
  const tempFactor = tempExcess > 0 ? 1 + tempExcess * 0.01 : 1;
  breakdown.push({
    label: "Temperature",
    factor: tempFactor,
    addedLength: length * (tempFactor - 1),
    description: `+1% per °C above ISA (ISA: ${stdTemp.toFixed(1)}°C, Ref: ${referenceTemperature}°C, Δ${tempExcess.toFixed(1)}°C)`,
  });
  length *= tempFactor;

  if (tempExcess > 20) {
    warnings.push("Reference temperature significantly exceeds ISA — verify with aircraft-specific performance data.");
  }

  // 3. Gradient correction: ICAO — +10% per 1% effective gradient
  if (effectiveGradient > 0) {
    const gradFactor = 1 + effectiveGradient * 0.1;
    breakdown.push({
      label: "Gradient",
      factor: gradFactor,
      addedLength: length * (gradFactor - 1),
      description: `+10% per 1% effective gradient (${effectiveGradient}%)`,
    });
    length *= gradFactor;
  }

  // 4. Surface condition
  if (surfaceCondition === "turf") {
    const f = 1.2;
    breakdown.push({ label: "Surface (Turf)", factor: f, addedLength: length * (f - 1), description: "+20% for turf surface" });
    length *= f;
  } else if (surfaceCondition === "gravel") {
    const f = 1.15;
    breakdown.push({ label: "Surface (Gravel)", factor: f, addedLength: length * (f - 1), description: "+15% for gravel surface" });
    length *= f;
  }

  // 5. Wind corrections
  if (headwindComponent > 0) {
    const reduction = Math.min(headwindComponent * 0.015, 0.15);
    const f = 1 - reduction;
    breakdown.push({ label: "Headwind", factor: f, addedLength: length * (f - 1), description: `−1.5% per kt headwind (${headwindComponent} kts, max −15%)` });
    length *= f;
  }

  if (tailwindComponent > 0) {
    const f = 1 + tailwindComponent * 0.035;
    breakdown.push({ label: "Tailwind", factor: f, addedLength: length * (f - 1), description: `+3.5% per kt tailwind (${tailwindComponent} kts)` });
    length *= f;
    warnings.push("Tailwind operations require careful analysis — non-standard for planning.");
  }

  // 6. Wet runway
  if (wetRunway) {
    const f = 1.15;
    breakdown.push({ label: "Wet Runway", factor: f, addedLength: length * (f - 1), description: "+15% for wet runway conditions" });
    length *= f;
  }

  if (airportElevation > 1500) {
    warnings.push("High elevation aerodrome — verify with aircraft-specific performance data.");
  }

  warnings.push("Planning-level estimate — not a substitute for aircraft performance data.");

  return {
    baseLength,
    correctedLength: Math.ceil(length),
    totalMultiplier: length / baseLength,
    breakdown,
    warnings,
  };
}
