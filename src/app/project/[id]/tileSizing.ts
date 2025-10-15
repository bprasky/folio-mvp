import { SelectionUiMeta } from '@/types/selectionUi';

type Dims = { widthIn?: number; depthIn?: number; heightIn?: number };

export function sizeFromDimensions(d?: Dims): 'large'|'medium'|'small'|null {
  if (!d) return null;
  const w = Number(d.widthIn) || 0;
  const l = Number(d.depthIn) || 0;
  const h = Number(d.heightIn) || 0;
  const area = w * l;           // footprint
  const span = Math.max(w, l, h);

  // initial thresholds; tune later
  if (area >= 4000 || span >= 84) return 'large';   // e.g., sofas, king beds, big credenzas
  if (area >= 1200 || span >= 48) return 'medium';  // chairs, vanities, side tables
  return 'small';
}

export function computeTileSize(sel: any): 'large'|'medium'|'small' {
  // 1) explicit override first (in uiMeta.displaySize)
  const ov = sel?.uiMeta?.displaySize;
  if (ov && ov !== 'auto') return ov;

  // 2) featured
  if (sel?.uiMeta?.featured) return 'large';

  // 3) dimensions
  const byDim = sizeFromDimensions(sel?.uiMeta?.dimensions);
  if (byDim) return byDim;

  // 4) existing heuristics (type/category/title)
  return heuristicByType(sel);
}

function heuristicByType(sel: any): 'large'|'medium'|'small' {
  const name = (sel.productName || '').toLowerCase();
  const tags = (sel.tags || []).join(' ').toLowerCase();
  const combined = `${name} ${tags}`;

  // Large items
  if (combined.includes('sofa') || combined.includes('sectional') || 
      combined.includes('bed') || combined.includes('dining table') ||
      combined.includes('desk') || combined.includes('console') ||
      combined.includes('island') || combined.includes('countertop')) {
    return 'large';
  }

  // Medium items
  if (combined.includes('chair') || combined.includes('ottoman') ||
      combined.includes('nightstand') || combined.includes('dresser') ||
      combined.includes('vanity') || combined.includes('side table') ||
      combined.includes('coffee table') || combined.includes('end table')) {
    return 'medium';
  }

  // Small items (accessories)
  return 'small';
}

