/** Numeric limit passed to chart builders / optimizers when report data may be incomplete. */
export function effectiveRunwayCrosswindKt(xwLimit: number, fallback: number): number {
  const n = Number(xwLimit);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Display string for reports/exports: effective kt, with (custom) when user-defined. */
export function runwayCrosswindReportLabel(
  xwLimit: number,
  meta?: { crosswindIsCustom?: boolean; crosswindPreset?: string }
): string {
  const kt = Number(xwLimit);
  const ktStr = Number.isFinite(kt) ? `${kt.toFixed(1)} kt` : "—";
  const custom = meta?.crosswindIsCustom === true || meta?.crosswindPreset === "custom";
  return custom ? `${ktStr} (custom)` : ktStr;
}
