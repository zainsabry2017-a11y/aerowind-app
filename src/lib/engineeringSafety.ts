import type { ParsedWindData } from "./windDataParser";

export interface SafetyWarning {
  level: "info" | "caution" | "warning" | "critical";
  code: string;
  message: string;
  detail: string;
}

export const DISCLAIMER =
  "This platform is an engineering and planning support tool. It is not a certified operational dispatch or flight performance tool. It must not replace AFM/POH/operator-approved calculations.";

export const REGULATORY_STATEMENT =
  "This analysis is aligned with ICAO Annex 14 and GACAR principles. It is intended for engineering planning and assessment purposes only.";

export const PLANNING_DISCLAIMER =
  "Planning-level estimate — not a substitute for aircraft performance data.";

export const HELIPORT_DISCLAIMER =
  "Planning guidance only — detailed design required for compliance with ICAO Annex 14 Volume II.";

export const DATA_LABELS = {
  planningMode: "PLANNING MODE",
  referenceMode: "REFERENCE / PLANNING ONLY",
  icaoCompliant: "ICAO-Based Wind Usability Assessment",
  faaOptional: "Optional Reference Only — Not Primary Method",
} as const;

export type ConfidenceLevel = "high" | "moderate" | "low" | "insufficient";

export function getConfidenceLevel(reliability: "high" | "medium" | "low"): { level: ConfidenceLevel; label: string; color: string } {
  switch (reliability) {
    case "high": return { level: "high", label: "High Engineering Confidence", color: "emerald" };
    case "medium": return { level: "moderate", label: "Moderate Confidence — Review Recommended", color: "warning" };
    case "low": return { level: "low", label: "Low Confidence — Reduced Engineering Reliability", color: "destructive" };
  }
}

export function generateSafetyWarnings(parsedData: ParsedWindData | null, params?: {
  crosswindLimit?: number;
  hasElevation?: boolean;
  hasTemperature?: boolean;
  hasGradient?: boolean;
}): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];

  warnings.push({
    level: "info",
    code: "DISCLAIMER",
    message: "Planning Tool — Not for Operational Use",
    detail: DISCLAIMER,
  });

  warnings.push({
    level: "info",
    code: "REGULATORY",
    message: "Regulatory Framework",
    detail: REGULATORY_STATEMENT,
  });

  if (!parsedData) return warnings;

  if (parsedData.reliability === "low") {
    warnings.push({
      level: "critical",
      code: "LOW_DATA_QUALITY",
      message: "Low Data Quality — Reduced Engineering Confidence",
      detail: "Dataset not suitable for precise runway orientation decision. " +
        parsedData.reliabilityReasons.join("; "),
    });
  }

  if (parsedData.reliability === "medium") {
    warnings.push({
      level: "warning",
      code: "MED_DATA_QUALITY",
      message: "Moderate Data Quality — Reduced Engineering Confidence",
      detail: "Data reliability is MEDIUM. Consider supplementing with additional data sources. " +
        parsedData.reliabilityReasons.join("; "),
    });
  }

  if (parsedData.datasetType === "daily" || parsedData.datasetType === "monthly") {
    warnings.push({
      level: "warning",
      code: "AGGREGATED_DATA",
      message: "Aggregated Data Detected",
      detail: "Wind data appears to be aggregated (daily or monthly). ICAO Annex 14 requires individual hourly observations for accurate wind analysis. Results from aggregated data may not meet regulatory standards.",
    });
  }

  if (parsedData.validRows < 8760) {
    warnings.push({
      level: "caution",
      code: "SHORT_RECORD",
      message: "Short Data Record",
      detail: `Only ${parsedData.validRows.toLocaleString()} valid observations. ICAO recommends at least 5 years (preferably 10) of continuous hourly data for wind analysis.`,
    });
  }

  if (parsedData.missingValues > 0) {
    const missPct = ((parsedData.missingValues / parsedData.totalRows) * 100).toFixed(1);
    warnings.push({
      level: "caution",
      code: "MISSING_VALUES",
      message: "Missing Values Detected",
      detail: `${parsedData.missingValues} records (${missPct}%) have missing direction or speed values.`,
    });
  }

  if (params) {
    if (!params.hasElevation) {
      warnings.push({ level: "caution", code: "NO_ELEVATION", message: "Elevation Not Specified", detail: "Airport elevation has not been entered. Length corrections will not account for elevation effects." });
    }
    if (!params.hasTemperature) {
      warnings.push({ level: "caution", code: "NO_TEMPERATURE", message: "Temperature Not Specified", detail: "Reference temperature has not been entered. Length corrections will not account for temperature effects." });
    }
  }

  return warnings;
}
