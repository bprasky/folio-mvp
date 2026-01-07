/**
 * COMPLETE GRADIENT DIAGNOSTIC
 * Deep dive into why gradient isn't rendering
 */

export function fullGradientDiagnostic() {
  console.clear();
  console.log("🔬 COMPLETE GRADIENT DIAGNOSTIC");
  console.log("=".repeat(60));
  
  // 1. Check if gradient element exists
  console.log("\n1️⃣ GRADIENT ELEMENT CHECK:");
  const bgEl = document.querySelector('[data-testid="cinematic-bg"]') as HTMLElement;
  
  if (!bgEl) {
    console.error("❌ CRITICAL: Gradient element NOT FOUND in DOM!");
    console.log("   → CinematicBackground component not rendering");
    console.log("   → Check: Is component imported and rendered?");
    console.log("   → Check: Is feature flag NEXT_PUBLIC_FEATURE_CINEMATIC_PRODUCT=1?");
    return;
  }
  
  console.log("✅ Gradient element FOUND");
  console.log("   Element:", bgEl);
  
  // 2. Check computed styles
  console.log("\n2️⃣ GRADIENT STYLES:");
  const style = getComputedStyle(bgEl);
  console.log("   Position:", style.position, style.position === 'fixed' ? '✅' : '❌');
  console.log("   Z-Index:", style.zIndex, style.zIndex === '-10' ? '✅' : '❌');
  console.log("   Display:", style.display, style.display !== 'none' ? '✅' : '❌');
  console.log("   Visibility:", style.visibility, style.visibility === 'visible' ? '✅' : '❌');
  console.log("   Opacity:", style.opacity, style.opacity === '1' ? '✅' : '❌');
  console.log("   Width:", style.width);
  console.log("   Height:", style.height);
  console.log("   Top:", style.top);
  console.log("   Left:", style.left);
  console.log("   Right:", style.right);
  console.log("   Bottom:", style.bottom);
  
  // 3. Check background gradient
  console.log("\n3️⃣ BACKGROUND GRADIENT:");
  const bgImage = style.backgroundImage;
  console.log("   Background Image:", bgImage);
  
  if (bgImage === 'none' || !bgImage) {
    console.error("❌ CRITICAL: No background-image gradient!");
    console.log("   → Gradient not being set in inline style");
    console.log("   → Check CinematicBackground component logic");
  } else {
    console.log("✅ Gradient defined");
    
    // Parse gradient colors
    const rgbaMatches = bgImage.match(/rgba?\([^)]+\)/g);
    if (rgbaMatches) {
      console.log("\n   Gradient Colors:");
      rgbaMatches.forEach((color, i) => {
        console.log(`   [${i}]`, color);
        
        // Check if colors are too light
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
        if (m) {
          const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
          const a = parseFloat(m[4] || '1');
          
          if (r > 250 && g > 250 && b > 250) {
            console.warn(`      ⚠️ Very light color (near white)`);
          }
          if (a < 0.02) {
            console.warn(`      ⚠️ Very low opacity (${a * 100}%)`);
          }
        }
      });
    }
  }
  
  // 4. Check palette source
  console.log("\n4️⃣ PALETTE SOURCE:");
  const palette = (window as any).__FOLIO_PRODUCT_PALETTE__;
  if (!palette || !palette.primary) {
    console.warn("⚠️ No palette in window.__FOLIO_PRODUCT_PALETTE__");
    console.log("   → Using fallback colors");
    console.log("   → Fallback should be: #d7c9b8 (warm tan)");
  } else {
    console.log("✅ Palette found:", palette);
    
    // Check if palette colors are white
    const isWhite = (hex: string) => {
      const rgb = parseInt(hex.replace('#', ''), 16);
      return rgb > 0xF0F0F0; // Very light
    };
    
    if (isWhite(palette.primary)) {
      console.error("❌ PRIMARY COLOR IS WHITE/NEAR-WHITE:", palette.primary);
    }
    if (isWhite(palette.accent)) {
      console.error("❌ ACCENT COLOR IS WHITE/NEAR-WHITE:", palette.accent);
    }
  }
  
  // 5. Check z-index stacking
  console.log("\n5️⃣ Z-INDEX STACKING:");
  const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
  const elementsAboveGradient = allElements.filter(el => {
    const z = parseInt(getComputedStyle(el).zIndex);
    return !isNaN(z) && z > -10;
  }).slice(0, 10); // Top 10
  
  console.log(`   Found ${elementsAboveGradient.length} elements with z-index > -10`);
  elementsAboveGradient.forEach(el => {
    const z = getComputedStyle(el).zIndex;
    const bg = getComputedStyle(el).backgroundColor;
    console.log(`   z=${z}: ${el.tagName} ${el.className.substring(0, 40)}`, bg !== 'rgba(0, 0, 0, 0)' ? '(has bg)' : '');
  });
  
  // 6. Check if gradient is actually visible
  console.log("\n6️⃣ VISIBILITY TEST:");
  const rect = bgEl.getBoundingClientRect();
  console.log("   Bounding box:", {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  });
  
  if (rect.width === 0 || rect.height === 0) {
    console.error("❌ CRITICAL: Gradient has ZERO dimensions!");
    console.log("   → Element not taking up space");
    console.log("   → Check CSS: inset-0 applied?");
  }
  
  // 7. Try to make gradient BRIGHT for testing
  console.log("\n7️⃣ MANUAL TEST:");
  console.log("   Run this to make gradient BRIGHT RED:");
  console.log(`   document.querySelector('[data-testid="cinematic-bg"]').style.background = 'linear-gradient(180deg, rgba(255,0,0,0.5), rgba(0,0,255,0.5))';`);
  
  // 8. Check parent elements
  console.log("\n8️⃣ PARENT ELEMENTS:");
  let parent = bgEl.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    const pStyle = getComputedStyle(parent);
    console.log(`   [${depth}] ${parent.tagName}.${parent.className.substring(0, 30)}`);
    console.log(`       position: ${pStyle.position}, z-index: ${pStyle.zIndex}, bg: ${pStyle.backgroundColor}`);
    parent = parent.parentElement;
    depth++;
  }
  
  // 9. Check inline styles
  console.log("\n9️⃣ INLINE STYLES:");
  console.log("   style attribute:", bgEl.getAttribute('style') || '(none)');
  
  // 10. Final diagnosis
  console.log("\n🎯 DIAGNOSIS:");
  const issues = [];
  
  if (!bgEl) issues.push("Element not in DOM");
  if (style.position !== 'fixed') issues.push("Not fixed positioned");
  if (style.zIndex !== '-10') issues.push(`Wrong z-index: ${style.zIndex}`);
  if (style.display === 'none') issues.push("Display is none");
  if (bgImage === 'none' || !bgImage) issues.push("No background gradient");
  if (rect.width === 0 || rect.height === 0) issues.push("Zero dimensions");
  
  if (issues.length === 0) {
    console.log("✅ Gradient should be rendering correctly!");
    console.log("   → If not visible, colors may be too subtle");
    console.log("   → Try the BRIGHT RED test above");
  } else {
    console.error("❌ Issues found:");
    issues.forEach(issue => console.error(`   - ${issue}`));
  }
  
  console.log("\n" + "=".repeat(60));
}




