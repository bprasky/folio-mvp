/**
 * Blocker Identifier - Shows EXACT elements blocking gradient
 * Run this to get specific class names and fix recommendations
 */

export function identifyBlockers() {
  console.log("🔍 BLOCKER IDENTIFIER — Finding exact elements");
  console.log("===============================================");

  const bgEl = document.querySelector('[data-testid="cinematic-bg"]') as HTMLElement;
  const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
  
  const blockers = allElements.filter(el => {
    if (el === bgEl) return false;
    
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    
    // Skip if not visible
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    
    // Must have non-transparent background
    const bg = style.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return false;
    
    // Check if it's white-ish
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
    if (!m) return false;
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    const alpha = parseFloat(m[4] ?? "1");
    
    // Must be opaque and white-ish
    if (alpha < 0.5) return false;
    if (r < 240 || g < 240 || b < 240) return false; // Not white
    
    // Must be large or positioned
    const isLarge = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.3;
    const isPositioned = ['fixed', 'absolute', 'sticky', 'relative'].includes(style.position);
    
    return isLarge || isPositioned;
  });

  console.log(`\n📍 Found ${blockers.length} white blocker element(s):\n`);

  blockers.forEach((el, idx) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    
    console.log(`\n[${idx + 1}] ${el.tagName.toLowerCase()}`);
    console.log("   Classes:", el.className || "(none)");
    console.log("   ID:", el.id || "(none)");
    console.log("   Background:", style.backgroundColor);
    console.log("   Position:", style.position);
    console.log("   Z-Index:", style.zIndex);
    console.log("   Size:", `${Math.round(rect.width)}×${Math.round(rect.height)}`);
    console.log("   Location:", `top=${Math.round(rect.top)}, left=${Math.round(rect.left)}`);
    
    // Suggest fix
    const classes = el.className.toString();
    if (classes.includes('bg-surface-canvas')) {
      console.log("   💡 FIX: Remove 'bg-surface-canvas' class");
    } else if (classes.includes('bg-folio-bg')) {
      console.log("   💡 FIX: Remove 'bg-folio-bg' class");
    } else if (classes.includes('bg-surface-ground') || classes.includes('bg-neutral-50')) {
      console.log("   💡 FIX: Remove background utility class");
    } else if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      console.log("   💡 FIX: Add 'bg-transparent' class or remove inline style");
    }
    
    // Show element path for targeting
    const path = getElementPath(el);
    console.log("   Path:", path);
  });

  // Generate fix code
  console.log("\n\n🔧 AUTO-FIX CODE (copy to console):");
  console.log("// Run this to temporarily remove backgrounds and test:");
  blockers.forEach((el, idx) => {
    console.log(`document.querySelectorAll('${getSelector(el)}')[0].style.background = 'transparent';`);
  });

  console.log("\n===============================================");
}

function getElementPath(el: HTMLElement): string {
  const parts = [];
  let current: HTMLElement | null = el;
  
  while (current && current !== document.body && parts.length < 5) {
    let part = current.tagName.toLowerCase();
    if (current.id) part += `#${current.id}`;
    if (current.className) {
      const classes = current.className.toString().split(' ').slice(0, 2).join('.');
      if (classes) part += `.${classes}`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  
  return parts.join(' > ');
}

function getSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  
  const classes = el.className.toString().split(' ').filter(c => c.length > 0);
  if (classes.length > 0) {
    return `${el.tagName.toLowerCase()}.${classes[0]}`;
  }
  
  return el.tagName.toLowerCase();
}




