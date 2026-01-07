/**
 * Runtime glass audit - computes actual glass panel styles
 * Helps determine midpoint opacity for unified token
 */

export function auditGlass() {
  const title = document.querySelector('[data-testid="glass-title-card"]') as HTMLElement | null;
  const dock = document.querySelector('[data-testid="glass-action-dock"]') as HTMLElement | null;
  
  const out: any = {};

  function read(el: HTMLElement | null, label: string) {
    if (!el) {
      console.warn(`⚠️ Glass element not found: ${label}`);
      return;
    }
    
    // Find the actual GlassPanel child
    const glassPanel = el.querySelector('[class*="backdrop-blur"]') || el.children[0] as HTMLElement;
    const cs = getComputedStyle(glassPanel || el);
    
    out[label] = {
      backgroundColor: cs.backgroundColor,
      backdropFilter: cs.backdropFilter,
      boxShadow: cs.boxShadow,
      WebkitBackdropFilter: (cs as any).webkitBackdropFilter || cs.backdropFilter,
      border: cs.border,
      opacity: cs.opacity,
    };
  }

  read(title, 'titleCard');
  read(dock, 'actionDock');
  
  console.log('🔍 Glass Computed Styles Audit:');
  console.table(out);

  // Extract alpha from rgba(...)
  const parseAlpha = (rgba?: string): number | null => {
    if (!rgba) return null;
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
    if (!match) return null;
    return Number(match[4] ?? 1);
  };

  const alphaTitle = parseAlpha(out.titleCard?.backgroundColor);
  const alphaDock = parseAlpha(out.actionDock?.backgroundColor);

  if (alphaTitle != null && alphaDock != null) {
    const mid = Number(((alphaTitle + alphaDock) / 2).toFixed(2));
    
    // Clamp to brand guardrails [0.08, 0.16]
    const clamped = Math.max(0.08, Math.min(0.16, mid));
    
    console.log('');
    console.log('📊 Glass Alpha Analysis:');
    console.log(`  Title Card: ${alphaTitle}`);
    console.log(`  Action Dock: ${alphaDock}`);
    console.log(`  Midpoint: ${mid}`);
    console.log(`  Clamped (0.08-0.16): ${clamped}`);
    console.log('');
    console.log('✅ Recommended CSS variable:');
    console.log(`  --glass-alpha: ${clamped};`);
    console.log('');
    
    return clamped;
  }

  console.warn('⚠️ Could not extract alpha values from glass elements');
  return null;
}

/**
 * Auto-apply the computed midpoint to CSS variable (dev only)
 */
export function applyGlassMidpoint() {
  const mid = auditGlass();
  
  if (typeof mid === 'number') {
    document.documentElement.style.setProperty('--glass-alpha', String(mid));
    console.log(`✅ Applied --glass-alpha: ${mid}`);
    return mid;
  }
  
  return null;
}




