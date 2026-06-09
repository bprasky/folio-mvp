# 17_IMAGE_PROVENANCE_GATE

## Purpose

This document defines image provenance classes and a contextual display gate so that vendor-derived images stay usable inside the designer's workspace but are never served on public or attribution surfaces without a vendor grant. It remediates a confirmed live exposure.

This is a prerequisite for any capture path. Both the interactive session and the extension produce vendor-derived images, and the import agent already does. The gate has to exist before more vendor images enter the catalog.

## Context

Folio's policy prioritizes the vendor image as the product image. That is correct inside project files, where the designer is working privately. It is wrong on public product pages and attribution areas, where the vendor image is being served today in places that are not fully mapped. A copy of a vendor's photograph served publicly as if it were Folio's is an IP exposure.

The fix is not to stop using the vendor image internally. The fix is to make the display rule contextual and enforce it in the data layer.

## Core Principle

The vendor image is reference. It belongs where the designer is working. It is not Folio's to publish. Public and attribution surfaces show the designer's own in-situ crop, or a placeholder, until a vendor grant exists.

Provenance is tracked on the row. Enforcement is contextual at the serializer. Components never decide this.

## Provenance Classes

```prisma
enum ImageSource {
  VENDOR_REFERENCE     // captured, scraped, pasted, linked, or a derivative. Internal only. Default for unknown provenance.
  VENDOR_LICENSED      // vendor uploaded or granted for public display (Phase 1B). Publicly displayable.
  DESIGNER_ORIGINAL    // designer's own photography. Publicly displayable.
  FOLIO_COMMISSIONED   // Folio produced. Publicly displayable.
}

enum DisplayScope {
  INTERNAL             // visible only in the designer's workspace and project files
  PUBLIC               // eligible for public and attribution surfaces
}
```

`displayScope` is derived from the class by default (VENDOR_REFERENCE maps to INTERNAL, the other three map to PUBLIC eligible). It is kept as an explicit column so a deliberate override is possible later, but nothing should rely on setting it by hand.

## Where The Classes Live

The two classes are already encoded by model identity. The gate makes that explicit.

* `ProjectImage.url` is the designer's room photo. DESIGNER_ORIGINAL. Publishable.
* `ProductTag.cropUrl` is a crop of the designer's room photo, already produced by `generate-crops`. DESIGNER_ORIGINAL. This is the public substitute for a suppressed product image.
* `Product.imageUrl` and `Product.cutoutImageUrl` carry `imageSource` per row, since captures never dedupe. Default VENDOR_REFERENCE. A cutout inherits the scope of the source it was derived from.

## The Resolver

One server-side function, the single chokepoint.

```ts
type RenderContext = 'INTERNAL' | 'PUBLIC';

function resolveProductImage(
  product: { imageUrl: string | null; cutoutImageUrl: string | null; imageSource: ImageSource },
  insituCropUrl: string | null,   // ProductTag.cropUrl for the relevant tag
  context: RenderContext
): string | null {
  if (context === 'INTERNAL') {
    // workspace and project files keep current behavior, vendor image preferred
    return product.imageUrl ?? product.cutoutImageUrl ?? insituCropUrl;
  }

  // PUBLIC: never emit a VENDOR_REFERENCE url
  const publishable =
    product.imageSource === 'VENDOR_LICENSED' ||
    product.imageSource === 'DESIGNER_ORIGINAL' ||
    product.imageSource === 'FOLIO_COMMISSIONED';

  if (publishable) return product.imageUrl ?? product.cutoutImageUrl ?? insituCropUrl;
  return insituCropUrl ?? null; // fall back to the designer crop, or placeholder upstream
}
```

