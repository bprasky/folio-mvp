# Cost Audit: Publishing One Project

**Date:** 2026-06-13
**Scope:** read-only audit. No code changed.
**Question:** what does it cost Folio, in external paid API calls and storage, to take one project from interview through publish?

---

## TL;DR

- **Today, the dominant cost of publishing one project is Anthropic (Claude) — roughly $0.60–$1.10 per project**, almost all of it in the text interview + editorial generation pipeline. Everything else is either $0 (not wired up) or rounding error.
- **The single biggest avoidable cost is that there is no prompt caching anywhere in the codebase** (`grep cache_control` → 0 hits). Every Claude call re-sends its full system prompt and context at full input price. Many calls share large stable system prompts (FOLIO_TONE, persona, schema instructions) that would cache cleanly.
- **fal.ai 3D generation does NOT fire on publish.** It is lazy / on-demand (per-product, fire-and-forget, or explicit "Generate 3D Assets" button). Per-project 3D cost on the publish path is **$0** unless a user triggers it.
- **Deepgram + LiveKit + Cartesia cost $0 today.** The voice interview microservice (`services/interview-orchestration/`) is code-complete but **not deployed** — the UI *simulates* it (`tasks/INTERVIEW_SYSTEM_AUDIT_V2.md:318`, `RealtimeInterviewView.tsx:337`). The interview that actually runs in production is text-based and uses Claude only.
- **Every Claude call uses `claude-sonnet-4-20250514`** (the original Sonnet 4) plus one Haiku call. **No Opus anywhere** — so there is no Opus-overspend to flag. But note: `claude-sonnet-4-20250514` is **deprecated and retires 2026-06-15** (2 days from this audit). This is a latent outage risk, not just a cost issue.
- **Resend emails fire on publish** (one per tagged vendor) but are **kill-switched off by default** (`VENDOR_TAGGED_EMAILS_ENABLED` defaults to false).
- **Storage is cheap monthly but compounding.** ~9.6 MB/project without 3D, ballooning to ~145 MB/project if 3D meshes are generated. Originals AND crops/cutouts/masks/meshes are all retained.

---

## 1. External paid API call sites (publish / interview / tagging)

### Anthropic (Claude) — model `claude-sonnet-4-20250514` unless noted

| # | File | Function | max_tokens | Trigger | On publish path? |
|---|------|----------|-----------|---------|------------------|
| 1 | `src/lib/interview/generateProjectQuestions.ts:264` | `generateProjectQuestions` | 2048 | Start interview for a project | Yes (interview) |
| 2 | `src/lib/interview/generateRoomQuestions.ts:139` | `generateRoomQuestions` | 2048 | **Per room** (image-heavy) | Yes (interview) |
| 3 | `src/lib/interview/spatialFlow.ts:84` | `detectRooms` | 2048 | Room-relationship detection (all room images) | Yes (interview) |
| 4 | `src/lib/interview/buildInterviewBrief.ts:624` | `generateNarrativeBrief` | 4096 | Synthesize interview → brief (multimodal) | Yes (interview) |
| 5 | `src/lib/interview/narrativeGeneration.ts:51/135/299/424` | transitions / intros / materials | 512–1024 | Per room / per transition | Yes (interview) |
| 6 | `src/lib/interview/answerAnalysis.ts:71` | `extractVendorMentions` | 512 | Per answer batch (boost detection) | Yes (interview) |
| 7 | `…/interview/followups{,/single,/batch}/route.ts` | follow-up generation | ~2048 | Each follow-up question | Yes (interview) |
| 8 | `src/lib/posting/generateEditorialDraft.ts:1227` | `generateEditorialDraft` (main) | `max(4096, rooms*800+2000)` | **"Generate draft"** (pre-publish) | Yes (editorial) |
| 9 | `src/lib/posting/generateEditorialDraft.ts:431` | `spliceHookQuote` | 200 | During editorial generation | Yes (editorial) |
| 10 | `src/lib/posting/generateEditorialDraft.ts:1129` | `fixOpeners` — **`claude-haiku-4-5-20251001`** | `max(1024, n*500)` | Copy-edit paragraph openers | Yes (editorial) |
| 11 | `…/interview/generate/route.ts:638,1285` | brief gen + narrative re-sort | — | Generate flow | Yes (editorial) |

