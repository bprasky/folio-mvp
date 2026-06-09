# 19_ASSISTED_CAPTURE_SYSTEM

> Prerequisite: 17_IMAGE_PROVENANCE_GATE. Capture produces vendor-derived images, which must enter the catalog as `VENDOR_REFERENCE` behind the provenance gate. Build the gate first.

## Purpose

This document specifies human-assisted product capture for pages that block automated scraping. It extends the existing guided manual capture in the tagger by adding the one piece that is missing today: getting a person past a bot wall and the resulting product data back into Folio without leaving the platform.

Bot deterrence has tightened. The server scrape path fails more often. The fallback once a human already has the data is solved. The gap is the step in between.

## What Already Exists

Do not rebuild any of this. The new flow plugs into it.

* `/api/scrape-product` returns `blocked: true`, 422, or 502 when a page cannot be read.
* Guided manual capture panel in `ProjectImageTagger.tsx` (autofill handlers, generalized save).
* `parse-text` and `parse-image` endpoints, with the shared extraction prompt and JSON normalization in `src/lib/products/manualCapture.ts` (one contract for both).
* Product creation as an `isPending` stub via `POST /api/products`, then tagged to the image at the placed dot. The save flow is unchanged.

The captured product is already normalized into the exact preview shape the scrape path produces. The new flow produces the same shape, so the save path stays untouched.

## Triage: The Cheap Check

A plain server fetch with no headless browser and no AI is close to free. This is the first action on any pasted link.

* 200 with readable structured markup (JSON-LD `Product`, OpenGraph tags): scrape it free, done.
* 403, 429, a challenge body, or Cloudflare or DataDome markers: flag `blocked: true` and route to the assisted path.

This branch already exists in `/api/scrape-product`. The work is routing the blocked result into the new capture session instead of straight to the manual form.

## Architecture Decision

Two paths can deliver an assisted capture inside Folio. The split is about whose browser solves the challenge.

Decision: build Path A first. It reuses the Browserless integration already in the stack and needs no install. Document Path B as the escalation path and build it only if specific high value vendor domains keep blocking the datacenter browser even with a human present.

### Path A: Interactive Session via Browserless liveURL (Phase 1A build)

End to end:

1. Triage returns blocked.
2. Folio opens a server browser session through Browserless and navigates to the URL.
3. Browserless returns a `liveURL`. Folio embeds it in an iframe inside the tagger. This is the Folio window. The stream is interactive, so the user's clicks and typing are forwarded into the live session.
4. The user solves the challenge in the stream.
5. On the `liveComplete` event, or on an explicit "I am on the product page, capture" action, the server reads the rendered DOM (name, brand, price, image URL) and takes a screenshot of the final state.
6. The result is normalized to the same preview shape `parse-*` produces and handed to the existing `isPending` stub save and tag at dot.
7. The DOM read is primary. `parse-image` vision becomes the fallback for when the DOM read comes back thin.

Why this is better than today: you read real text and the real image URL instead of running vision OCR on a picture. The data is cleaner and the per capture cost is lower.

Integration notes:

* `liveURL` defaults to a jpeg stream for low bandwidth. Set `interactable: true` so the user can act in the session.
* The session stays open until `liveComplete`. Capture the screenshot and read the DOM at that point.
* liveURL is a paid plan feature. Confirm the current Browserless plan covers it.
* Folio's CSP (`next.config.js`) has no `frame-src` directive, so it falls back to `default-src 'self'` and will refuse the iframe. Add `frame-src https://<browserless-live-origin>` before the embed will load.

Caveats:

* The hardest walls fingerprint the datacenter browser and its IP. A human solving the visible challenge raises the pass rate but does not guarantee it. Pair the session with a residential proxy and a stealth config to improve odds.
* Spend scales with blocked pages, not with all tagging.

### Path B: Folio Capture Extension (escalation path)

The extension runs in the designer's own browser. They navigate to the product page normally, on their own residential IP and real fingerprint, so the wall has nothing to detect. On the page they click the Folio button, the extension reads the DOM and can capture the visible tab, and it posts the result into the same `isPending` save.

This is the most reliable way past modern deterrence and gives the cleanest data. The cost is a separate artifact to build and maintain plus an install ask. For a known founding cohort that friction is acceptable.

Build trigger: a list of vendor domains that still block Path A even with a human, long enough to justify the work.

A native webview, if Folio ever ships a desktop or mobile shell, sidesteps the iframe constraint entirely, since WKWebView and Electron BrowserView are full browser contexts. Park this until a shell exists.

## IP and Ownership Posture

The provenance rules and the display gate are specified in 17_IMAGE_PROVENANCE_GATE and are binding on this flow. The capture-specific points:

