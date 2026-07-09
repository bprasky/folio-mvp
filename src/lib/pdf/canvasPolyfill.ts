/**
 * DOMMatrix / ImageData / Path2D polyfill for pdfjs-dist in serverless Node.
 *
 * IMPORTANT: this module must be imported *before* `pdfjs-dist/legacy/build/
 * pdf.mjs`. pdf.mjs runs `const SCALE_MATRIX = new DOMMatrix()` at module-eval
 * time, so `DOMMatrix` has to exist on `globalThis` before that import is
 * evaluated. ES imports evaluate top-to-bottom, so importing this file *above*
 * the pdfjs import in extractText.ts guarantees the ordering. (The old code set
 * the polyfill *after* the pdfjs import — too late — which is why Vercel crashed
 * with "DOMMatrix is not defined" the moment pdf.mjs loaded.)
 *
 * Preference order:
 *   1. Real @napi-rs/canvas — full geometry + rendering. Needed for the PDF→PNG
 *      visual-analysis step. Used whenever the native package is in the bundle.
 *   2. Minimal pure-JS stubs. pdfjs only *constructs* DOMMatrix on the text-
 *      extraction path (verified: it never calls a matrix method there — text
 *      item transforms come from pdfjs's own array math, not DOMMatrix), so the
 *      stub is enough to keep spec extraction working even when the native
 *      module is missing from the serverless bundle. Page rendering degrades,
 *      but every caller of it is already best-effort / try-caught.
 *
 * This decouples the core extraction path from whether Vercel's file tracing
 * managed to bundle the @napi-rs/canvas native binary — extraction no longer
 * 500s when it doesn't.
 */

const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.DOMMatrix === 'undefined') {
  let installed = false;

  try {
    // Bare require (compiles to CJS in the Next.js server bundle), same pattern
    // pdfjs itself uses internally to find canvas.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const canvas = require('@napi-rs/canvas');
    if (canvas?.DOMMatrix) {
      g.DOMMatrix = canvas.DOMMatrix;
      if (canvas.ImageData) g.ImageData = canvas.ImageData;
      if (canvas.Path2D) g.Path2D = canvas.Path2D;
      installed = true;
      console.log('[canvasPolyfill] DOMMatrix provided by @napi-rs/canvas');
    }
  } catch (err) {
    console.warn(
      '[canvasPolyfill] @napi-rs/canvas unavailable; falling back to JS DOMMatrix stub (text extraction unaffected, page rendering disabled):',
      (err as Error)?.message,
    );
  }

  if (!installed) {
    // Identity matrix with chainable no-op methods. Every method pdfjs might
    // call returns `this` (or the point unchanged) so nothing throws; the
    // numeric fields read as an identity transform.
    class MinimalDOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_init?: unknown) {}
      multiply() { return this; }
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translate() { return this; }
      translateSelf() { return this; }
      scale() { return this; }
      scaleSelf() { return this; }
      scale3d() { return this; }
      rotate() { return this; }
      rotateSelf() { return this; }
      invertSelf() { return this; }
      inverse() { return this; }
      transformPoint(point?: unknown) { return point; }
      getTransform() { return this; }
    }

    g.DOMMatrix = g.DOMMatrix ?? MinimalDOMMatrix;
    g.ImageData = g.ImageData ?? class ImageDataStub {};
    g.Path2D = g.Path2D ?? class Path2DStub {};
  }
}

export {};