Adjacent / not on the core publish path (separate cost centers, listed for completeness): `aesthetic/imageClassification.ts`, `instagram*/`, `designer-bio/`, `org-onboarding/`, `pdf/aiEnhancement.ts`, `products/aiExtractProduct.ts`, `import-agent/`, `collaboration/`, `prompted-content/`, `atelier/`, `tagging/estimateProductCoordinates.ts`. All Sonnet 4, all uncached.

### OpenAI (moderation)

- `src/lib/posting/moderation.ts:27` — `omni-moderation-latest`, per answer batch, soft-fail, non-blocking. Effectively free.

### fal.ai (3D mesh generation) — NOT on publish

- `src/lib/three-d/sam3d-client.ts` — endpoints `fal-ai/trellis-2` (primary), `fal-ai/triposr` (fallback), `fal-ai/sam-3/image` (tag segmentation).
- Triggers:
  - `src/lib/three-d/triggerMeshGeneration.ts:13` — fire-and-forget, **on product create / image update** (not publish).
  - `src/app/api/tags/[tagId]/generate-3d/route.ts` — **explicit per-tag** request only.
  - `src/app/api/projects/[id]/generate-3d-assets/route.ts` — **explicit "Generate 3D Assets" button**; loops over *unique products* in the project (deduped), skips any with an existing `threeDAssetUrl`.
  - `src/app/api/admin/generate-all-meshes/route.ts` — admin batch backfill.
- **`publishProjectAction` / `publishEditorial` / the status route contain zero mesh-generation calls.** Verified in `src/app/actions/projects.ts:96-162` and `…/status/route.ts`.

### Deepgram + LiveKit + Cartesia — $0 today (not deployed)

- All in `services/interview-orchestration/` (Express microservice, port 3001): `services/deepgram.ts` (STT), `services/livekit.ts` (audio transport), `services/cartesia.ts` (TTS, `sonic-english`), `services/claude.ts` (turn model, `claude-sonnet-4-20250514`, max_tokens 1024; context summary 300 tokens at `context.ts:148`).
- **Not deployed.** `RealtimeInterviewView.tsx:337`: *"In production, you would connect to LiveKit here / For now, we'll simulate the connection and use polling."* Confirmed `tasks/INTERVIEW_SYSTEM_AUDIT_V2.md:318`.

### Resend (email) — fires on publish, kill-switched off

- `src/app/api/posting/project/[projectId]/status/route.ts:497` → `notifyTaggedVendors({projectId})` on transition to PUBLISHED (fire-and-forget).
- `src/lib/email/notifyVendorTagged.ts:132-225` loops vendors; **one email per tagged-vendor recipient** (existing vendors → every OWNER/ADMIN; else fallback vendor email), 24h per-vendor rate limit.
- Actual send gated by `VENDOR_TAGGED_EMAILS_ENABLED` (`notifyVendorTagged.ts:16`), **default false** → logs only.
- The other publish path, `publishEditorial()` (`src/app/actions/projects.ts:155`), calls `notifyIncompleteProductVendors` — **in-app notifications only, no email.**

### Browserless — not on publish path

- `src/lib/browserless/*` is used only by product import / vendor catalog scraping. Zero involvement in publish/interview/tagging of a project.

---

## 2. Claude call detail: model, caching, batch

- **Model:** `claude-sonnet-4-20250514` everywhere (one Haiku call at `generateEditorialDraft.ts:1129`). **No Opus** → nothing to downgrade. Pricing-equivalent to Sonnet 4.6 ($3 / $15 per MTok).
- **Prompt caching: NONE.** `grep -r cache_control` → 0 matches across the repo. Every call pays full input price on its (often large) system prompt + image context. This is the top cost lever.
- **Batch mode: NONE.** All calls are synchronous `messages.create`. The interview/editorial flow is interactive so batch is mostly inapplicable — but the per-room fan-out calls (room questions, narrative intros/materials across 5+ rooms) are independent and could be batched at 50% off if latency tolerances allowed.
- **`temperature: 0.7`** on the editorial draft (and similar elsewhere) — fine, just noted.
  - _Superseded: Sonnet 5 rejects `temperature`; all 29 occurrences were removed in the migration._
