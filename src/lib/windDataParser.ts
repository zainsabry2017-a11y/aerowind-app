import Papa from "papaparse";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────

export interface WindRecord {
  observation_date: string;
  observation_time: string;
  wind_direction_deg: number;      // degrees 0-360
  wind_speed_kt: number;          // knots
  wind_gust_kt: number | null;    // knots or null
  isCalm: boolean;
  isValid: boolean;
  raw: Record<string, string>;
}

export interface ParsedWindData {
  records: WindRecord[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingValues: number;
  dateRange: { start: string; end: string } | null;
  datasetType: "hourly" | "sub-daily" | "daily" | "monthly" | "unknown";
  reliability: "high" | "medium" | "low";
  reliabilityReasons: string[];
  columns: DetectedColumns;
  warnings: string[];
  sourceType?: "official" | "ogimet" | "meteostat";
  sourceName?: string;
  stationName?: string;
}

export interface DetectedColumns {
  date: string | null;
  time: string | null;
  direction: string | null;
  speed: string | null;
  gust: string | null;
  // mappingLog is returned separately from detectColumns but NOT stored in this interface
  // to avoid conflicts with Record<keyof DetectedColumns, ...> usage
}

// ── Column detection patterns ──────────────────────────

// ── Column detection patterns (regex — applied after exact-alias table) ───────

const COLUMN_PATTERNS: Record<keyof DetectedColumns, RegExp[]> = {
  date: [
    /\bdate\b/i, /\bdt\b/i, /\byear.*month/i, /\btimestamp/i,
    /\bobs.*date/i, /\bvalid/i, /\byyyymmdd/i, /\bymdt/i,
  ],
  time: [
    /\btime\b/i, /\bhour\b/i, /\bhh:?mm/i, /\butc\b/i,
    /\blocal.*time/i, /\bhhmm\b/i, /\bhrmin\b/i,
  ],
  direction: [
    /\bdir(?:ection)?\b/i,        // direction, dir
    /\bdirec\b/i,                  // direc (truncated)
    /\bwdir\b/i,                   // wdir
    /\bwind.*dir/i,                // wind_dir, wind_direction, wind_direc
    /\bdrct\b/i,                   // NOAA: drct
    /\b(?:dd|wd)\b/i,              // dd, wd
    /^dir/i,                       // starts with dir
  ],
  speed: [
    /\bspee?d?\b/i,                // speed, spee (truncated), spd
    /\bspd\b/i,
    /\bwind.*sp/i,                 // wind_spee, wind_speed, wind_spd
    /\bsknt\b/i,                   // NOAA: sknt
    /\b(?:ws|ff)\b/i,              // ws, ff
    /\bknots?\b/i,
    /^spd/i, /^spee/i,
  ],
  gust: [
    /\bgust\b/i, /\bgst\b/i,
    /\bpeak.*wind/i, /\bmax.*gust/i,
    /\bfx\b/i,
    /^gust/i,
  ],
};

// ── Exact / prefix alias table (checked BEFORE regex, case-insensitive) ───────
// Handles truncated names that regex word boundaries miss.

const COLUMN_ALIASES: Record<keyof DetectedColumns, string[]> = {
  date:      ["date", "dt", "obs_date", "observation_date", "day", "yyyymmdd"],
  time:      ["time", "hour", "hhmm", "utc", "obs_time", "observation_time"],
  direction: [
    "wind_direc", "wind_dir", "wind_direction", "wind_d", "wdir",
    "direction", "direc", "dir", "drct", "dd", "wd",
  ],
  speed:     [
    "wind_spee", "wind_speed", "wind_spd", "wind_s", "wspd",
    "speed", "spee", "spd", "sknt", "ws", "ff",
  ],
  gust:      ["gust", "gst", "peak_gust", "max_gust", "gust_spd", "fx", "gust_speed"],
};

// ── Column auto-detection ──────────────────────────────────────────────────────

export function detectColumns(headers: string[]): DetectedColumns & { mappingLog: string[] } {
  const detected: DetectedColumns = { date: null, time: null, direction: null, speed: null, gust: null };
  const mappingLog: string[] = [];

  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-\/\\]+/g, "_");

  // Pass 1 — exact alias match (handles truncated names)
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof DetectedColumns)[]) {
    if (detected[key]) continue;
    for (const header of headers) {
      const n = norm(header);
      if (COLUMN_ALIASES[key].some(alias => alias.toLowerCase() === n)) {
        detected[key] = header.trim();
        mappingLog.push(`${key}: "${header.trim()}" (exact alias match)`);
        break;
      }
    }
  }

  // Pass 2 — prefix/contains alias match (handles "wind_direc_10m" etc.)
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof DetectedColumns)[]) {
    if (detected[key]) continue;
    for (const header of headers) {
      const n = norm(header);
      if (COLUMN_ALIASES[key].some(alias => n.startsWith(alias.toLowerCase()) || n.includes(alias.toLowerCase()))) {
        detected[key] = header.trim();
        mappingLog.push(`${key}: "${header.trim()}" (alias prefix/contains match)`);
        break;
      }
    }
  }

  // Pass 3 — regex patterns (original approach)
  for (const key of Object.keys(COLUMN_PATTERNS) as (keyof DetectedColumns)[]) {
    if (detected[key]) continue;
    for (const header of headers) {
      const trimmed = header.trim();
      if (COLUMN_PATTERNS[key].some((p) => p.test(trimmed))) {
        detected[key] = trimmed;
        mappingLog.push(`${key}: "${trimmed}" (regex match)`);
        break;
      }
    }
  }

  // Pass 4 — positional fallback for common 5-column layouts
  // e.g. date | time | direction | speed | gust
  if (!detected.direction && !detected.speed && headers.length >= 3) {
    const numericCols = headers.filter((_, i) => i >= 2); // skip first 2 (date/time)
    if (numericCols.length >= 2) {
      detected.direction = detected.direction ?? numericCols[0]?.trim() ?? null;
      detected.speed     = detected.speed     ?? numericCols[1]?.trim() ?? null;
      if (numericCols.length >= 3) detected.gust = detected.gust ?? numericCols[2]?.trim() ?? null;
      mappingLog.push(`direction/speed: positional fallback — verify column order`);
    }
  }

  // Log undetected required columns
  if (!detected.direction) mappingLog.push("⚠ direction: NOT DETECTED — all bins will be zero");
  if (!detected.speed)     mappingLog.push("⚠ speed: NOT DETECTED — calm classification will be wrong");

  return { ...detected, mappingLog };
}



