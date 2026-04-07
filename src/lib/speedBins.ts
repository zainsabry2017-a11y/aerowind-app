export function formatSpeedBinEdges(edges: number[]): string {
  return edges.join(", ");
}

export function parseSpeedBinEdges(input: string): { edges: number[] | null; error: string | null } {
  const raw = input
    .split(/[,;\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (raw.length === 0) return { edges: null, error: "Enter comma-separated numbers (example: 0, 4, 6, 10, 14)" };

  const nums = raw.map((s) => Number(s));
  if (nums.some((n) => !Number.isFinite(n))) return { edges: null, error: "Speed bins must be numbers only." };

  const edges = nums.map((n) => Math.max(0, n));
  // must be strictly increasing
  for (let i = 1; i < edges.length; i++) {
    if (!(edges[i] > edges[i - 1])) {
      return { edges: null, error: "Bins must be strictly increasing (example: 0, 4, 6, 10...)." };
    }
  }
  if (edges.length < 2) return { edges: null, error: "Provide at least 2 edges (example: 0, 4)." };
  return { edges, error: null };
}

