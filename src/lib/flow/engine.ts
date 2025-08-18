export type Size = "L" | "M" | "S";
export type Shape = { w: number; h: number };
export type Place = { id: string; col: number; row: number; w: number; h: number; size: Size };

const SHAPES: Record<Size, Shape[]> = {
  L: [{ w:6, h:4 }, { w:4, h:4 }],
  M: [{ w:4, h:3 }, { w:3, h:3 }],
  S: [{ w:3, h:2 }, { w:2, h:2 }],
};

// Skyline/serpentine placement. 12-col grid by default.
export function composeFlow(items: Array<{id:string; size: Size}>, cols = 12): Place[] {
  // safety: at least 2 columns
  cols = Math.max(2, cols);

  const grid: number[] = Array(cols).fill(0);
  const out: Place[] = [];
  let serpentine = true;

  const tryPlace = (id: string, size: Size): Place | null => {
    // only shapes that fit this cols
    const shapes = SHAPES[size].filter(s => s.w <= cols);
    for (const { w, h } of shapes) {
      const len = Math.max(0, cols - w + 1);
      if (len === 0) continue; // cannot scan, shape wider than cols
      const range = Array.from({ length: len }, (_, i) => i);
      const scan = serpentine ? range : [...range].reverse();

      let bestCol = -1, bestRow = Number.POSITIVE_INFINITY;
      for (const c of scan) {
        const row = Math.max(...grid.slice(c, c + w));
        if (row < bestRow) { bestRow = row; bestCol = c; }
      }
      if (bestCol >= 0) {
        for (let i = bestCol; i < bestCol + w; i++) grid[i] = bestRow + h;
        return { id, col: bestCol, row: bestRow, w, h, size };
      }
    }
    return null;
  };

  for (const it of items) {
    let placed = tryPlace(it.id, it.size);
    if (!placed) {
      const down = it.size === "L" ? "M" : it.size === "M" ? "S" : null;
      if (down) placed = tryPlace(it.id, down);
    }
    if (placed) { out.push(placed); serpentine = !serpentine; }
  }
  return out;
} 