* A captured or uploaded image carries an `imageSource`. Captures default to `VENDOR_REFERENCE`, which the gate keeps `INTERNAL` (workspace only) until a vendor grant exists.
* `VENDOR_REFERENCE` images are never shown on public, editorial, or vendor surfaces and are never presented as Folio property in Phase 1A.
* The product attribution metadata extracted during capture (vendor name, product name, price) is factual and publishable as a tag. The reference image is the only gated artifact.
* The ownership leverage Folio holds is on `DESIGNER_ORIGINAL` and `FOLIO_COMMISSIONED` photography. A vendor that wants to repost an in-situ shot of their product in a designed room is asking to license Folio's photograph. That only holds if the designer terms assign or license that photography to Folio.
* Phase 1B vendor approval is a license grant (`VENDOR_REFERENCE` to `VENDOR_LICENSED`), not a transfer of ownership to Folio.
* Brand and product names appear for attribution as nominative use. Folio does not claim vendor trademarks.

Counsel drafts the designer terms photography clause and the public terms. The architecture (17) separates the classes so the rights land on the asset Folio can defend.

## Data Model

Additions, ADD only, idempotent. The `imageSource` / `displayScope` columns and enums come from 17_IMAGE_PROVENANCE_GATE. This spec adds the session record.

```prisma
model CaptureSession {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  sourceUrl      String
  projectImageId String?

  status         CaptureStatus @default(OPEN)
  // OPEN to LIVE to EXTRACTED to SAVED to FAILED to EXPIRED

  liveUrl        String?
  capturedImageUrl String?
  extracted      Json?    // normalized product preview

  createdAt      DateTime @default(now())
  completedAt    DateTime?

  @@index([userId, status])
  @@map("capture_sessions")
}

enum CaptureStatus {
  OPEN
  LIVE
  EXTRACTED
  SAVED
  FAILED
  EXPIRED
}
```

A capture is private by default (`VENDOR_REFERENCE` / `INTERNAL`) and has to be promoted deliberately.

## API Contract

New endpoints, both auth gated.

```
POST /api/capture/session
  body:    { url: string, projectImageId?: string }
  action:  opens a Browserless session, navigates, returns the liveURL
  returns: { sessionId: string, liveURL: string, expiresAt: string }

POST /api/capture/extract
  body:    { sessionId: string }
  action:  on liveComplete or explicit capture, reads DOM and screenshots final state
  returns: NormalizedProductPreview   // same shape parse-* returns
```

`NormalizedProductPreview` reuses the `manualCapture.ts` contract: `name, brand, price, currency, description, imageUrl`, plus `imageSource: 'VENDOR_REFERENCE'`. Dimensions, materials, and colors fold into the description so nothing is lost.

Unchanged:

* `POST /api/products` creates the `isPending` stub.
* `parse-text` and `parse-image` remain as the fallback when the DOM read is thin or absent.

New library files:

* `src/lib/capture/session.ts`: Browserless session lifecycle, liveURL, DOM read, final state screenshot.
* `src/app/api/capture/session/route.ts` and `src/app/api/capture/extract/route.ts`.
* `ProjectImageTagger.tsx`: the liveURL iframe panel and the capture handler, alongside the existing autofill handlers.

## Guardrails and Non-Negotiables

* The human solves the challenge. Folio does not solve or bypass challenges programmatically. This is a human-in-the-loop tool, not a bot.
* `VENDOR_REFERENCE` images are internal only in Phase 1A. No public serving, no public rehosting, no claim of ownership. Enforced by 17.
* Cost is bounded. The session only opens on a blocked page. The vision fallback only fires on a thin DOM read. Spend scales with blocked pages.
* Endpoints are auth gated. The extraction prompt returns `null` when a value is not clearly present. No invented data.
* No giant data URLs in the database. Persist the hosted image URL only. If hosting fails, fields still parse and the image can be attached separately.
* The save path is unchanged. The captured product normalizes to the existing preview shape.

## Implementation Phases

Phase 1A (build now, after 17)

* Triage routes blocked pages into a capture session.
* Path A liveURL flow inside the tagger.
* DOM read primary, vision fallback secondary.
* Captured products enter as `VENDOR_REFERENCE` / `INTERNAL` per the gate.

Phase 1B (vendor outreach)

* Vendor approval grants a license that flips approved vendor images to `VENDOR_LICENSED` public display.
* Captured attribution metadata and shadow profiles drive the warm outreach. The vendor arrives to claim data that already exists about them.

Later

* Path B capture extension if a list of hard datacenter walls justifies it.

## Open Questions

* Confirm the Browserless plan covers liveURL.
* Pick a residential proxy provider for the session.
* Track which vendor domains stay blocked under Path A. That list is the Path B trigger.
* Designer terms: photography license or assignment language, drafted by counsel. This is what makes the ownership standoff hold.
* Public product card behavior in Phase 1A when no displayable image exists: placeholder versus designer in-situ crop.

## Related Documents

* 17_IMAGE_PROVENANCE_GATE: the prerequisite display gate this capture flow feeds.
* 16_ATTRIBUTION_CONSENT: data tiers and the consent architecture the captured attribution feeds.
* 13_IMPORT_AGENT_SPEC: the pre-vendor data moat and the shadow profiles capture metadata enriches.
* 11_GO_TO_MARKET_SEQUENCING: phase timing for the 1A to 1B handoff.
* 02_NON_NEGOTIABLES: hard boundaries this spec inherits.
