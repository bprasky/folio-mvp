/**
 * Gradient Cascade Audit
 * Finds exactly which CSS rules are overriding the gradient
 */

export function auditGradientCascade() {
  const el = document.getElementById('folio-cinematic-bg');
  
  if (!el) {
    console.error('❌ Element #folio-cinematic-bg not found in DOM');
    return;
  }

  const cs = getComputedStyle(el);
  
  console.group('🧪 GRADIENT CASCADE AUDIT');
  console.log('\n📋 Element State:');
  console.table({
    'ID': el.id,
    'Class': el.className,
    'Style Attr': (el as HTMLElement).getAttribute('style') || '(none)',
    'Computed background': cs.background,
    'Computed background-image': cs.backgroundImage,
    'Computed background-color': cs.backgroundColor,
    'Computed position': cs.position,
    'Computed z-index': cs.zIndex,
  });

  // Scan stylesheets for rules that touch our element
  console.log('\n📚 CSS Rules Targeting This Element:');
  const hits: Array<{sheet: string; selector: string; properties: string}> = [];
  
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { 
      rules = (sheet as CSSStyleSheet).cssRules; 
    } catch (e) { 
      // CORS blocked external stylesheet
      continue; 
    }
    
    for (const rule of Array.from(rules || [])) {
      const sr = rule as CSSStyleRule;
      if (!sr.selectorText) continue;
      
      // Check if selector matches our element
      const matchesId = sr.selectorText.includes('#folio-cinematic-bg');
      const matchesTestId = sr.selectorText.includes('[data-testid="cinematic-bg"]');
      const matchesClass = sr.selectorText.includes('.fixed') || 
                           sr.selectorText.includes('.inset-0') ||
                           sr.selectorText.includes('.pointer-events-none');
      
      if (!matchesId && !matchesTestId && !matchesClass) continue;
      
      const decl = sr.style?.cssText || '';
      
      // Only show rules that set background properties
      if (/\bbackground/.test(decl)) {
        hits.push({ 
          sheet: sheet.href || '(inline/global.css)', 
          selector: sr.selectorText, 
          properties: decl.substring(0, 100) + (decl.length > 100 ? '...' : '')
        });
      }
    }
  }
  
  if (hits.length === 0) {
    console.log('✅ No CSS rules found setting background on this element');
  } else {
    console.table(hits);
    console.warn(`⚠️ Found ${hits.length} CSS rule(s) that might override background`);
  }

  // Check for CSS variable
  console.log('\n🔬 CSS Variable Check:');
  const varValue = cs.getPropertyValue('--folio-cinematic-bg-image');
  console.log('--folio-cinematic-bg-image:', varValue || '(not set)');
  
  // Check specificity of inline style
  console.log('\n⚡ Inline Style Analysis:');
  const inlineStyle = el.getAttribute('style');
  if (inlineStyle) {
    console.log('Inline style:', inlineStyle);
    if (inlineStyle.includes('background:')) {
      console.warn('⚠️ Using background shorthand (resets sub-properties)');
    }
    if (inlineStyle.includes('background-image:')) {
      console.log('✅ Using background-image (preserves other properties)');
    }
    if (inlineStyle.includes('--folio-cinematic-bg-image')) {
      console.log('✅ Using CSS variable approach');
    }
  }

  console.groupEnd();
  
  // Return diagnostic data
  return {
    element: el,
    computedBackgroundImage: cs.backgroundImage,
    hasVariable: !!varValue,
    conflictingRules: hits.length,
  };
}




