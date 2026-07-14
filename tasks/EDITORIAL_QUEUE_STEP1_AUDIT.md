# Editorial Queue — Step 1 Read-Only Audit

Per `docs/17_EDITORIAL_QUEUE.md` Implementation Sequence, step 1. No code changes
in this step. Audited 2026-07-13 on `claude/editorial-queue-design-f6sni1`
(in sync with `origin/main` at b0d0574e).

## Reuse points named in the spec — confirmed

### Editorial scheduler (`src/lib/editorial/scheduler.ts`)

Confirmed edition-scoped threshold publishing, exactly as the spec characterizes
it: `runEditorialEditionScheduler()` iterates unpublished `EditorialEdition`
drafts, gathers `EditorialAssignment` rows above
`EDITORIAL_CURATOR_THRESHOLDS.editionPublishScore`, and publishes editions that
clear the threshold. It is **already on Anthropic** via `MODELS.sonnet`
(`generateEditionCopy`). The Publishing Calendar (Component 4) must be a new
job — this scheduler has no concept of per-designer feed slots, format spacing,
or region mixing. **Leave untouched, as specced.**

### EditorialDraft pipeline (`src/lib/editorial/getOrCreateEditorialDraft.ts`)

Confirmed the completed-piece → `ProjectPost` path exists and is the right
landing zone. The pipeline reads `ProjectPost.expandedBlocks` /
`EditorialDraft.rawState`, generates via
`src/lib/posting/generateEditorialDraft.ts` (Anthropic, `MODELS.sonnet` +
`MODELS.haiku`), and persists drafts with `status: 'draft'` (never
auto-publishes, per docs/08_AI_ROLE.md guardrail). Queue pieces that complete
into a `ProjectPost` inherit this path with no bridge code, which is the point
of extending `PostVariant` instead of a new enum.

### InterviewModal flow

`src/components/posting/interview/InterviewModal.tsx` +
`src/hooks/useRoomInterviewFlow.ts` are the single input surface. Answers land
in `EditorialInterviewAnswer` via the posting interview routes. The queue's
completion flow (step 8, later session) should reuse this surface rather than
invent a second answer-capture path.

### `EditorialInterviewAnswer` storage (schema.prisma:1811)

Rich enough for the digest raw layer as-is: `questionText`, `answerText`,
`questionSource` ('base_question' | 'ai_classification' | 'follow_up' |
'project_question' | 'project_follow_up'), `roomId`, `linkedImageId`,
`linkedProductId`, `isFollowUp`/`parentAnswerId` threading, `createdAt`.
Answers are never discarded (per 15_SUPER_ARTICLES), so the digest can read
the full history. No schema change needed for the raw layer.

### `MODELS` constants (`src/lib/ai/models.ts`)

`{ sonnet, haiku, opus }`. Both new Anthropic calls (angle extraction, prompt
generation) plug in here. Confirmed every existing editorial Claude call
imports from this module.

### OpenAI call sites

Six files import OpenAI:

| File | Usage | Editorial generation? |
|---|---|---|
| `src/app/api/interviews/[id]/process/route.ts` | Whisper transcription (OpenAI) + generation (**already Anthropic**, MODELS.sonnet) | No |
| `src/app/api/posting/project/[projectId]/interview/transcribe/route.ts` | Whisper transcription | No |
| `src/lib/posting/moderation.ts` | Moderation endpoint | No |
| `src/lib/ai/embeddings.ts` | Embeddings | No |
| `src/lib/ai/imageGen.ts` | Image generation | No |
| `src/app/api/posting/_debug/status/route.ts` | Debug/status check | No |

**Finding: spec step 10 (OpenAI → Anthropic switch for editorial generation)
is already done.** `generateEditorialDraft.ts` and the scheduler are Anthropic.
Remaining OpenAI usage is transcription/moderation/embeddings/image-gen, none
of which are "editorial generation" and none of which have direct Anthropic
equivalents. Recommend marking step 10 complete-as-found; no code change
needed there.

## Schema recon (for migrations 1–3)

- **`PostVariant` (schema.prisma:1575):** current values `PROJECT_FEATURE`,
  `MATERIAL_STUDY`, `METHOD`, `DESIGNER_PROFILE`, `EVENT_ESSAY`, plus
  `PROMPTED_ARTICLE` (added by 18_PROMPTED_CONTENT_SYSTEM; the queue spec's
  "existing values" list predates it — no conflict). `QA`, `THIS_OR_THAT`,
  `GET_TO_KNOW` do not exist. `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is the
  established pattern (see 20260624120000_add_atelier_signal_source_type_values).
- **`DesignerAngle` / `EditorialQueueItem`:** no trace in schema.prisma, src/,
  or migrations. Clean ADD, no Bucket A/B restoration concerns.
- **`ImageSource` (schema.prisma:669):** exactly the four values the provenance
  gate names. Gate is enforceable at digest/distribution query time (step 5+).
- **`ProjectStage` (schema.prisma:1450):** exists; usable in the digest raw
  layer where present.
- **Save data:** `Save` (schema.prisma:4275) is **product-level**
  (`userId`+`productId`, no imageId); `PostSave` (schema.prisma:6152) is
  post-level. The spec's "save counts per image" has no direct table — the
  digest builder (step 5) must derive image-level save signal via
  Save.productId → product tags → images, or defer save-delta until an
  image-level engagement source exists. Consistent with the Maturity Ladder
  gating save-delta on "engagement data present". Digest-builder concern, not
  a migration concern.
- **Not modified, confirmed present:** `TrendInterviewRequest`
  (schema.prisma:4470), `InterviewSession` (schema.prisma:6931),
  `EditorialDraft` (schema.prisma:7421), daily scheduler (above).
- **Three-story gate:** `ProjectPost.status` is `PostStatus` with `PUBLISHED`;
  the gate is a simple `count where status = PUBLISHED` per designer via
  `project.designerId`. No schema needed, as specced.

## House migration conventions applied to migrations 1–3

- Timestamped folders, header comment stating rationale + idempotency.
- Enum adds: `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- Tables: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FKs in
  `DO $$ ... EXCEPTION WHEN duplicate_object` blocks (pattern:
  20260624120100_create_vendor_rep_contacts,
  20260709163000_add_pdf_extractions_skeleton_items).
- New tables use snake_case `@@map` with camelCase columns (no per-field
  `@map`), matching every recent model. The spec's Prisma block gets
  `@@map("designer_angles")` / `@@map("editorial_queue_items")` added;
  otherwise verbatim. Per the spec, `designerId`/`organizationId` are plain
  strings (no User/Organization relation), which avoids touching the User
  model — the only FK is `EditorialQueueItem.angleId → designer_angles.id`.
- `phase5e-check-plan.mjs --ci` passes at baseline before this work
  (looseSql=32/32, phantom=0, missingSql=0, nonIdempotent=0) and must pass
  after.

## Apply status

The three migrations in this branch are **authored, not applied**. No database
was touched in this session. Applying to prod (`prisma migrate deploy` or
apply + `migrate resolve`) and `prisma migrate status` verification remain
gated on founder approval per CLAUDE.md migration discipline.