Every public serializer and public-read API calls this with `context: 'PUBLIC'`. That set includes the public product pages and their OG meta, the public catalog APIs (`/api/products`, `/api/products/bulk`, `/api/profile/[userId]/shop`, `/api/products/[productId]/context-photos`), published projects and editorials, designer, org, and user shop tabs, search moments, the vendor shop, events, the homepage boost reel, and the Instagram export. Internal and workspace queries call with `context: 'INTERNAL'`. Components consume the resolved value. They never read raw `imageUrl` for a public render.

## Remediation

This is live, so the work is remediation, not a default on new rows alone.

1. Migration, ADD only and idempotent. Create the enums behind existence guards. Add `imageSource` defaulting to VENDOR_REFERENCE and `displayScope` defaulting to INTERNAL to `products`.

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImageSource') THEN
    CREATE TYPE "ImageSource" AS ENUM
      ('VENDOR_REFERENCE','VENDOR_LICENSED','DESIGNER_ORIGINAL','FOLIO_COMMISSIONED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisplayScope') THEN
    CREATE TYPE "DisplayScope" AS ENUM ('INTERNAL','PUBLIC');
  END IF;
END $$;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "imageSource" "ImageSource" NOT NULL DEFAULT 'VENDOR_REFERENCE';
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "displayScope" "DisplayScope" NOT NULL DEFAULT 'INTERNAL';
```

The default applies to every existing row, so all legacy products start suppressed on public surfaces. That is the fail-safe backfill. No destructive step.

2. Audit public read paths. The chokepoint only protects surfaces that go through it. Find every public route that reads `Product.imageUrl` or `cutoutImageUrl` directly and reroute it through the resolver. The unmapped surfaces are found by this audit, not by guessing.
3. Promote upward only on positive evidence. A row stays VENDOR_REFERENCE unless there is a reason to move it. Positive evidence examples: image uploaded under a vendor-claimed org path, or a Phase 1B grant. When in doubt, leave it INTERNAL. Over-suppression is the correct error.
4. Cutouts inherit source provenance. A cutout derived from a vendor image is VENDOR_REFERENCE. If a cutout's source cannot be determined, default it INTERNAL.

## The Test

One serializer-level test replaces thirty scattered checks. It enumerates the public serializers and public-read APIs and asserts that none of them emit a URL belonging to a VENDOR_REFERENCE row. Add it to CI. A new public route that reads `imageUrl` directly fails the test, which is how regressions are caught.

## Promotion Path (Phase 1B)

A vendor grant is a claim plus a license. It flips matching `Product` rows from VENDOR_REFERENCE to VENDOR_LICENSED. The same resolver then serves `imageUrl` publicly with no change at any call site. Only the row's class changes. Folio does not assert ownership of the vendor image. The grant is the vendor licensing their own image for public display.

## Guardrails and Non-Negotiables

* Fail safe. Unknown provenance is INTERNAL.
* The gate is enforced in data, not components. A component-only gate leaks through the public APIs.
* Derivatives inherit source provenance. Cutouts are in scope.
* Internal workspace behavior is unchanged. The vendor image stays the preferred product image inside project files.
* Folio does not claim ownership of vendor images. The resolver simply does not serve them on public surfaces without a grant.

## Open Questions

* Which provenance signals exist on legacy rows so promotion does not have to be fully manual. Vendor-org upload paths and known Supabase storage paths are the likely tells.
* Placeholder design for the no-crop case in attribution areas.
* Whether any current `cutoutImageUrl` is DESIGNER_ORIGINAL, meaning a cutout taken from a room photo, and how to distinguish it from a cutout taken from a vendor image.
* Counsel drafts the vendor grant and license language used for the 1B promotion, and the designer photography license that makes the in-situ crop Folio licensed.

## Related Documents

* 19_ASSISTED_CAPTURE_SYSTEM (renumbered): the capture flow that depends on this gate.
* 16_ATTRIBUTION_CONSENT: the consent architecture this is the image-rights counterpart to.
* 13_IMPORT_AGENT_SPEC: another producer of vendor-derived images that this gate covers.
* 02_NON_NEGOTIABLES: hard boundaries this inherits.
