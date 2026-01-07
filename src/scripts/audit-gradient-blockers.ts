/**
 * Gradient Blocker Audit - Diagnostic Tool
 * NO-CHANGES MODE: Diagnoses why page gradient isn't visible
 * Checks: (a) covered by white background, or (b) near-white colors
 */

export function auditGradientBlockers() {
  console.log("🧭 FOLIO GRADIENT AUDIT — NO CHANGES MODE");
  console.log("========================================");

  const qs = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  const root = document.documentElement;
  const body = document.body;

  const bgEl = qs('[data-testid="cinematic-bg"]'); // our gradient layer
  const wrapper = qs('[data-testid="cinematic-wrapper"]') ||
                  qs('[data-testid="product-page"]') ||
                  qs('[data-testid="page-root"]') ||
                  qs('main') ||
                  document.querySelector('div[class*="relative"]') as HTMLElement | null;

  const cs = (el: HTMLElement | null) => el ? getComputedStyle(el) : null;

  // 1) Basic facts
  console.log("\n📋 Background Stack Analysis:");
  const rootBg = cs(root)?.backgroundColor;
  const bodyBg = cs(body)?.backgroundColor;
  const wrapperBg = cs(wrapper)?.backgroundColor;

  console.table({
    "HTML root": rootBg,
    "Body": bodyBg,
    "Main wrapper": wrapperBg || "(none)",
  });

  // Check if any are white/near-white
  const isWhitish = (rgba?: string) => {
    if (!rgba) return false;
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
    if (!m) return false;
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    const alpha = parseFloat(m[4] ?? "1");
    if (alpha < 0.1) return false; // Transparent, not blocking
    return r > 240 && g > 240 && b > 240; // Near white
  };

  if (isWhitish(rootBg)) console.warn("  ⚠️ HTML root has white background!");
  if (isWhitish(bodyBg)) console.warn("  ⚠️ Body has white background!");
  if (isWhitish(wrapperBg)) console.warn("  ⚠️ Main wrapper has white background!");

  // 2) Gradient layer facts
  console.log("\n🎨 Gradient Element Analysis:");
  if (!bgEl) {
    console.error("  ❌ No [data-testid='cinematic-bg'] element found!");
    console.log("  → Check if CinematicBackground component is mounted");
  } else {
    const c = cs(bgEl)!;
    console.log("  Element found:", bgEl);
    console.table({
      "Background Image": c.backgroundImage?.substring(0, 80) + "...",
      "Background Color": c.backgroundColor,
      "Position": c.position,
      "Z-Index": c.zIndex,
      "Opacity": c.opacity,
      "Visibility": c.visibility,
      "Pointer Events": c.pointerEvents,
      "Display": c.display,
    });

    // Check for issues
    if (c.position !== "fixed") {
      console.warn("  ⚠️ Position is not 'fixed' - gradient may not cover full viewport");
    }
    if (c.zIndex !== "-10" && c.zIndex !== "auto") {
      console.warn(`  ⚠️ Z-index is ${c.zIndex}, expected -10`);
    }
    if (c.opacity !== "1") {
      console.warn(`  ⚠️ Opacity is ${c.opacity}, expected 1`);
    }
    if (c.visibility !== "visible") {
      console.warn(`  ⚠️ Visibility is ${c.visibility}, expected visible`);
    }
    if (c.display === "none") {
      console.error("  ❌ Display is 'none' - gradient is hidden!");
    }
    if (c.backgroundImage === "none") {
      console.error("  ❌ No background-image gradient found!");
    }
  }

  // 3) Palette inputs & whiteness check
  console.log("\n🎨 Palette Color Analysis:");
  const pal = (window as any).__FOLIO_PRODUCT_PALETTE__ || {};
  
  if (!pal.primary && !pal.accent) {
    console.log("  No palette found in window.__FOLIO_PRODUCT_PALETTE__");
    console.log("  → Gradient will use fallback colors (#d7c9b8, #efeae4)");
  } else {
    console.log("  Palette found:", pal);
  }

  // Convert hex to HSL for lightness analysis
  const toHsl = (hex?: string) => {
    if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
    const s = hex.replace('#', '');
    const n = (i: number, l: number) => parseInt(s.substr(i, l), 16);
    const { r, g, b } = s.length === 3
      ? { r: n(0, 1) * 17, g: n(1, 1) * 17, b: n(2, 1) * 17 }
      : { r: n(0, 2), g: n(2, 2), b: n(4, 2) };
    const r1 = r / 255, g1 = g / 255, b1 = b / 255;
    const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
    const l = (max + min) / 2;
    let h = 0, sat = 0;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r1: h = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
        case g1: h = (b1 - r1) / d + 2; break;
        case b1: h = (r1 - g1) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(sat * 100), l: Math.round(l * 100) };
  };

  const hPrimary = toHsl(pal.primary);
  const hAccent = toHsl(pal.accent);

  if (hPrimary || hAccent) {
    console.table({
      "Primary HSL": hPrimary || "(none)",
      "Accent HSL": hAccent || "(none)",
      "Primary near-white?": hPrimary ? (hPrimary.l > 92 || hPrimary.s < 8) : "(n/a)",
      "Accent near-white?": hAccent ? (hAccent.l > 92 || hAccent.s < 8) : "(n/a)",
    });

    if (hPrimary && (hPrimary.l > 92 || hPrimary.s < 8)) {
      console.warn("  ⚠️ Primary color is very light/desaturated (L>92 or S<8)");
      console.warn("     Gradient may be nearly invisible on white background");
    }
    if (hAccent && (hAccent.l > 92 || hAccent.s < 8)) {
      console.warn("  ⚠️ Accent color is very light/desaturated (L>92 or S<8)");
      console.warn("     Gradient may be nearly invisible on white background");
    }
  }

  // 4) Blocker scan - full-viewport elements above the gradient
  console.log("\n🔍 Potential Blocker Elements:");
  const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
  const blockers = allElements.filter(el => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    
    // Skip gradient element itself
    if (el === bgEl) return false;
    
    // Skip if not visible
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    
    // Must be positioned (fixed, absolute, or sticky)
    const positioned = ['fixed', 'absolute', 'sticky'].includes(style.position);
    
    // Must have non-transparent background
    const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                  style.backgroundColor !== 'transparent';
    
    // Must be near-viewport size
    const isLarge = rect.width > window.innerWidth * 0.8 && 
                    rect.height > window.innerHeight * 0.5;
    
    // Must have z-index > -10 (above gradient)
    const zIdx = parseInt(style.zIndex);
    const aboveGradient = !isNaN(zIdx) ? zIdx > -10 : true;
    
    return (positioned || isLarge) && hasBg && aboveGradient;
  });

  if (blockers.length === 0) {
    console.log("  ✅ No obvious blocker elements found");
  } else {
    console.log(`  Found ${blockers.length} potential blocker(s):`);
    blockers.slice(0, 5).forEach(el => { // Limit to first 5
      const style = getComputedStyle(el);
      console.log("  →", {
        tag: el.tagName,
        classes: el.className?.substring(0, 60) || "(none)",
        background: style.backgroundColor,
        position: style.position,
        zIndex: style.zIndex,
        dimensions: `${el.getBoundingClientRect().width}×${el.getBoundingClientRect().height}`,
      });
    });
    if (blockers.length > 5) {
      console.log(`  ... and ${blockers.length - 5} more`);
    }
  }

  // 5) Visual test recommendation
  console.log("\n🧪 Manual Verification Steps:");
  console.log("  1. Open DevTools Elements tab");
  console.log("  2. Find element: [data-testid='cinematic-bg']");
  console.log("  3. Toggle visibility to see if anything changes");
  console.log("  4. Check background-image gradient colors");
  console.log("  5. Inspect parent elements for white backgrounds");

  // 6) Summary
  console.log("\n📊 DIAGNOSTIC SUMMARY:");
  const issues = [];

  if (!bgEl) {
    issues.push("❌ Gradient element not found in DOM");
  } else {
    const c = cs(bgEl)!;
    if (c.position !== "fixed") issues.push("⚠️ Gradient not fixed-positioned");
    if (c.backgroundImage === "none") issues.push("❌ No gradient image");
    if (c.display === "none") issues.push("❌ Gradient display:none");
  }

  if (isWhitish(rootBg)) issues.push("⚠️ HTML root has white background");
  if (isWhitish(bodyBg)) issues.push("⚠️ Body has white background");
  if (isWhitish(wrapperBg)) issues.push("⚠️ Main wrapper has white background");

  if (hPrimary && (hPrimary.l > 92 || hPrimary.s < 8)) {
    issues.push("⚠️ Primary palette color is near-white/desaturated");
  }
  if (hAccent && (hAccent.l > 92 || hAccent.s < 8)) {
    issues.push("⚠️ Accent palette color is near-white/desaturated");
  }

  if (blockers.length > 0) {
    issues.push(`⚠️ ${blockers.length} potential blocker element(s) found`);
  }

  if (issues.length === 0) {
    console.log("✅ No obvious issues detected!");
    console.log("   If gradient still not visible:");
    console.log("   - Check browser zoom level (should be 100%)");
    console.log("   - Try hard refresh (Ctrl+Shift+R)");
    console.log("   - Verify palette colors have sufficient contrast");
  } else {
    console.log("Issues detected:");
    issues.forEach(issue => console.log("  " + issue));
  }

  console.log("\n========================================");
}




