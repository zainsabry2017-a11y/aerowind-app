import Papa from "papaparse";

export interface NormalizedPublicRecord {
  observation_date: string;
  observation_time: string;
  wind_direction_deg: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
}

export interface NormalizedPublicData {
  source_type: "ogimet" | "meteostat";
  source_name: string;
  station_name: string;
  dateRange: { start: string; end: string } | null;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  reliabilityClass: "High" | "Moderate" | "Low";
  warnings: string[];
  mappedFields: string[];
  records: NormalizedPublicRecord[];
}

interface ValidationResult {
  records: NormalizedPublicRecord[];
  rejected: number;
  warnings: string[];
}

const parseDate = (val: string): string => {
  const d = new Date(val);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

const parseTime = (val: string): string => {
  if (!val) return "";
  if (val.includes(":")) return val.trim();
  const d = new Date(val);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[1].substring(0, 5);
};

// Applies strict bound checking and normalization
const normalizeRecords = (rawRows: any[], type: "ogimet" | "meteostat"): ValidationResult => {
  const records: NormalizedPublicRecord[] = [];
  let rejected = 0;
  const warnings: string[] = [];
  const seenStr = new Set<string>();

  rawRows.forEach((row, idx) => {
    // 1. Alias Resolution
    const rDate = row.observation_date || row.date || row.timestamp || row.datetime || row.day || "";
    const rTime = row.observation_time || row.time || row.hour || "";
    
    const rDir = row.wind_direction_deg || row.wind_direction || row.wind_direc || row.wind_dir || row.direction || row.wd || row.dir || "";
    const rSpd = row.wind_speed_kt || row.wind_speed || row.wind_spee || row.speed || row.ws || row.spd || "";
    const rGst = row.wind_gust_kt || row.wind_gust || row.gust || row.wg || row.gst || "";

    // 2. Base Validation
    if (!rDate) {
      if (idx < 5) warnings.push(`Row ${idx + 1}: Missing required date field.`);
      rejected++;
      return;
    }

    const oDate = parseDate(rDate);
    const oTime = parseTime(rTime || rDate);

    // Dupe check
    const sig = `${oDate}-${oTime}`;
    if (seenStr.has(sig)) {
      rejected++;
      return; // silent drop for pure dupes
    }

    let dir = parseFloat(rDir);
    let spd = parseFloat(rSpd);
    let gst = rGst ? parseFloat(rGst) : null;

    // Preserve calm hours: if speed is 0, direction is aerodynamically irrelevant
    if (spd === 0 && isNaN(dir)) {
      dir = 0;
    }

    // 3. Mathematical Bounds Checking
    if (isNaN(dir) || isNaN(spd)) {
      if (idx < 5) warnings.push(`Row ${idx + 1} (${oDate}): Non-numeric wind parameters stripped.`);
      rejected++;
      return;
    }

    if (dir < 0 || dir > 360) {
      if (idx < 5) warnings.push(`Row ${idx + 1} (${oDate}): Direction ${dir} out of bounds (0-360).`);
      rejected++;
      return;
    }

    if (spd < 0) {
      if (idx < 5) warnings.push(`Row ${idx + 1} (${oDate}): Negative speed ${spd} rejected.`);
      rejected++;
      return;
    }

    if (spd > 100) {
      if (idx < 5) warnings.push(`Row ${idx + 1} (${oDate}): Suspiciously high speed ${spd} kt. Filtered.`);
      rejected++;
      return;
    }

    if (gst !== null && !isNaN(gst)) {
      if (gst > 100) {
        if (idx < 5) warnings.push(`Row ${idx + 1} (${oDate}): Extreme gust ${gst} kt. Ignored gust.`);
        gst = null;
      } else if (gst < spd) {
        if (warnings.length < 10) warnings.push(`Row ${idx + 1} (${oDate}): Gust (${gst}) lower than sustained speed (${spd}).`);
        // We warn but keep the record
      }
    } else {
      gst = null;
    }

    seenStr.add(sig);
    records.push({
      observation_date: oDate,
      observation_time: oTime,
      wind_direction_deg: dir,
      wind_speed_kt: spd,
      wind_gust_kt: gst
    });
  });

  return { records, rejected, warnings };
};

export const parsePublicData = async (
  rawText: string, 
  sourceType: "ogimet" | "meteostat", 
  stationName: string, 
  icaoOrCity: string
): Promise<NormalizedPublicData> => {
  
  return new Promise((resolve, reject) => {
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      complete: (results) => {
        const rawRows = results.data;
        if (rawRows.length === 0) {
          return reject(new Error("No parseable tabular data found. Provide standard headers (e.g., date, direction, speed)."));
        }

        const { records, rejected, warnings } = normalizeRecords(rawRows, sourceType);

        if (records.length === 0) {
          return reject(new Error("All rows were rejected. No valid aerodynamic observations extracted."));
        }

        records.sort((a, b) => new Date(`${a.observation_date}T${a.observation_time || "00:00"}`).getTime() - new Date(`${b.observation_date}T${b.observation_time || "00:00"}`).getTime());

        const totalRows = rawRows.length;
        const yieldRate = records.length / totalRows;

        let reliabilityClass: "High" | "Moderate" | "Low" = "Low";
        if (yieldRate > 0.9 && records.length > 365) reliabilityClass = "High";
        else if (yieldRate > 0.5 && records.length > 100) reliabilityClass = "Moderate";

        resolve({
          source_type: sourceType,
          source_name: sourceType === "ogimet" ? "Ogimet (Aviation METAR)" : "Meteostat Open Data",
          station_name: stationName || icaoOrCity || "Unknown Station",
          dateRange: { start: records[0].observation_date, end: records[records.length - 1].observation_date },
          totalRows,
          validRows: records.length,
          rejectedRows: rejected,
          reliabilityClass,
          warnings,
          mappedFields: results.meta.fields || [],
          records
        });
      },
      error: (e) => reject(e)
    });
  });
};

