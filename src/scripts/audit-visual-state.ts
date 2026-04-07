/**
 * Visual State Audit - Diagnostic Tool
 * Reads computed styles to diagnose why glass/gradient changes aren't rendering
 * READ-ONLY: No mutations, just console output
 */

export async function auditVisualState() {
  console.log("🧭 FOLIO CINEMATIC AUDIT — NO CHANGES MODE");
  console.log("====================================");

  const title = document.querySelector('[data-testid="glass-title-card"]') as HTMLElement | null;
  const dock = document.querySelector('[data-testid="glass-action-dock"]') as HTMLElement | null;
  const bg = document.querySelector('[data-testid="cinematic-bg"]') as HTMLElement | null;
  const root = document.documentElement;

  // Helper to read computed styles
  const read = (el: HTMLElement | null) => el ? getComputedStyle(el) : null;
  
  // Extract alpha channel from rgba string
  const toAlpha = (rgba?: string | null) => {
    if (!rgba) return null;
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
    return m ? Number(m[4] ?? 1) : null;
  };

  // Read CSS custom properties from root
  const cssRoot = {
    glassAlpha: getComputedStyle(root).getPropertyValue("--glass-alpha").trim(),
    glassRing: getComputedStyle(root).getPropertyValue("--glass-ring").trim(),
    glassBlur: getComputedStyle(root).getPropertyValue("--glass-blur").trim(),
    glassShadow: getComputedStyle(root).getPropertyValue("--glass-shadow").trim(),
  };

  // Get computed styles for each element
  const ct = read(title);
  const cd = read(dock);
  const cb = read(bg);

  // Build diagnostic table
  const diagnosticData = {
    "CSS Root Variables": cssRoot,
    "Title Card BG": ct?.backgroundColor || "NOT FOUND",
    "Title Card Alpha": toAlpha(ct?.backgroundColor),
    "Title Card Classes": title?.className || "ELEMENT NOT FOUND",
    "Title Card Backdrop": ct?.backdropFilter || "none",
    "Dock BG": cd?.backgroundColor || "NOT FOUND",
    "Dock Alpha": toAlpha(cd?.backgroundColor),
    "Dock Classes": dock?.className || "ELEMENT NOT FOUND",
    "Dock Backdrop": cd?.backdropFilter || "none",
    "BG Gradient Image": cb?.backgroundImage || "NOT FOUND",
    "BG Gradient Color": cb?.backgroundColor || "NOT FOUND",
    "BG Gradient Position": cb?.position || "NOT FOUND",
    "BG Gradient Z-Index": cb?.zIndex || "NOT FOUND",
  };

  console.table(diagnosticData);

  // Element existence check
  console.log("\n📍 Element Existence Check:");
  console.log("  Title Card Element:", title ? "✅ FOUND" : "❌ NOT FOUND");
  console.log("  Action Dock Element:", dock ? "✅ FOUND" : "❌ NOT FOUND");
  console.log("  Background Gradient Element:", bg ? "✅ FOUND" : "❌ NOT FOUND");

  // Deep dive: Title Card
  if (title) {
    console.log("\n🔍 Title Card Deep Dive:");
    const titleGlass = title.querySelector('.folio-glass') || 
                        title.querySelector('.glass') || 
                        title.querySelector('[class*="glass"]');
    if (titleGlass) {
      const tgs = getComputedStyle(titleGlass as HTMLElement);
      const hasNamespaced = (titleGlass as HTMLElement).className.includes('folio-glass');
      console.log(`  Found ${hasNamespaced ? '.folio-glass' : '.glass'} child:`, {
        bg: tgs.backgroundColor,
        alpha: toAlpha(tgs.backgroundColor),
        backdropFilter: tgs.backdropFilter,
        classes: (titleGlass as HTMLElement).className,
      });
      if (!hasNamespaced) {
        console.warn("  ⚠️ Using legacy .glass class - should use .folio-glass");
      }
    } else {
      console.log("  ⚠️ No glass element found within title card wrapper");
    }
  }

  // Deep dive: Action Dock
  if (dock) {
    console.log("\n🔍 Action Dock Deep Dive:");
    const dockGlass = dock.querySelector('.folio-glass') || 
                       dock.querySelector('.glass') || 
                       dock.querySelector('[class*="glass"]');
    if (dockGlass) {
      const dgs = getComputedStyle(dockGlass as HTMLElement);
      const hasNamespaced = (dockGlass as HTMLElement).className.includes('folio-glass');
      console.log(`  Found ${hasNamespaced ? '.folio-glass' : '.glass'} child:`, {
        bg: dgs.backgroundColor,
        alpha: toAlpha(dgs.backgroundColor),
        backdropFilter: dgs.backdropFilter,
        classes: (dockGlass as HTMLElement).className,
      });
      if (!hasNamespaced) {
        console.warn("  ⚠️ Using legacy .glass class - should use .folio-glass");
      }
    } else {
      console.log("  ⚠️ No glass element found within action dock wrapper");
    }
  }

  // Deep dive: Gradient Background
  if (bg) {
    console.log("\n🎨 Background Gradient Deep Dive:");
    console.log("  Position:", cb?.position);
    console.log("  Z-Index:", cb?.zIndex);
    console.log("  Inset:", cb?.inset || "N/A");
    console.log("  Background Image:", cb?.backgroundImage?.substring(0, 100) + "...");
    console.log("  Pointer Events:", cb?.pointerEvents);
    console.log("  Visibility:", cb?.visibility);
    console.log("  Opacity:", cb?.opacity);
  } else {
    console.log("\n⚠️ Background gradient element not found!");
    console.log("  Looking for: [data-testid='cinematic-bg']");
  }

  // Check for wrapper backgrounds that might hide gradient
  console.log("\n🔎 Checking for Wrapper Backgrounds:");
  const pageWrapper = document.querySelector('div.relative.bg-transparent') || 
                       document.querySelector('main') ||
                       document.querySelector('[class*="bg-surface-canvas"]');
  if (pageWrapper) {
    const wrapperStyle = getComputedStyle(pageWrapper as HTMLElement);
    console.log("  Wrapper found with classes:", (pageWrapper as HTMLElement).className);
    console.log("  Wrapper background:", wrapperStyle.backgroundColor);
    console.log("  Wrapper position:", wrapperStyle.position);
    console.log("  Wrapper z-index:", wrapperStyle.zIndex);
    
    if (wrapperStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
        wrapperStyle.backgroundColor !== 'transparent') {
      console.warn("  ⚠️ WARNING: Wrapper has non-transparent background!");
      console.warn("     This may hide the gradient layer.");
    }
  }

  // Try to extract palette from global context
  const palette = (window as any)?.__FOLIO_PRODUCT_PALETTE__ ?? null;
  console.log("\n🎨 Product Palette Check:");
  if (palette) {
    console.log("  Palette found:", palette);
    
    // Check if palette colors are too light (near white)
    const isNearWhite = (hex: string) => {
      if (!hex) return false;
      const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!rgb) return false;
      const r = parseInt(rgb[1], 16);
      const g = parseInt(rgb[2], 16);
      const b = parseInt(rgb[3], 16);
      const brightness = (r + g + b) / 3;
      return brightness > 240; // Near white if avg > 240
    };
    
    if (isNearWhite(palette.primary) || isNearWhite(palette.accent)) {
      console.warn("  ⚠️ WARNING: Palette colors are very light (near white)!");
      console.warn("     Gradient may be invisible on white background.");
    }
  } else {
    console.log("  No palette found in global context");
  }

  // Check if .folio-glass and legacy .glass classes exist in stylesheets
  console.log("\n📄 CSS Class Availability Check:");
  const hasFolioGlass = Array.from(document.styleSheets).some(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      return rules.some(rule => rule.cssText.includes('.folio-glass'));
    } catch (e) {
      return false; // CORS blocked
    }
  });
  const hasLegacyGlass = Array.from(document.styleSheets).some(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      return rules.some(rule => rule.cssText.includes('.glass'));
    } catch (e) {
      return false; // CORS blocked
    }
  });
  console.log("  .folio-glass class in stylesheets:", hasFolioGlass ? "✅ FOUND" : "❌ NOT FOUND");
  console.log("  .glass (legacy) class in stylesheets:", hasLegacyGlass ? "✅ FOUND" : "❌ NOT FOUND");

  // Final diagnostic summary
  console.log("\n📊 DIAGNOSTIC SUMMARY:");
  const issues = [];
  
  if (!cssRoot.glassAlpha) {
    issues.push("❌ CSS variable --glass-alpha not found");
  } else if (cssRoot.glassAlpha !== "0.10" && cssRoot.glassAlpha !== "0.1") {
    issues.push(`⚠️ --glass-alpha is ${cssRoot.glassAlpha}, expected 0.10`);
  }
  
  if (!title || !dock) {
    issues.push("❌ Glass panel elements not found in DOM");
  }
  
  if (!bg) {
    issues.push("❌ Background gradient element not found");
  }
  
  if (toAlpha(ct?.backgroundColor) !== 0.10 && toAlpha(ct?.backgroundColor) !== 0.1) {
    issues.push(`⚠️ Title card alpha is ${toAlpha(ct?.backgroundColor)}, expected 0.10`);
  }
  
  if (toAlpha(cd?.backgroundColor) !== 0.10 && toAlpha(cd?.backgroundColor) !== 0.1) {
    issues.push(`⚠️ Action dock alpha is ${toAlpha(cd?.backgroundColor)}, expected 0.10`);
  }
  
  if (!hasFolioGlass) {
    issues.push("❌ .folio-glass CSS class not found in stylesheets");
  }
  
  // Check if elements are using namespaced class
  const titleGlassEl = title?.querySelector('.folio-glass');
  const dockGlassEl = dock?.querySelector('.folio-glass');
  if (title && !titleGlassEl) {
    issues.push("⚠️ Title card not using .folio-glass (may be using legacy .glass)");
  }
  if (dock && !dockGlassEl) {
    issues.push("⚠️ Action dock not using .folio-glass (may be using legacy .glass)");
  }
  
  if (issues.length === 0) {
    console.log("✅ All checks passed! Glass and gradient should be rendering correctly.");
  } else {
    console.log("Issues detected:");
    issues.forEach(issue => console.log("  " + issue));
  }
  
  console.log("\n====================================");
}