// ── Compass direction map ─────────────────────────────

const DIRECTION_MAP: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

// ── File reading ──────────────────────────────────────

export function readFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          resolve(rows.map(r => r.map(String)));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target!.result as string;
        const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
        resolve(result.data);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
}

// ── Direction parsing ──────────────────────────────────

function parseDirection(val: string): number | null {

  if (!val || val.trim() === "" || /calm|vrb|variable/i.test(val)) return null;

  const upper = val.trim().toUpperCase();
  if (upper in DIRECTION_MAP) return DIRECTION_MAP[upper];

  const num = parseFloat(val);
  if (!isNaN(num) && num >= 0 && num <= 360) return num % 360;

  return null;
}

// ── Speed parsing & unit normalization ─────────────────

function parseSpeed(val: string, unit?: string): number | null {
  if (!val || val.trim() === "" || /calm/i.test(val)) return 0;

  const num = parseFloat(val.replace(/[^\d.\-]/g, ""));
  if (isNaN(num) || num < 0) return null;

  // Convert to knots
  if (unit && /m\/s|mps/i.test(unit)) return num * 1.94384;
  if (unit && /km\/h|kph|kmh/i.test(unit)) return num * 0.539957;
  if (unit && /mph/i.test(unit)) return num * 0.868976;
  return num; // assume knots
}

// ── Dataset classification ─────────────────────────────

function classifyDataset(records: WindRecord[]): "hourly" | "sub-daily" | "daily" | "monthly" | "unknown" {
  if (records.length < 2) return "unknown";

  const withTimes = records.filter((r) => r.observation_time && r.observation_time !== "");
  if (withTimes.length === 0) {
    const uniqueDates = new Set(records.map((r) => r.observation_date));
    if (uniqueDates.size < records.length * 0.1) return "monthly";
    return "daily";
  }

  // Estimate interval from first few records
  const timestamps: number[] = [];
  for (let i = 0; i < Math.min(20, records.length); i++) {
    const d = new Date(`${records[i].observation_date} ${records[i].observation_time}`);
    if (!isNaN(d.getTime())) timestamps.push(d.getTime());
  }

  if (timestamps.length < 2) return "unknown";

  const diffs: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    diffs.push(timestamps[i] - timestamps[i - 1]);
  }

  const medianDiff = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
  const hours = medianDiff / 3600000;

  if (hours <= 1.5) return "hourly";
  if (hours <= 6) return "sub-daily";
  if (hours <= 36) return "daily";
  return "monthly";
}

// ── Reliability scoring ────────────────────────────────