/**
 * PHASE 5: Automated Fetch for Meteostat via Open-Meteo Archive
 */
export const fetchAndParseMeteostat = async (
  city: string, country: string, latlon: string, start: string, end: string
): Promise<NormalizedPublicData> => {
  if (!start || !end) throw new Error("Start and End dates are strictly required for auto-fetching.");
  
  let lat = 0, lon = 0;
  let stationName = city || "Unknown Weather Model Grid";

  if (latlon && latlon.includes(",")) {
    const parts = latlon.split(",");
    lat = parseFloat(parts[0]);
    lon = parseFloat(parts[1]);
  } else if (city) {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`Geocoding failed: Could not find coordinates for city '${city}'. Please provide Lat,Lon manually.`);
    }
    lat = geoData.results[0].latitude;
    lon = geoData.results[0].longitude;
    stationName = `${geoData.results[0].name}${geoData.results[0].country ? `, ${geoData.results[0].country}` : ""}`;
  } else {
    throw new Error("Please provide either a Station/City name or exact Lat,Lon coordinates.");
  }

  const weatherRes = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn`);
  const weatherData = await weatherRes.json();

  if (weatherData.error) {
    throw new Error(`Weather Model API Error: ${weatherData.reason || 'Unknown fetch error'}`);
  }

  const times = weatherData.hourly.time || [];
  const speeds = weatherData.hourly.wind_speed_10m || [];
  const dirs = weatherData.hourly.wind_direction_10m || [];
  const gusts = weatherData.hourly.wind_gusts_10m || [];

  if (times.length === 0) throw new Error("Weather API returned an empty time-series for this date range.");

  // To preserve core aerodynamic safety logic, we map the JSON back into our strict tabular schema
  // which will then be passed precisely through the standalone `normalizeRecords` bound checker.
  const rawRows = times.map((t: string, i: number) => {
    const [dateStr, timeStr] = t.split("T");
    return {
      observation_date: dateStr,
      observation_time: timeStr,
      wind_direction_deg: dirs[i] !== null && dirs[i] !== undefined ? dirs[i].toString() : "",
      wind_speed_kt: speeds[i] !== null && speeds[i] !== undefined ? speeds[i].toString() : "",
      wind_gust_kt: gusts[i] !== null && gusts[i] !== undefined ? gusts[i].toString() : ""
    };
  });

  const valResult = normalizeRecords(rawRows, "meteostat");
  const total = rawRows.length;
  const valid = valResult.records.length;
  const rejected = valResult.rejected;

  if (valid === 0) throw new Error("Zero valid aerodynamic records recovered from model data.");

  let rClass: "High" | "Moderate" | "Low" = "Low";
  const yieldPct = valid / total;
  if (yieldPct > 0.9) rClass = "Moderate"; // Auto-interpolated public models cap at Moderate universally

  return {
    source_type: "meteostat",
    source_name: "Public Weather Model (Open-Meteo)",
    station_name: stationName,
    dateRange: { start, end },
    totalRows: total,
    validRows: valid,
    rejectedRows: rejected,
    reliabilityClass: rClass,
    warnings: ["Model data is globally interpolated and not directly measured by a certified anemometer.", ...valResult.warnings],
    mappedFields: ["time", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"],
    records: valResult.records
  };
};