- **Deprecation risk:** `claude-sonnet-4-20250514` retires 2026-06-15. Recommend migrating to `claude-sonnet-4-6` regardless of this audit.
  - _Superseded (see `tasks/todo.md` Part 7): the repo now runs `claude-sonnet-5`. Same $3/$15 list rate, but Sonnet 5 tokenizes ~30% higher for the same text, so the per-project token estimates below read low — the shape of the analysis holds, the absolute numbers do not._

Estimated tokens per project (text flow, no caching, ~5-room project). Image-heavy calls dominate input because vision tokens (~1.6k/image on Sonnet 4) are re-sent uncached on every call that includes images:

| Bucket | Calls | Input tokens (est) | Output tokens (est) |
|--------|------:|-------------------:|--------------------:|
| Interview Q-gen (project + per-room + spatial) | ~7 | 35,000–60,000 | 8,000–12,000 |
| Brief + narrative (intros/transitions/materials) | ~16 | 25,000–45,000 | 8,000–12,000 |
| Answer analysis + follow-ups | ~10 | 15,000–25,000 | 4,000–6,000 |
| Editorial draft (main + splice) | 2 | 8,000–12,000 | 6,000–8,000 |
| **Sonnet subtotal** | **~35** | **~85k–140k** | **~26k–38k** |
| `fixOpeners` (Haiku) | 1 | ~1,000 | ~1,000 |

These are estimates — see §6. The whole reason for the recommendation below is that **this is currently unmeasured.**

---

## 3. The four numbers that dominate per-project cost

1. **fal.ai 3D generations per published project → 0 on the publish path.** It is lazy/on-demand: fire-and-forget on product create/image-update (`triggerMeshGeneration.ts:13`), or explicit per-tag / per-project button (`generate-3d-assets/route.ts`, deduped to unique products, skips existing meshes). Not hero-only, not per-tag-on-publish.
2. **Interview runs once per PROJECT.** All routes are keyed `…/project/[projectId]/interview/…`; question generation iterates the project's rooms. (Designer-level interviews are a separate bio flow under `src/lib/designer-bio/`.)
3. **Average interview duration:** **not logged in the production (text) flow** — there is no duration concept there. Duration *is* computed in the undeployed voice service (`services/interview-orchestration/src/conversation/manager.ts:463-519` → `totalDurationMs`, persisted to `RealtimeInterviewSession.durationMs`, `prisma/schema.prisma`). To instrument the text flow, stamp start at interview-session create and end at editorial-draft generation, or wrap each Claude call (see §6).
4. **Prompt caching on interview + editorial calls: NOT enabled** (none anywhere). Biggest single cost-reduction opportunity.

---

## 4. Storage growth per project (Supabase, $0.021/GB/mo)

Buckets: `event-images` (originals, WebP crops, 2D cutouts) and `product-meshes` (GLB meshes, SAM masks). Originals are **never deleted** when derivatives are made — storage is purely additive.

| Asset | Path | Qty (typical) | Avg size | Subtotal |
|-------|------|--------------:|---------:|---------:|
| Original images (EXIF-stripped, JPEG q90) | `{projectId}/{roomId}/generated/*` | ~20 | ~250 KB | ~5 MB |
| Product crops (WebP 600px, q85) | `crops/{projectId}/{tagId}.webp` | ~24 | ~40 KB | ~1 MB |
| 2D cutouts (PNG, SAM) | `{projectId}/cutouts/{productId}/*` | ~25 | ~80 KB | ~2 MB |
| SAM masks (PNG) | `{projectId}/masks/{tagId}/*` | ~24 | ~30 KB | ~0.7 MB |
| **Subtotal (no 3D)** | | | | **~9.6 MB** |
| 3D meshes (GLB, Trellis-2 ~8 MB) | `{projectId}/meshes/{productId}/*.glb` | ~16 | ~8 MB | **~128 MB** |
| **Total (with 3D)** | | | | **~145 MB** |

Notes: no image count cap; no responsive size variants (single 600px crop); no dedup of crops for the same product tagged across images; no lifecycle/archival policy. EXIF strip + processing at `src/lib/storage.ts:29-56`; crops at `src/lib/crops/generateProductCrop.ts`; mesh upload at `src/lib/storage.ts:227-256`.

Monthly storage cost is tiny per project (~$0.0002/mo without 3D, ~$0.003/mo with 3D) — but it accrues forever and the 3D path is ~15× the footprint.

---

## 5. Per-project cost table

