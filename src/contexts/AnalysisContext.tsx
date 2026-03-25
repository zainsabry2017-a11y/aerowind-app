import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { ParsedWindData, WindRecord } from "@/lib/windDataParser";
import type { WindRoseResult } from "@/lib/windRoseCalculator";
import type { RunwayUsabilityResult, OptimizationResult } from "@/lib/windComponents";
import type { RunwayLengthResult } from "@/lib/runwayLength";

export interface AirportReportData {
  projName: string;
  projLoc: string;
  elevation: string;
  refTemp: string;
  gradient: string;
  aeroCode: string;
  notes: string;
  windData: ParsedWindData | null;
  windRose: WindRoseResult | null;
  candidates: RunwayUsabilityResult[];
  optimization: OptimizationResult | null;
  xwLimit: number;
  rlResult: RunwayLengthResult | null;
  rlInputs: any;
  selectedAc: any;
  baseLength: string;
  surface: string;
}

export interface HeliportReportData {
  projName: string;
  projectLoc: string;
  elevation: string;
  perfClass: string;
  heliType: string;
  notes: string;
  windData: ParsedWindData | null;
  windRose: WindRoseResult | null;
  fatoResult: any | null; // HelipadUsabilityResult
  approachResult: any | null; // ApproachAnalysisResult
  selectedHeli: string;
  planningCategory: string;
  selectionMode: string;
  dValue: string;
  rotorDia: string;
  mtow: string;
  helipad: any; // Evaluated helper data (helicopter, dVal, rotor)
}

export interface WaterReportData {
  projName: string;
  projLoc: string;
  elevation: string;
  notes: string;
  windData: ParsedWindData | null;
  windRose: WindRoseResult | null;
  candidates: RunwayUsabilityResult[];
  optimization: OptimizationResult | null;
  xwLimit: number;
  rwHeading: string;
  selectedAc: any;
  waveState: string;
  waterType: string;
  waterTemp: string;
  channelType: string;
  availDepth: string;
  currentSpeed: string;
}

interface AnalysisState {
  // Legacy / existing state
  windData: ParsedWindData | null;
  windRose: WindRoseResult | null;
  runwayCandidates: RunwayUsabilityResult[];
  runwayOptimization: OptimizationResult | null;
  crosswindLimit: number;
  runwayLength: RunwayLengthResult | null;
  runwayLengthInputs: { baseLength: number; elevation: number; temperature: number; gradient: number; surface: string } | null;
  waterRunway: any | null;
  helipad: any | null;

  // New Modular Report State
  airportReportData: AirportReportData | null;
  heliportReportData: HeliportReportData | null;
  waterReportData: WaterReportData | null;
}

interface AnalysisContextType extends AnalysisState {
  setWindData: (data: ParsedWindData | null) => void;
  setWindRose: (rose: WindRoseResult | null) => void;
  setRunwayCandidates: (candidates: RunwayUsabilityResult[]) => void;
  setRunwayOptimization: (opt: OptimizationResult | null) => void;
  setCrosswindLimit: (limit: number) => void;
  setRunwayLength: (result: RunwayLengthResult | null, inputs?: { baseLength: number; elevation: number; temperature: number; gradient: number; surface: string }) => void;
  setWaterRunway: (data: WaterRunwayData | null) => void;
  setHelipad: (data: HelipadData | null) => void;

  setAirportReportData: (data: AirportReportData | null) => void;
  setHeliportReportData: (data: HeliportReportData | null) => void;
  setWaterReportData: (data: WaterReportData | null) => void;

  /** Replace the full analysis state (used by JSON import/restore). */
  hydrate: (next: Partial<AnalysisState>) => void;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

const STORAGE_KEY = "aerowind.analysis.v1";

const DEFAULT_STATE: AnalysisState = {
  windData: null,
  windRose: null,
  runwayCandidates: [],
  runwayOptimization: null,
  crosswindLimit: 13,
  runwayLength: null,
  runwayLengthInputs: null,
  waterRunway: null,
  helipad: null,
  airportReportData: null,
  heliportReportData: null,
  waterReportData: null,
};

export const AnalysisProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AnalysisState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw);
      const saved = (parsed && typeof parsed === "object" ? parsed.state : null) as Partial<AnalysisState> | null;
      if (!saved || typeof saved !== "object") return DEFAULT_STATE;
      return { ...DEFAULT_STATE, ...saved };
    } catch {
      return DEFAULT_STATE;
    }
  });

  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    // Debounced autosave. Guard against huge datasets exceeding localStorage quota.
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const payload = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state });
        // ~5MB typical localStorage; keep safety margin
        if (payload.length > 3_500_000) return;
        localStorage.setItem(STORAGE_KEY, payload);
      } catch {
        // ignore storage failures
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  const setWindData = useCallback((data: ParsedWindData | null) => setState(s => ({ ...s, windData: data })), []);
  const setWindRose = useCallback((rose: WindRoseResult | null) => setState(s => ({ ...s, windRose: rose })), []);
  const setRunwayCandidates = useCallback((candidates: RunwayUsabilityResult[]) => setState(s => ({ ...s, runwayCandidates: candidates })), []);
  const setRunwayOptimization = useCallback((opt: OptimizationResult | null) => setState(s => ({ ...s, runwayOptimization: opt })), []);
  const setCrosswindLimit = useCallback((limit: number) => setState(s => ({ ...s, crosswindLimit: limit })), []);
  const setRunwayLength = useCallback((result: RunwayLengthResult | null, inputs?: any) => setState(s => ({ ...s, runwayLength: result, runwayLengthInputs: inputs ?? s.runwayLengthInputs })), []);
  const setWaterRunway = useCallback((data: WaterRunwayData | null) => setState(s => ({ ...s, waterRunway: data })), []);
  const setHelipad = useCallback((data: HelipadData | null) => setState(s => ({ ...s, helipad: data })), []);
  
  const setAirportReportData = useCallback((data: AirportReportData | null) => setState(s => ({ ...s, airportReportData: data })), []);
  const setHeliportReportData = useCallback((data: HeliportReportData | null) => setState(s => ({ ...s, heliportReportData: data })), []);
  const setWaterReportData = useCallback((data: WaterReportData | null) => setState(s => ({ ...s, waterReportData: data })), []);

  const hydrate = useCallback((next: Partial<AnalysisState>) => {
    setState({ ...DEFAULT_STATE, ...next });
  }, []);

  return (
    <AnalysisContext.Provider value={{ ...state, setWindData, setWindRose, setRunwayCandidates, setRunwayOptimization, setCrosswindLimit, setRunwayLength, setWaterRunway, setHelipad, setAirportReportData, setHeliportReportData, setWaterReportData, hydrate }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
};
