// ── Sample Wind Data Generator ─────────────────────────
// Generates realistic synthetic wind data for testing
// without needing actual ASOS/METAR station files.

export interface SampleDataConfig {
  years?: number;               // duration (default 1)
  intervalHours?: number;       // observation interval (default 1 = hourly)
  prevailingDirection?: number; // dominant wind direction in degrees (default 315 = NW)
  secondaryDirection?: number;  // secondary peak (default 135 = SE)
  avgSpeed?: number;            // mean speed in knots (default 10)
  calmPercent?: number;         // % calm observations (default 8)
  gustPercent?: number;         // % with gusts (default 15)
  stationId?: string;
}

const DEFAULT_CONFIG: Required<SampleDataConfig> = {
  years: 1,
  intervalHours: 1,
  prevailingDirection: 315,
  secondaryDirection: 135,
  avgSpeed: 10,
  calmPercent: 8,
  gustPercent: 15,
  stationId: "SAMPLE",
};

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function wrapDegrees(d: number): number {
  return ((d % 360) + 360) % 360;
}

export function generateSampleCSV(config: SampleDataConfig = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rows: string[] = [];
  rows.push("date,time,wind_direction,wind_speed,gust");

  const startDate = new Date("2024-01-01T00:00:00Z");
  const totalHours = Math.round(cfg.years * 365.25 * 24);
  const step = cfg.intervalHours;

  for (let h = 0; h < totalHours; h += step) {
    const dt = new Date(startDate.getTime() + h * 3600000);
    const dateStr = dt.toISOString().slice(0, 10);
    const timeStr = dt.toISOString().slice(11, 16);

    // Calm wind
    if (Math.random() * 100 < cfg.calmPercent) {
      const calmSpeed = Math.round(Math.random() * 2 * 10) / 10;
      rows.push(`${dateStr},${timeStr},0,${calmSpeed},`);
      continue;
    }

    // Direction: bimodal distribution (prevailing + secondary)
    let dir: number;
    if (Math.random() < 0.6) {
      dir = cfg.prevailingDirection + gaussianRandom() * 35;
    } else if (Math.random() < 0.5) {
      dir = cfg.secondaryDirection + gaussianRandom() * 40;
    } else {
      dir = Math.random() * 360;
    }
    dir = Math.round(wrapDegrees(dir));

    // Speed: lognormal-ish distribution
    let speed = cfg.avgSpeed + gaussianRandom() * (cfg.avgSpeed * 0.4);
    speed = Math.max(1, Math.round(speed * 10) / 10);

    // Seasonal variation (higher in winter)
    const month = dt.getMonth(); // 0-11
    const seasonFactor = 1 + 0.25 * Math.cos(((month - 0) / 12) * 2 * Math.PI); // peaks in Jan
    speed = Math.round(speed * seasonFactor * 10) / 10;

    // Gust
    let gust = "";
    if (Math.random() * 100 < cfg.gustPercent && speed > 5) {
      const gustVal = speed + 5 + Math.random() * 10;
      gust = (Math.round(gustVal * 10) / 10).toString();
    }

    rows.push(`${dateStr},${timeStr},${dir},${speed},${gust}`);
  }

  return rows.join("\n");
}

export function downloadSampleCSV(config: SampleDataConfig = {}): void {
  const csv = generateSampleCSV(config);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sample_wind_data_${(config.stationId || "SAMPLE").toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function loadSampleDataAsFile(config: SampleDataConfig = {}): File {
  const csv = generateSampleCSV(config);
  const blob = new Blob([csv], { type: "text/csv" });
  return new File([blob], `sample_wind_data.csv`, { type: "text/csv" });
}

export const SAMPLE_PRESETS: { label: string; description: string; config: SampleDataConfig }[] = [
  {
    label: "Coastal Airport — 1 Year",
    description: "NW prevailing, moderate speeds, seasonal variation",
    config: { years: 1, prevailingDirection: 315, secondaryDirection: 135, avgSpeed: 12, calmPercent: 6, gustPercent: 20, stationId: "COAST1" },
  },
  {
    label: "Desert Aerodrome — 1 Year",
    description: "N/NW prevailing, hot climate pattern",
    config: { years: 1, prevailingDirection: 340, secondaryDirection: 160, avgSpeed: 8, calmPercent: 15, gustPercent: 25, stationId: "DESERT1" },
  },
  {
    label: "Mountain Airfield — 2 Years",
    description: "Variable winds, high gust frequency",
    config: { years: 2, prevailingDirection: 270, secondaryDirection: 90, avgSpeed: 14, calmPercent: 4, gustPercent: 35, stationId: "MTN1" },
  },
  {
    label: "Low-Wind Island — 1 Year",
    description: "Light trade winds, high calm %",
    config: { years: 1, prevailingDirection: 90, secondaryDirection: 45, avgSpeed: 6, calmPercent: 22, gustPercent: 8, stationId: "ISLAND1" },
  },
];