Rates as given: Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5, Opus 4.8 $5/$25 (unused), fal.ai $0.02/gen, Deepgram $0.0077/min, LiveKit $0.011/min, Supabase $0.021/GB/mo. (Code's `claude-sonnet-4-20250514` priced as Sonnet-tier $3/$15.)

### Today (text interview, emails off, 3D not triggered) — the real number

| Component | Basis | Cost |
|-----------|-------|-----:|
| Claude Sonnet — input | ~110k tok × $3/M | ~$0.33 |
| Claude Sonnet — output | ~32k tok × $15/M | ~$0.48 |
| Claude Haiku (fixOpeners) | ~2k tok | ~$0.01 |
| OpenAI moderation | omni-moderation | ~$0.001 |
| fal.ai 3D | not triggered on publish | $0.00 |
| Deepgram / LiveKit | service not deployed | $0.00 |
| Resend | kill-switched off | $0.00 |
| Supabase storage (no 3D) | ~9.6 MB × $0.021/GB/mo | ~$0.0002/mo |
| **Per-project total** | | **~$0.80–$1.10** |

### Add-ons if the corresponding feature is exercised

| Scenario | Incremental cost |
|----------|-----------------:|
| User clicks "Generate 3D Assets" (~15 unique products × $0.02) | +$0.30 |
| Storage with 3D meshes retained | ~$0.003/mo (~$0.036/yr) |
| `VENDOR_TAGGED_EMAILS_ENABLED=true`, ~6 tagged vendors (Resend ~$0.001/email on paid tier) | +~$0.006 |
| **Voice interview deployed** (Deepgram + LiveKit only, ~15-min interview) | +~$0.28 (Deepgram $0.12 + LiveKit $0.17) **+ Cartesia TTS (no rate given) + ~$0.30 Claude per-turn** |

**Prompt-caching upside:** the bulk of Sonnet input is large stable system prompts + repeated image context re-sent across ~35 calls. Caching the stable prefixes plausibly cuts input cost 50–80% → roughly **$0.15–$0.30 off every project**, i.e. the per-project Claude bill drops toward ~$0.55–$0.75.

---

## 6. Smallest change to make cost a measured number

The estimates above span a ~40% range because nothing is instrumented. The minimal fix:

**Add a `CostEvent` log written at each paid call, keyed to `projectId`.**

1. **Schema:** one table —
   `CostEvent { id, projectId, provider, operation, model, inputTokens, outputTokens, units (e.g. minutes/generations/bytes), costUsdEstimate, createdAt }`.
2. **One wrapper per provider, not per call site:**
   - Claude: the codebase already funnels most calls through `callLLM` (`generateEditorialDraft.ts`) and direct `client.messages.create`. Wrap `client.messages.create` (or `callLLM`) so it reads `response.usage` (`input_tokens`, `output_tokens`, `cache_read_input_tokens`) and writes a `CostEvent`. `usage` is already returned — no extra API calls.
   - fal.ai: write a `CostEvent` (1 generation) in `sam3d-client.ts` on success.
   - Resend: write on send in `sendEmail.ts`.
   - Deepgram/LiveKit: write `durationMs`→minutes in `manager.ts` (already computed at line 463) if/when deployed.
3. **Thread `projectId`** through the LLM call context. The Claude calls already carry a `contextHint`/`correlationId` of the form `generate:${project.id}` — parse or pass `projectId` explicitly.
4. **Report:** `SELECT projectId, SUM(costUsdEstimate) FROM CostEvent GROUP BY projectId` turns "≈$0.80–$1.10, we think" into a measured per-project number, and immediately quantifies the caching win via the `cache_read_input_tokens` column.

This is ~1 table + ~4 small wrappers, no change to call sites' logic, and it makes every future estimate in this document obsolete in the right way.

---

## Appendix: things worth fixing that surfaced during the audit

- ~~**`claude-sonnet-4-20250514` retires 2026-06-15.** Migrate to `claude-sonnet-4-6` now — this is an availability cliff, not just cost.~~ **Done, and gone further:** the repo is on `claude-sonnet-5` (todo.md Part 7).
- **No prompt caching** — highest-leverage cost fix (§3.4, §5).
- **No interview-duration instrumentation in the live text flow** (§3.3).
- **3D + originals retention** is unbounded and additive (§4) — fine pre-launch, but a lifecycle policy will be needed.
