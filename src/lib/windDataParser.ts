import Papa from "papaparse";
import * as XLSX from "xlsx";

const MONTH_NAME_TO_NUM: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/** Month 1–12 from numeric string or English month name (for split-date CSV / raw fallback). */
function parseMonthToken(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const v = Math.round(parseFloat(t));
    return v >= 1 && v <= 12 ? v : null;
  }
  const s = t.replace(/\./g, "");
  if (MONTH_NAME_TO_NUM[s] !== undefined) return MONTH_NAME_TO_NUM[s];
  const abbr = s.slice(0, 3);
  if (MONTH_NAME_TO_NUM[abbr] !== undefined) return MONTH_NAME_TO_NUM[abbr];
  return null;
}

/** Arabic-Indic / Persian digits → ASCII; trim; common thousands separators. */
function normalizeNumericCell(val: string): string {
  return val
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/\u00a0/g, " ")
    .replace(/,/g, ".")
    .trim();
}

/** Excel serial day → calendar (1900 date system), typical file range only. */
function excelSerialToYmd(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial)) return null;
  const n = Math.round(serial);
  if (n < 20000 || n > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + n * 86400000;
  const dt = new Date(utc);
  const y = dt.getUTCFullYear();
  if (y < 1950 || y > 2100) return null;
  return { y, m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Build YYYY-MM-DD from Year / Month / Day cells (handles Excel floats, 2-digit year, month names). */
function assembleDateFromYMDParts(yrRaw: string, moRaw: string, dyRaw: string): string | null {
  const yrS = normalizeNumericCell(yrRaw);
  const moS = normalizeNumericCell(moRaw);
  const dyS = normalizeNumericCell(dyRaw || "1");
  if (!yrS || !moS) return null;

  let yNum = Math.round(parseFloat(yrS));
  if (!Number.isFinite(yNum)) return null;
  if (yNum >= 20000 && yNum <= 60000) {
    const ex = excelSerialToYmd(yNum);
    if (ex) return `${ex.y}-${String(ex.m).padStart(2, "0")}-${String(ex.d).padStart(2, "0")}`;
  }
  if (yNum >= 0 && yNum <= 99) yNum += yNum >= 70 ? 1900 : 2000;
  if (yNum < 1800 || yNum > 2200) return null;

  let mNum = parseMonthToken(moS);
  if (mNum === null) {
    const mr = Math.round(parseFloat(moS));
    if (mr >= 1 && mr <= 12) mNum = mr;
  }
  if (mNum === null || mNum < 1 || mNum > 12) return null;

  const dNum = Math.max(1, Math.min(31, Math.round(parseFloat(dyS)) || 1));

  return `${yNum}-${String(mNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
}

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

/** UTC month index 0–11 for coverage charts (ISO date, loose parsing, or raw `Month` column). */
export function getObservationUtcMonthIndex0(r: WindRecord): number | null {
  const dstr = r.observation_date?.trim();
  if (dstr) {
    const numCell = normalizeNumericCell(dstr);
    if (/^\d+(\.\d+)?$/.test(numCell)) {
      const ser = Math.round(parseFloat(numCell));
      if (ser >= 20000 && ser <= 60000) {
        const ex = excelSerialToYmd(ser);
        if (ex) return ex.m - 1;
      }
    }
    const iso = dstr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const y = parseInt(iso[1], 10);
      const mo = parseInt(iso[2], 10);
      const day = parseInt(iso[3], 10);
      if (y >= 1800 && y <= 2200 && mo >= 1 && mo <= 12 && day >= 1 && day <= 31) return mo - 1;
    }
    const isoLoose = dstr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\b|T|$)/);
    if (isoLoose) {
      const y = parseInt(isoLoose[1], 10);
      const mo = parseInt(isoLoose[2], 10);
      const day = parseInt(isoLoose[3], 10);
      if (y >= 1800 && y <= 2200 && mo >= 1 && mo <= 12 && day >= 1 && day <= 31) return mo - 1;
    }
    const d = new Date(dstr.includes("T") ? dstr : `${dstr}T12:00:00Z`);
    if (!isNaN(d.getTime())) return d.getUTCMonth();
    const slash = dstr.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (slash) {
      const a = parseInt(slash[1], 10);
      const b = parseInt(slash[2], 10);
      const yRaw = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
      const y = parseInt(yRaw, 10);
      let mo: number;
      let day: number;
      if (a > 12) {
        day = a;
        mo = b;
      } else if (b > 12) {
        mo = a;
        day = b;
      } else {
        mo = a;
        day = b;
      }
      if (y >= 1800 && y <= 2200 && mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
        return mo - 1;
      }
    }
  }
  const normK = (k: string) =>
    k.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s\-/\\]+/g, "_");
  const isMonthKey = (n: string) =>
    n === "mon" ||
    n === "mo" ||
    n === "mm" ||
    n === "month" ||
    n === "month_no" ||
    n === "month_number" ||
    n === "mnth" ||
    n === "calendar_month" ||
    (n.startsWith("month_") && !n.startsWith("months")) ||
    (n.endsWith("_month") && !n.endsWith("_months"));
  for (const [k, val] of Object.entries(r.raw)) {
    const n = normK(k);
    if (isMonthKey(n)) {
      const mt = parseMonthToken(String(val));
      if (mt !== null) return mt - 1;
    }
  }
  return null;
}

/** Calendar month 1–12 for filters (null if unknown). */
export function getObservationCalendarMonth1to12(r: WindRecord): number | null {
  const z = getObservationUtcMonthIndex0(r);
  return z === null ? null : z + 1;
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
  // Split-date columns (Year / Month / Day as separate fields)
  yearCol: string | null;
  monthCol: string | null;
  dayCol: string | null;
  // mappingLog is returned separately from detectColumns but NOT stored in this interface
  // to avoid conflicts with Record<keyof DetectedColumns, ...> usage
}

// ── Column detection patterns ──────────────────────────

// ── Column detection patterns (regex — applied after exact-alias table) ───────

const COLUMN_PATTERNS: Record<Exclude<keyof DetectedColumns, "yearCol"|"monthCol"|"dayCol">, RegExp[]> = {
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
    /\bwd\b/i,                     // wd (not bare "dd" — conflicts with day column "DD")
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

const COLUMN_ALIASES: Record<Exclude<keyof DetectedColumns, "yearCol"|"monthCol"|"dayCol">, string[]> = {
  date:      ["date", "dt", "obs_date", "observation_date", "yyyymmdd"],
  time:      ["time", "hour", "hhmm", "utc", "obs_time", "observation_time"],
  direction: [
    "wind_direc", "wind_dir", "wind_direction", "wind_d", "wdir",
    "direction", "direc", "dir", "drct", "wd",
    // Truncated variants
    "wind_di", "wind_de",
    // Note: bare "dd" omitted — same label as day-of-month "DD" in Y-M-D grids
  ],
  speed:     [
    "wind_spee", "wind_speed", "wind_spd", "wind_s", "wspd",
    "speed", "spee", "spd", "sknt", "ws", "ff",
    // Truncated variants (e.g. Wind_Spe from Excel column width limit)
    "wind_spe", "wind_sp", "wind_spdee",
  ],
  gust:      ["gust", "gst", "peak_gust", "max_gust", "gust_spd", "fx", "gust_speed"],
};

// Split-date column aliases (Year / Month / Day as separate columns)
const SPLIT_DATE_ALIASES: Record<"yearCol"|"monthCol"|"dayCol", string[]> = {
  yearCol:  ["year", "yr", "yyyy"],
  // Numeric 1–12 in CSV maps to January–December (see QA dashboard labels)
  monthCol: ["month", "mon", "mo", "mm", "month_no", "mnth", "calendar_month", "month_number"],
  dayCol:   ["day", "dy", "dd"],
};

/** True if header name is clearly wind *speed*, not direction (avoids "wind_spee" matching Wind_Speed for direction). */
function headerLooksLikeWindSpeedOnly(n: string): boolean {
  const hasSpd =
    n.includes("speed") ||
    n.includes("spee") ||
    /\bspd\b/.test(n) ||
    /\bws\b/.test(n) ||
    /\bff\b/.test(n) ||
    /\bsknt\b/.test(n);
  if (!hasSpd) return false;
  const hasDir =
    n.includes("dir") ||
    n.includes("direc") ||
    n.includes("wdir") ||
    /\bdd\b/.test(n) ||
    n.includes("from");
  return !hasDir;
}

/**
 * When CSV is exactly Year, Month, Day, hour, wind-dir, wind-spd, lock direction/speed to the last two
 * columns so mis-detection cannot map both to Wind_Speed.
 */
function splitDateNormMatches(norm: string, key: "yearCol" | "monthCol" | "dayCol"): boolean {
  return SPLIT_DATE_ALIASES[key].some((alias) => alias.toLowerCase() === norm);
}

/** True if column 4 looks like observation hour / time (not wind). */
function timeLikeHeaderNorm(n: string): boolean {
  if (!n) return false;
  if (n === "utc" || n === "gmt" || n === "z") return true;
  if (n.includes("hour") && !n.includes("wind") && !n.includes("speed")) return true;
  if (
    n === "hr" ||
    n === "time" ||
    n === "hh" ||
    n === "hhmm" ||
    n === "hh_mm" ||
    n === "obs_time" ||
    n === "observation_time"
  )
    return true;
  if (n.startsWith("time_") || (n.endsWith("_time") && !n.includes("wind"))) return true;
  return false;
}

/**
 * Year | Month | Day | Hour | … | wind-from | speed (last two columns).
 * Stops alias "dd"/regex from binding wind direction to the calendar "DD" day column.
 */
function forceTrailingWindColumnsForYmdhLayout(
  headers: string[],
  columns: DetectedColumns,
  warnings: string[]
): void {
  if (headers.length < 6) return;
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-/\\]+/g, "_");
  const h = headers.map((x) => norm(x));
  if (!splitDateNormMatches(h[0], "yearCol")) return;
  if (!splitDateNormMatches(h[1], "monthCol")) return;
  if (!splitDateNormMatches(h[2], "dayCol")) return;
  if (!timeLikeHeaderNorm(h[3])) return;

  const dirH = headers[headers.length - 2].trim();
  const spdH = headers[headers.length - 1].trim();
  if (!dirH || !spdH || dirH === spdH) return;

  if (columns.direction !== dirH || columns.speed !== spdH) {
    warnings.push(
      `Column map: direction/speed locked to last two columns after Y/M/D/time (… "${dirH}", "${spdH}")`
    );
  }
  columns.direction = dirH;
  columns.speed = spdH;
}

/**
 * Many grids export … | Hour | Wind speed | Wind direction (°) — opposite of our default penultimate=dir, last=spd.
 * Returns whether headers clearly indicate that order.
 */
function headerOrderHintLastTwo(hPen: string, hLast: string): "speed_then_direction" | "direction_then_speed" | null {
  const pen = hPen.trim();
  const last = hLast.trim();
  const nPen = pen.toLowerCase().replace(/[\s\-/\\]+/g, "_");
  const nLast = last.toLowerCase().replace(/[\s\-/\\]+/g, "_");

  if (/^ws$/i.test(pen) && /^wd$/i.test(last)) return "speed_then_direction";
  if (/^wd$/i.test(pen) && /^ws$/i.test(last)) return "direction_then_speed";

  const penSpdOnly =
    headerLooksLikeWindSpeedOnly(nPen) ||
    (/\b(spd|speed|spee|ff|sknt)\b/i.test(pen) && !/\bdir\b/i.test(pen) && !/\bdirec/i.test(nPen));
  const penDir =
    (/\bdir\b/i.test(pen) || /\bdirec/i.test(nPen) || /\bwdir\b/i.test(nPen) || /\bdrct\b/i.test(nPen)) &&
    !headerLooksLikeWindSpeedOnly(nPen);
  const lastDir =
    (/\bdir\b/i.test(last) || /\bdirec/i.test(nLast) || /\bwdir\b/i.test(nLast) || /\bdrct\b/i.test(last)) &&
    !headerLooksLikeWindSpeedOnly(nLast);
  const lastSpdOnly =
    headerLooksLikeWindSpeedOnly(nLast) ||
    (/\b(spd|speed|spee|ff|sknt)\b/i.test(last) && !/\bdir\b/i.test(last) && !/\bdirec/i.test(nLast));

  if (penSpdOnly && lastDir && !penDir) return "speed_then_direction";
  if (penDir && lastSpdOnly && !lastDir) return "direction_then_speed";

  const penWindSpd = /\bwind\b/i.test(pen) && /\b(sp|speed|spee|kt)\b/i.test(pen) && !/\bdir\b/i.test(pen);
  const lastWindDir = /\bwind\b/i.test(last) && /\bdir\b/i.test(last);
  if (penWindSpd && lastWindDir) return "speed_then_direction";

  const penWindDir = /\bwind\b/i.test(pen) && /\bdir\b/i.test(pen);
  const lastWindSpd = /\bwind\b/i.test(last) && /\b(sp|speed|spee)\b/i.test(last) && !/\bdir\b/i.test(last);
  if (penWindDir && lastWindSpd) return "direction_then_speed";

  return null;
}

function sampleNumericFromColumn(rows: string[][], colIdx: number, maxVals = 1200): number[] {
  const n = rows.length;
  if (n === 0 || colIdx < 0) return [];
  const per = Math.min(400, Math.max(80, Math.floor(maxVals / 3)));
  const idxs = new Set<number>();
  for (let k = 0; k < per; k++) idxs.add(k);
  const mid = Math.floor(n / 2);
  for (let k = 0; k < per; k++) idxs.add(Math.min(n - 1, Math.max(0, mid - Math.floor(per / 2) + k)));
  for (let k = 0; k < per; k++) idxs.add(n - 1 - k);
  const vals: number[] = [];
  for (const i of idxs) {
    if (i < 0 || i >= n) continue;
    const row = rows[i];
    if (colIdx >= row.length) continue;
    const raw = cleanHeaderLabel(String(row[colIdx] ?? ""));
    const x = parseFloat(normalizeNumericCell(raw).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(x) && x >= 0) vals.push(x);
  }
  return vals;
}

function columnLooksLikeWindDirectionDeg(vals: number[]): boolean {
  if (vals.length < 35) return false;
  const sorted = [...vals].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const frac90 = vals.filter((v) => v >= 90).length / vals.length;
  const frac180 = vals.filter((v) => v >= 180).length / vals.length;
  return max > 150 || frac90 > 0.07 || frac180 > 0.015 || p95 > 110;
}

function columnLooksLikeWindSpeedKt(vals: number[]): boolean {
  if (vals.length < 35) return false;
  const sorted = [...vals].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  if (max > 360 || (max > 200 && p95 > 180)) return false;
  return max <= 95 && p95 <= 65;
}

/** If direction/speed are the last two columns, fix Speed-then-Direction exports. */
function resolveSpeedBeforeDirectionForTrailingColumns(
  headers: string[],
  columns: DetectedColumns,
  dataRows: string[][],
  warnings: string[]
): void {
  if (!columns.direction || !columns.speed || headers.length < 6) return;
  const th = headers.map((h) => h.trim());
  const n = headers.length;
  const dirIdx = th.indexOf(columns.direction.trim());
  const spdIdx = th.indexOf(columns.speed.trim());
  if (dirIdx !== n - 2 || spdIdx !== n - 1) return;

  const hPen = headers[n - 2];
  const hLast = headers[n - 1];
  const hint = headerOrderHintLastTwo(hPen, hLast);
  if (hint === "direction_then_speed") return;
  if (hint === "speed_then_direction") {
    const tmp = columns.direction;
    columns.direction = columns.speed;
    columns.speed = tmp;
    warnings.push(
      `Column map: using speed in column ${n - 1} (from left) and direction (°) in column ${n} — matched header names.`
    );
    return;
  }

  const valsP = sampleNumericFromColumn(dataRows, n - 2);
  const valsL = sampleNumericFromColumn(dataRows, n - 1);
  const pDir = columnLooksLikeWindDirectionDeg(valsP);
  const pSpd = columnLooksLikeWindSpeedKt(valsP);
  const lDir = columnLooksLikeWindDirectionDeg(valsL);
  const lSpd = columnLooksLikeWindSpeedKt(valsL);

  const maxP = valsP.length ? Math.max(...valsP) : 0;
  const maxL = valsL.length ? Math.max(...valsL) : 0;

  if (pSpd && lDir && (!pDir || maxL > maxP + 35)) {
    const tmp = columns.direction;
    columns.direction = columns.speed;
    columns.speed = tmp;
    warnings.push(
      `Column map: using speed in column ${n - 1} and direction (°) in column ${n} — values in the last column look like degrees (0–360°), the previous like knots.`
    );
    return;
  }

  if (pSpd && lDir && !pDir && !lSpd) {
    const tmp = columns.direction;
    columns.direction = columns.speed;
    columns.speed = tmp;
    warnings.push(
      `Column map: using speed then direction in the last two columns — inferred from numeric ranges in your file.`
    );
  }
}

function forceClassicSixColumnWind(headers: string[], columns: DetectedColumns, warnings: string[]): void {
  if (headers.length !== 6) return;
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-/\\]+/g, "_");
  const y = (i: number) => norm(headers[i]);
  const yearOk = y(0) === "year" || y(0) === "yyyy" || y(0) === "yr";
  const monthOk = y(1) === "month" || y(1) === "mon" || y(1) === "mm" || y(1) === "mo";
  const dayOk = y(2) === "day" || y(2) === "dy" || y(2) === "dd";
  const hourOk =
    y(3) === "hour" ||
    y(3) === "hr" ||
    y(3) === "time" ||
    y(3) === "hh" ||
    y(3) === "utc" ||
    y(3) === "gmt" ||
    timeLikeHeaderNorm(y(3));
  if (!yearOk || !monthOk || !dayOk || !hourOk) return;

  const h4 = headers[4].trim();
  const h5 = headers[5].trim();
  const n4 = norm(headers[4]);
  const n5 = norm(headers[5]);
  const fourthDir = (n4.includes("dir") || /\bdir\b/i.test(headers[4])) && !headerLooksLikeWindSpeedOnly(n4);
  const fifthSpd =
    headerLooksLikeWindSpeedOnly(n5) || (/\bwind\b/i.test(headers[5]) && /\bsp/i.test(headers[5]) && !/\bdir/i.test(headers[5]));
  const fourthSpd =
    headerLooksLikeWindSpeedOnly(n4) || (/\bwind\b/i.test(headers[4]) && /\bsp/i.test(headers[4]) && !/\bdir/i.test(headers[4]));
  const fifthDir = (n5.includes("dir") || /\bdir\b/i.test(headers[5])) && !headerLooksLikeWindSpeedOnly(n5);

  if (fourthDir && fifthSpd) {
    if (columns.direction !== h4 || columns.speed !== h5) {
      warnings.push(`Column map: direction/speed locked to columns 5–6 (Year, Month, Day, hour, wind, wind)`);
    }
    columns.direction = h4;
    columns.speed = h5;
  } else if (fourthSpd && fifthDir) {
    if (columns.direction !== h5 || columns.speed !== h4) {
      warnings.push(`Column map: direction/speed locked to columns 5–6 (speed then direction °)`);
    }
    columns.speed = h4;
    columns.direction = h5;
  }
}

// ── Column auto-detection ──────────────────────────────────────────────────────

export function detectColumns(headers: string[]): DetectedColumns & { mappingLog: string[] } {
  const detected: DetectedColumns = {
    date: null, time: null, direction: null, speed: null, gust: null,
    yearCol: null, monthCol: null, dayCol: null,
  };
  const mappingLog: string[] = [];

  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-/\\]+/g, "_");

  // Pass 1 — exact alias match (handles truncated names)
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]) {
    if (detected[key]) continue;
    for (const header of headers) {
      const n = norm(header);
      if (key === "direction" && headerLooksLikeWindSpeedOnly(n)) continue;
      if (COLUMN_ALIASES[key].some(alias => alias.toLowerCase() === n)) {
        detected[key] = header.trim();
        mappingLog.push(`${key}: "${header.trim()}" (exact alias match)`);
        break;
      }
    }
  }

  // Pass 2 — prefix/contains alias match (handles "wind_direc_10m" etc.)
  // Also handles truncated column names: column may be a prefix of the alias
  // e.g. column "wind_spe" is a prefix-truncation of alias "wind_spee"
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]) {
    if (detected[key]) continue;
    for (const header of headers) {
      const n = norm(header);
      if (key === "direction" && headerLooksLikeWindSpeedOnly(n)) continue;
      if (COLUMN_ALIASES[key].some(alias => {
        const a = alias.toLowerCase();
        // Column starts with alias (alias is prefix of column): "wind_speed_ms" contains "wind_spee"
        // Column is contained in alias (column is truncation of alias): "wind_spe" is start of "wind_spee"
        return n.startsWith(a) || n.includes(a) || (n.length >= 4 && a.startsWith(n));
      })) {
        detected[key] = header.trim();
        mappingLog.push(`${key}: "${header.trim()}" (alias prefix/contains match)`);
        break;
      }
    }
  }

  // Pass 3 — regex patterns (original approach)
  for (const key of Object.keys(COLUMN_PATTERNS) as (keyof DetectedColumns)[]) {
    if (key === "yearCol" || key === "monthCol" || key === "dayCol") continue;
    if (detected[key]) continue;
    for (const header of headers) {
      const trimmed = header.trim();
      const n = norm(header);
      if (key === "direction" && headerLooksLikeWindSpeedOnly(n)) continue;
      if (COLUMN_PATTERNS[key as keyof typeof COLUMN_PATTERNS]?.some((p) => p.test(trimmed))) {
        detected[key] = trimmed;
        mappingLog.push(`${key}: "${trimmed}" (regex match)`);
        break;
      }
    }
  }

  // Pass 4 — detect split date columns (Year / Month / Day) if no full date was found
  for (const key of Object.keys(SPLIT_DATE_ALIASES) as ("yearCol"|"monthCol"|"dayCol")[]) {
    for (const header of headers) {
      const n = norm(header);
      if (SPLIT_DATE_ALIASES[key].some(alias => alias.toLowerCase() === n)) {
        detected[key] = header.trim();
        mappingLog.push(`${key}: "${header.trim()}" (split-date exact match)`);
        break;
      }
    }
  }

  // If we found split-date columns but no full date column, note it
  if (!detected.date && detected.yearCol && detected.monthCol) {
    mappingLog.push(`date: assembled from ${detected.yearCol}/${detected.monthCol}/${detected.dayCol ?? "(no day)"}`);
  }

  // Pass 5 — wind columns when direction/speed were not detected (non-English headers, etc.)
  if (!detected.direction && !detected.speed) {
    const hNorms = headers.map((x) => norm(x));
    const ymdTimeGrid =
      headers.length >= 6 &&
      splitDateNormMatches(hNorms[0], "yearCol") &&
      splitDateNormMatches(hNorms[1], "monthCol") &&
      splitDateNormMatches(hNorms[2], "dayCol") &&
      timeLikeHeaderNorm(hNorms[3]);

    if (ymdTimeGrid) {
      const dirH = headers[headers.length - 2].trim();
      const spdH = headers[headers.length - 1].trim();
      if (dirH && spdH && dirH !== spdH) {
        detected.direction = dirH;
        detected.speed = spdH;
        detected.gust = null;
        mappingLog.push(
          `direction/speed: Y-M-D-time grid — using last two columns "${dirH}", "${spdH}" (not col 3–4)`
        );
      }
    } else if (headers.length >= 6) {
      const dirH = headers[headers.length - 2].trim();
      const spdH = headers[headers.length - 1].trim();
      if (dirH && spdH && dirH !== spdH) {
        detected.direction = dirH;
        detected.speed = spdH;
        detected.gust = null;
        mappingLog.push(
          `direction/speed: ${headers.length} columns — using last two as wind-from / speed (verify if wrong)`
        );
      }
    } else if (headers.length >= 3) {
      const numericCols = headers.filter((_, i) => i >= 2);
      if (numericCols.length >= 2) {
        detected.direction = numericCols[0]?.trim() ?? null;
        detected.speed = numericCols[1]?.trim() ?? null;
        if (numericCols.length >= 3) detected.gust = detected.gust ?? numericCols[2]?.trim() ?? null;
        mappingLog.push(`direction/speed: positional fallback (≤5 useful cols) — verify column order`);
      }
    }
  }

  // Gust must not reuse a column that is clearly wind direction (degrees were read as gust kt)
  if (detected.gust) {
    const gn = norm(detected.gust);
    const looksLikeDir =
      (/\bdir\b/i.test(detected.gust) ||
        /\bdirec/i.test(gn) ||
        /\bwdir\b/i.test(gn) ||
        /\bdrct\b/i.test(gn) ||
        /^wd$/i.test(detected.gust.trim())) &&
      !/\bgust\b/i.test(detected.gust) &&
      !/\bgst\b/i.test(gn);
    if (looksLikeDir && !headerLooksLikeWindSpeedOnly(gn)) {
      mappingLog.push(`gust: cleared — "${detected.gust}" is a direction column, not gust`);
      detected.gust = null;
    }
  }

  // Direction/speed were wrongly tied to Day/Hour (cols 3–4) while real wind is in the last two columns
  if (headers.length >= 6 && detected.direction && detected.speed) {
    const hNorms = headers.map((x) => norm(x));
    const ymdTime =
      splitDateNormMatches(hNorms[0], "yearCol") &&
      splitDateNormMatches(hNorms[1], "monthCol") &&
      splitDateNormMatches(hNorms[2], "dayCol") &&
      timeLikeHeaderNorm(hNorms[3]);
    if (ymdTime) {
      const th = headers.map((x) => x.trim());
      const di = th.indexOf(detected.direction.trim());
      const si = th.indexOf(detected.speed.trim());
      const iLast2 = headers.length - 2;
      if (di >= 0 && di < iLast2 && si >= 0 && si < iLast2) {
        const dirH = headers[iLast2].trim();
        const spdH = headers[iLast2 + 1].trim();
        mappingLog.push(
          `direction/speed: reassigned to last two columns "${dirH}", "${spdH}" (was on calendar/time slots)`
        );
        detected.direction = dirH;
        detected.speed = spdH;
        detected.gust = null;
      }
    }
  }

  // Deduplication: clear any field that was assigned the same column as direction or speed
  // (prevents gust from being accidentally mapped to the wind direction or speed column)
  const usedCols = new Set<string | null>([detected.direction, detected.speed]);
  if (detected.gust && usedCols.has(detected.gust)) {
    mappingLog.push(`gust: cleared (was duplicate of direction/speed column "${detected.gust}")`);
    detected.gust = null;
  }
  if (detected.date && usedCols.has(detected.date)) detected.date = null;
  if (detected.time && usedCols.has(detected.time)) detected.time = null;

  // Same physical column for direction & speed (e.g. Wind_Speed matched direction via "wind_spee" substring)
  if (detected.direction && detected.speed && detected.direction === detected.speed) {
    mappingLog.push(
      `⚠ direction and speed both mapped to "${detected.direction}" — resolving separate wind columns`
    );
    const dirCand =
      headers.find((h) => {
        const n = norm(h);
        if (headerLooksLikeWindSpeedOnly(n)) return false;
        return /\bwind.*dir/i.test(h) || /\bdir(?:ection)?\b/i.test(h) || /\bdirec/i.test(n) || /\bwdir\b/i.test(n);
      }) ??
      headers.find((h) => {
        const n = norm(h);
        return !headerLooksLikeWindSpeedOnly(n) && n.includes("dir") && !n.includes("speed") && !n.includes("spee");
      });
    let spdCand = headers.find((h) => {
      const t = h.trim();
      if (dirCand && t === dirCand.trim()) return false;
      const n = norm(h);
      return headerLooksLikeWindSpeedOnly(n) || (/\bwind.*sp/i.test(h) && !/\bdir/i.test(h));
    });
    if (!spdCand && dirCand) {
      spdCand = headers.find((h) => {
        const t = h.trim();
        if (t === dirCand!.trim()) return false;
        return headerLooksLikeWindSpeedOnly(norm(h));
      });
    }
    if (dirCand) {
      detected.direction = dirCand.trim();
      mappingLog.push(`direction: "${detected.direction}" (unambiguous wind-from column)`);
    }
    if (spdCand) {
      detected.speed = spdCand.trim();
      mappingLog.push(`speed: "${detected.speed}" (unambiguous wind-speed column)`);
    }
  }

  // Wind direction must not reuse the calendar day column ("DD", "Day") when both matched "dd"/dir-like patterns
  if (
    detected.direction &&
    detected.dayCol &&
    detected.direction.trim() === detected.dayCol.trim()
  ) {
    mappingLog.push(`⚠ direction matched same column as day "${detected.dayCol}" — picking a wind-from column`);
    const dirCand =
      headers.find((h) => {
        if (h.trim() === detected.dayCol!.trim()) return false;
        const n = norm(h);
        if (headerLooksLikeWindSpeedOnly(n)) return false;
        return (
          /\bwind.*dir/i.test(h) ||
          /\bdir(?:ection)?\b/i.test(h) ||
          /\bdirec/i.test(n) ||
          /\bwdir\b/i.test(n) ||
          /\bdrct\b/i.test(n)
        );
      }) ?? null;
    if (dirCand) {
      detected.direction = dirCand.trim();
      mappingLog.push(`direction: "${detected.direction}" (wind-from, not day-of-month)`);
    }
  }

  // Log undetected required columns
  if (!detected.direction) mappingLog.push("⚠ direction: NOT DETECTED — all bins will be zero");
  if (!detected.speed)     mappingLog.push("⚠ speed: NOT DETECTED — calm classification will be wrong");

  return { ...detected, mappingLog };
}

/** Strip UTF-8 BOM and trim — common on CSV exports from Excel. */
function cleanHeaderLabel(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

/**
 * Excel exports often have blank rows or a title row above the real header.
 * Pick the first row that looks like column headers (not a numeric data row).
 */
function findBestHeaderRowIndex(rows: string[][], maxScan = 40): number {
  const limit = Math.min(maxScan, rows.length);
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < limit; i++) {
    const row = rows[i].map((c) => cleanHeaderLabel(String(c)));
    const nonEmpty = row.filter((c) => c !== "");
    if (nonEmpty.length < 2) continue;

    const { direction, speed, date, time, yearCol, monthCol } = detectColumns(row);

    let score = nonEmpty.length * 2;
    if (direction) score += 25;
    if (speed) score += 25;
    if (date) score += 18;
    else if (yearCol && monthCol) score += 18;
    if (time) score += 12;

    // Penalise rows that look like numeric weather data, not text headers
    const numericLike = nonEmpty.filter((c) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(c)).length;
    if (numericLike >= Math.max(3, nonEmpty.length - 1)) score -= 45;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/** Normalise time for storage / downstream Date parsing (bare hour → HH:00). */
function normalizeObservationTime(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{1,2}$/.test(s)) return `${s.padStart(2, "0")}:00`;
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) return `${hm[1].padStart(2, "0")}:${hm[2]}${hm[3] ? `:${hm[3]}` : ""}`;
  return s;
}

function detectLikelyDirSpeedSwap(records: WindRecord[], calmThreshold: number): boolean {
  const v = records.filter((r) => r.isValid && r.wind_speed_kt > calmThreshold);
  if (v.length < 80) return false;
  const sample = v.slice(0, Math.min(4000, v.length));
  let dirSmall = 0;
  let spdBig = 0;
  const dirs: number[] = [];
  const spds: number[] = [];
  for (const r of sample) {
    dirs.push(r.wind_direction_deg);
    spds.push(r.wind_speed_kt);
    if (r.wind_direction_deg <= 65) dirSmall++;
    if (r.wind_speed_kt >= 70) spdBig++;
  }
  const mean = dirs.reduce((a, b) => a + b, 0) / dirs.length;
  const stdDir = Math.sqrt(dirs.reduce((s, d) => s + (d - mean) ** 2, 0) / dirs.length);
  const spdsSorted = [...spds].sort((a, b) => a - b);
  const medianSpd = spdsSorted[Math.floor(spdsSorted.length / 2)];
  // Real swap puts degrees (often 40–360) in the speed field — median sustained "speed" is then huge vs real kt.
  if (!Number.isFinite(medianSpd) || medianSpd < 40) return false;
  return (
    dirSmall / sample.length >= 0.9 &&
    spdBig / sample.length >= 0.12 &&
    stdDir < 38
  );
}

function applyDirSpeedSwapInPlace(records: WindRecord[], calmThreshold: number): void {
  for (const r of records) {
    const wasValid = r.isValid;
    const newDir = ((Number(r.wind_speed_kt) % 360) + 360) % 360;
    let newSpd = Number(r.wind_direction_deg);
    if (!Number.isFinite(newSpd) || newSpd < 0) newSpd = 0;
    r.wind_direction_deg = newDir;
    r.wind_speed_kt = newSpd;
    r.isCalm = newSpd <= calmThreshold;
    r.isValid = wasValid;
  }
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
          const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
          resolve(rows.map((r) => r.map((c) => (c == null ? "" : String(c)))));
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
        const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
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

  const upper = val.trim().toUpperCase().replace(/°|º/g, "");
  if (upper in DIRECTION_MAP) return DIRECTION_MAP[upper];

  // Strip degree symbols / "deg"; normalize comma decimals (Excel locales) then numeric part
  const forNum = normalizeNumericCell(
    val
      .replace(/°|º/g, "")
      .replace(/\bdeg(?:rees?)?\b/gi, "")
      .trim()
  );
  const num = parseFloat(forNum.replace(/[^\d.-]/g, ""));
  if (!isNaN(num) && num >= 0 && num <= 360) {
    const mod = num % 360;
    return mod;
  }

  return null;
}

// ── Speed parsing & unit normalization ─────────────────

function parseSpeed(val: string, unit?: string, autoDetectMs?: boolean): number | null {
  if (!val || val.trim() === "" || /calm/i.test(val)) return 0;

  const num = parseFloat(val.replace(/[^\d.-]/g, ""));
  if (isNaN(num) || num < 0) return null;

  // Convert to knots
  if (unit && /m\/s|mps/i.test(unit)) return num * 1.94384;
  if (unit && /km\/h|kph|kmh/i.test(unit)) return num * 0.539957;
  if (unit && /mph/i.test(unit)) return num * 0.868976;
  // Auto-detect m/s: if flagged and value is in a plausible m/s range (0-30 m/s = 0-58 kt)
  if (autoDetectMs) return num * 1.94384;
  return num; // assume knots
}

/** Sample speed values from the first N rows to detect if unit is likely m/s. */
function detectSpeedUnitIsMs(rows: string[][], headers: string[], speedCol: string | null): boolean {
  if (!speedCol) return false;

  // If the column name itself mentions knots/kt, trust it — skip auto-detection
  if (/knot|\bkt\b|_kt\b/i.test(speedCol)) return false;

  // If the column name explicitly mentions m/s, trust it immediately
  if (/m\/s|mps/i.test(speedCol)) return true;

  // Use trimmed headers for consistent indexOf lookup
  const trimmedHeaders = headers.map(h => h.trim());
  const colIdx = trimmedHeaders.indexOf(speedCol);
  if (colIdx < 0) return false;
  const sample = rows.slice(0, Math.min(200, rows.length));
  const vals = sample
    .map(r => parseFloat(r[colIdx]))
    .filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return false;
  const median = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  
  // To avoid false positives on knot datasets, tighten the heuristic significantly.
  // Typical knot datasets often have medians around 8-12 and max around 30-40.
  // Real m/s datasets often have a very low median (2-5) and a much lower max.
  const max = Math.max(...vals);
  return median <= 6 && max <= 28 && vals.filter(v => v < 15).length / vals.length > 0.90;
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
    const t = records[i].observation_time;
    // Normalize bare hour numbers like "3", "14" → "03:00", "14:00"
    const timeStr = t && /^\d{1,2}$/.test(t.trim())
      ? `${t.trim().padStart(2, "0")}:00`
      : t;
    const d = new Date(`${records[i].observation_date}T${timeStr}:00Z`);
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

  const validRecordCount = records.filter((r) => r.isValid).length;
  if (validRecordCount < 8760) { score -= 10; reasons.push("Less than 1 year of hourly data"); }
  if (validRecordCount < 4380) { score -= 15; reasons.push("Less than 6 months of data"); }

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

  const headerRowIdx = findBestHeaderRowIndex(rawRows);
  const headers = rawRows[headerRowIdx].map((h) => cleanHeaderLabel(String(h)));
  let { mappingLog, ...columns } = detectColumns(headers);
  const warnings: string[] = [];

  if (headerRowIdx > 0) {
    warnings.push(
      `Column map: header row detected on row ${headerRowIdx + 1} (skipped ${headerRowIdx} leading row(s) — e.g. blank or title rows).`
    );
  }

  forceClassicSixColumnWind(headers, columns, warnings);
  forceTrailingWindColumnsForYmdhLayout(headers, columns, warnings);

  // Surface column mapping to UI — critical for debugging import issues
  warnings.push(...mappingLog.map(l => `Column map: ${l}`));

  if (!columns.direction) warnings.push("⚠ Wind direction column not detected — all bins will be zero. Check column names.");
  if (!columns.speed)     warnings.push("⚠ Wind speed column not detected — calm classification will fail. Check column names.");


  const dataRows = rawRows.slice(headerRowIdx + 1).filter((row) => row.some((c) => String(c).trim() !== ""));
  if (dataRows.length === 0) {
    throw new Error("Dataset is empty. No data rows found.");
  }

  resolveSpeedBeforeDirectionForTrailingColumns(headers, columns, dataRows, warnings);

  // Detect if speed column is likely m/s (auto-unit detection)
  const speedIsMs = detectSpeedUnitIsMs(dataRows, headers, columns.speed);
  if (speedIsMs) warnings.push("⚠ Auto-detected speed unit: m/s → converted to knots (×1.944). Verify if incorrect.");

  // Year + Month (+ Day) — always used when present (even if a vague "date" column was also detected)
  const canAssembleSplitDate = !!(columns.yearCol && columns.monthCol);
  if (canAssembleSplitDate) {
    warnings.push(
      `Column map: date assembled from split columns: ${columns.yearCol}/${columns.monthCol}/${columns.dayCol ?? "(no day)"}`
    );
  }

  let invalidRows = 0;
  let missingValues = 0;
  let gustOutlierCount = 0;
  let speedOutlierCount = 0;
  const records: WindRecord[] = [];

  for (const row of dataRows) {
    const rawObj: Record<string, string> = {};
    // Trim header keys to ensure they match the trimmed column names in `columns.*`
    headers.forEach((h, i) => {
      rawObj[h] = row[i] != null ? cleanHeaderLabel(String(row[i])) : "";
    });

    const dirStr = columns.direction ? rawObj[columns.direction] : "";
    const spdStr = columns.speed ? rawObj[columns.speed] : "";
    const gustStr = columns.gust ? rawObj[columns.gust] : "";
    const timeStr = columns.time ? rawObj[columns.time] : "";

    // Build date string — split Year/Month/Day first when configured (fixes false "date" column blocking assembly)
    let dateStr = "";
    if (canAssembleSplitDate) {
      const yr = rawObj[columns.yearCol!] ?? "";
      const mo = rawObj[columns.monthCol!] ?? "";
      const dy = columns.dayCol ? (rawObj[columns.dayCol] ?? "") : "1";
      dateStr = assembleDateFromYMDParts(yr, mo, dy) ?? "";
    }
    if (!dateStr.trim() && columns.date) {
      const cell = cleanHeaderLabel(rawObj[columns.date] ?? "");
      dateStr = cell;
      const nc = normalizeNumericCell(cell);
      if (!/^\d{4}-\d{2}-\d{2}/.test(nc) && /^\d+(\.\d+)?$/.test(nc)) {
        const ser = Math.round(parseFloat(nc));
        if (ser >= 20000 && ser <= 60000) {
          const ex = excelSerialToYmd(ser);
          if (ex) {
            dateStr = `${ex.y}-${String(ex.m).padStart(2, "0")}-${String(ex.d).padStart(2, "0")}`;
          }
        }
      }
    }

    const dir = parseDirection(dirStr);
    const spd = parseSpeed(spdStr, undefined, speedIsMs);
    let gust = gustStr ? parseSpeed(gustStr, undefined, speedIsMs) : null;

    if (dir === null && spd === null) {
      invalidRows++;
      continue;
    }

    if (spd !== null && spd > 100) {
      speedOutlierCount++;
      invalidRows++;
      continue;
    }

    if (gust !== null && gust > 100) {
      // Unrealistic gust: null it out but keep the row — direction/speed are still valid
      gustOutlierCount++;
      gust = null; // discard bad gust, preserve valid direction + speed
    }

    if (dir === null || spd === null) missingValues++;

    const isCalm = (spd !== null && spd <= calmThreshold) || /calm/i.test(dirStr) || /calm/i.test(spdStr);

    records.push({
      observation_date: dateStr,
      observation_time: normalizeObservationTime(timeStr),
      wind_direction_deg: dir ?? 0,
      wind_speed_kt: spd ?? 0,
      wind_gust_kt: gust,
      isCalm,
      isValid: dir !== null && spd !== null,
      raw: rawObj,
    });
  }

  // If direction values sit in a tiny degree range but "speed" often exceeds 70 kt, columns are likely swapped
  // (wind speeds 0–40 kt were binned as N/NNE only; degrees 70–360 appeared in the speed field).
  if (detectLikelyDirSpeedSwap(records, calmThreshold)) {
    applyDirSpeedSwapInPlace(records, calmThreshold);
    warnings.push(
      "⚠ Auto-corrected: wind direction and speed columns appear swapped (direction looked like knot magnitudes). Verify column map in warnings above."
    );
  }

  let dateRange: { start: string; end: string } | null = null;
  const dates = records.map((r) => r.observation_date).filter(Boolean).sort();
  if (dates.length >= 2) dateRange = { start: dates[0], end: dates[dates.length - 1] };

  const datasetType = classifyDataset(records);
  const validRowCount = records.filter((r) => r.isValid).length;
  const partialRowCount = records.length - validRowCount;
  /** Rows that are not fully usable (missing dir or speed, or never imported): matches UI "valid / total". */
  const reportedInvalidRows = dataRows.length - validRowCount;
  if (partialRowCount > 0) {
    warnings.push(
      `ℹ ${partialRowCount.toLocaleString()} row(s) have wind direction or speed missing — excluded from valid count (common in Excel exports with blank cells).`
    );
  }
  const { reliability, reasons } = assessReliability(
    records,
    dataRows.length,
    reportedInvalidRows,
    missingValues,
    datasetType
  );

  // Aggregated outlier summaries (avoid spamming one warning per row)
  if (speedOutlierCount > 0) {
    warnings.push(`⚠ ${speedOutlierCount} row(s) rejected: wind speed > 100 kts (likely bad data or wrong unit).`);
  }
  if (gustOutlierCount > 0) {
    warnings.push(`ℹ ${gustOutlierCount} gust value(s) > 100 kts clamped to null (rows kept — direction/speed valid). Likely a direction column was read as gust.`);
  }

  if (datasetType === "daily" || datasetType === "monthly") {
    warnings.push("Data appears to be aggregated. Individual observations are preferred for accurate wind roses.");
  }

  return {
    records,
    totalRows: dataRows.length,
    validRows: validRowCount,
    invalidRows: reportedInvalidRows,
    missingValues,
    dateRange,
    datasetType,
    reliability,
    reliabilityReasons: reasons,
    columns,
    warnings,
  };
}

export interface NormalizedPublicRecordLike {
  observation_date: string;
  observation_time: string;
  wind_direction_deg: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
}

export interface NormalizedPublicDataLike {
  source_type: "ogimet" | "meteostat";
  source_name: string;
  station_name: string;
  dateRange: { start: string; end: string } | null;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  reliabilityClass: "High" | "Moderate" | "Low";
  warnings: string[];
  records: NormalizedPublicRecordLike[];
}

export function parsedWindDataFromNormalizedPublicData(
  data: NormalizedPublicDataLike,
  calmThreshold: number = 3
): ParsedWindData {
  const records: WindRecord[] = data.records.map((r) => {
    const dir = r.wind_direction_deg;
    const spd = r.wind_speed_kt;
    const gust = r.wind_gust_kt;
    const isValid = dir !== null && spd !== null;
    const windDir = dir ?? 0;
    const windSpd = spd ?? 0;
    const isCalm = windSpd <= calmThreshold;

    return {
      observation_date: r.observation_date,
      observation_time: r.observation_time,
      wind_direction_deg: windDir,
      wind_speed_kt: windSpd,
      wind_gust_kt: gust,
      isCalm,
      isValid,
      raw: {
        observation_date: r.observation_date,
        observation_time: r.observation_time,
        wind_direction_deg: String(dir ?? ""),
        wind_speed_kt: String(spd ?? ""),
        wind_gust_kt: String(gust ?? ""),
      },
    };
  });

  const reliability: ParsedWindData["reliability"] =
    data.reliabilityClass === "High" ? "high" : data.reliabilityClass === "Moderate" ? "medium" : "low";

  return {
    records,
    totalRows: data.totalRows,
    validRows: data.validRows,
    invalidRows: data.rejectedRows,
    missingValues: 0,
    dateRange: data.dateRange,
    datasetType: "hourly",
    reliability,
    reliabilityReasons: [
      data.reliabilityClass === "High" ? "High yield rate and consistent time-series" :
      data.reliabilityClass === "Moderate" ? "Model-derived or partially filtered data" :
      "Low yield rate or significant filtering/rejection",
    ],
    columns: { date: "observation_date", time: "observation_time", direction: "wind_direction_deg", speed: "wind_speed_kt", gust: "wind_gust_kt", yearCol: null, monthCol: null, dayCol: null },
    warnings: data.warnings ?? [],
    sourceType: data.source_type,
    sourceName: data.source_name,
    stationName: data.station_name,
  };
}