function assessReliability(
  records: WindRecord[],
  totalRows: number,
  invalidRows: number,
  missingValues: number,
  datasetType: string
): { reliability: "high" | "medium" | "low"; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;

  const validPct = ((totalRows - invalidRows) / totalRows) * 100;
  if (validPct < 80) { score -= 40; reasons.push(`Only ${validPct.toFixed(1)}% of rows are valid`); }
  else if (validPct < 95) { score -= 15; reasons.push(`${validPct.toFixed(1)}% valid rows (< 95%)`); }

  if (missingValues > totalRows * 0.1) { score -= 20; reasons.push("More than 10% missing values"); }

  if (records.length < 8760) { score -= 10; reasons.push("Less than 1 year of hourly data"); }
  if (records.length < 4380) { score -= 15; reasons.push("Less than 6 months of data"); }

  if (datasetType === "daily" || datasetType === "monthly") {
    score -= 20;
    reasons.push("Aggregated data — not individual observations");
  }

  if (datasetType === "unknown") { score -= 25; reasons.push("Could not classify data interval"); }

  if (score >= 75) return { reliability: "high", reasons };
  if (score >= 45) return { reliability: "medium", reasons };
  return { reliability: "low", reasons };
}

// ── Main parse function ────────────────────────────────

export async function parseWindData(file: File, calmThreshold: number = 3): Promise<ParsedWindData> {
  const rawRows = await readFile(file);

  if (rawRows.length < 2) {
    throw new Error("File contains insufficient data (need at least a header row and one data row).");
  }

  const headers = rawRows[0];
  const { mappingLog, ...columns } = detectColumns(headers);
  const warnings: string[] = [];

  // Surface column mapping to UI — critical for debugging import issues
  warnings.push(...mappingLog.map(l => `Column map: ${l}`));

  if (!columns.direction) warnings.push("⚠ Wind direction column not detected — all bins will be zero. Check column names.");
  if (!columns.speed)     warnings.push("⚠ Wind speed column not detected — calm classification will fail. Check column names.");


  const dataRows = rawRows.slice(1);
  if (dataRows.length === 0) {
    throw new Error("Dataset is empty. No data rows found.");
  }

  let invalidRows = 0;
  let missingValues = 0;
  const records: WindRecord[] = [];

  for (const row of dataRows) {
    const rawObj: Record<string, string> = {};
    headers.forEach((h, i) => { rawObj[h] = row[i] || ""; });

    const dirStr = columns.direction ? rawObj[columns.direction] : "";
    const spdStr = columns.speed ? rawObj[columns.speed] : "";
    const gustStr = columns.gust ? rawObj[columns.gust] : "";
    const dateStr = columns.date ? rawObj[columns.date] : "";
    const timeStr = columns.time ? rawObj[columns.time] : "";

    const dir = parseDirection(dirStr);
    const spd = parseSpeed(spdStr);
    const gust = gustStr ? parseSpeed(gustStr) : null;

    if (dir === null && spd === null) {
      invalidRows++;
      continue;
    }

    if (spd !== null && spd > 100) {
      warnings.push(`⚠ Rejected row: Unrealistic wind speed (>100 kts) detected: ${spd.toFixed(1)} kts`);
      invalidRows++;
      continue;
    }

    if (gust !== null && gust > 100) {
      warnings.push(`⚠ Rejected row: Unrealistic wind gust (>100 kts) detected: ${gust.toFixed(1)} kts`);
      invalidRows++;
      continue;
    }

    if (dir === null || spd === null) missingValues++;

    const isCalm = (spd !== null && spd <= calmThreshold) || /calm/i.test(dirStr) || /calm/i.test(spdStr);

    records.push({
      observation_date: dateStr,
      observation_time: timeStr,
      wind_direction_deg: dir ?? 0,
      wind_speed_kt: spd ?? 0,
      wind_gust_kt: gust,
      isCalm,
      isValid: dir !== null && spd !== null,
      raw: rawObj,
    });
  }

  const datasetType = classifyDataset(records);

  let dateRange: { start: string; end: string } | null = null;
  const dates = records.map((r) => r.observation_date).filter(Boolean).sort();
  if (dates.length >= 2) dateRange = { start: dates[0], end: dates[dates.length - 1] };

  const { reliability, reasons } = assessReliability(records, dataRows.length, invalidRows, missingValues, datasetType);

  if (datasetType === "daily" || datasetType === "monthly") {
    warnings.push("Data appears to be aggregated. Individual observations are preferred for accurate wind roses.");
  }

  return {
    records,
    totalRows: dataRows.length,
    validRows: records.length,
    invalidRows,
    missingValues,
    dateRange,
    datasetType,
    reliability,
    reliabilityReasons: reasons,
    columns,
    warnings,
  };
}
