import type { ParsedWindData } from "@/lib/windDataParser";
import type { WindRoseResult } from "@/lib/windRoseCalculator";
import type { RunwayUsabilityResult, OptimizationResult } from "@/lib/windComponents";
import type { RunwayLengthResult } from "@/lib/runwayLength";

export interface AnalysisState {
  windData: ParsedWindData | null;
  windRose: WindRoseResult | null;
  runwayCandidates: RunwayUsabilityResult[];
  runwayOptimization: OptimizationResult | null;
  crosswindLimit: number;
  runwayLength: RunwayLengthResult | null;
  runwayLengthInputs: { baseLength: number; elevation: number; temperature: number; gradient: number; surface: string } | null;
  waterRunway: any | null;
  helipad: any | null;
  // Report snapshots are stored as opaque objects to avoid circular type imports.
  airportReportData: any | null;
  heliportReportData: any | null;
  waterReportData: any | null;
}

