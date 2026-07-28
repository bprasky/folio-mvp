# Consolidation Kill-List — Phase 0 Discovery (READ-ONLY)

**Nothing was modified or deleted.** This is the evidence gate that authorizes the
destructive phases of the Interview-Prompt Consolidation playbook. Every classification is
grounded in a `file:line` or an import/call chain. Source of truth for the target end-state
is `docs/17_INTERVIEW_PROMPT_CANON.md`.

Deletion authorization: only items on the **SAFE TO DELETE** list (§4) are cleared for
removal, and each must be re-verified immediately before removal. Everything on **MUST
REWIRE / DO NOT DELETE** stays.

> **Read §0 first — it corrects three assumptions baked into the playbook and canon doc.**

---

## 0. Corrections to playbook / canon assumptions (act on these before Phases 2-5)

1. **`validateAIQuestion` is dead code, not a live gate.** Canon `17 §3` and playbook
   Phase 3 describe "moving the `validateAIQuestion` gate from a keyword ban to an intent
   check." But that gate is only called inside the dead template path
   (`generateQuestions.ts:1152`, reachable only from the callerless
   `generateInterviewQuestions()`). **The live per-room posting path runs no such gate at
   all.** Consequence: the intent-check validator in the new `rules.ts` is **net-new code
   that must be wired into the live generators** (`generateRoomQuestions`,
   `generateProjectQuestions`, and the follow-up routes) — not a refactor of an existing
   live gate. The old `validateAIQuestion` should be deleted with the rest of the dead
   cluster, not "converted."

2. **The `generate-draft` "slightly polished quotes" conflict is in dead code.** The
   audit's SOFT conflict #7 (I4, `api/interview/generate-draft`) has **zero fetch sites**.
   It should be **deleted**, not reconciled — Phase 5's verbatim-quote fix does not need to
   touch it.

3. **Two of the "seven question generators" are dead.** `buildInterviewBrief.ts` and the
   `generateQuestions.ts` template bank (`LEVEL_0..5` + `generateInterviewQuestions`) are
   both CONFIRMED-DEAD. They should be **deleted in Phase 4, not routed through the module**
   — the consolidation target shrinks accordingly.

---

## 1. GROK REMOVAL MAP

The Grok/x.ai integration is a **raw `fetch`**, no SDK, no client wrapper. `package.json`
has zero grok/x.ai/xai dependencies.

### 1a. The chat feature core
| File | Role | Evidence |
|------|------|----------|
| `src/app/api/vendor-analytics/chat/route.ts` | The only x.ai caller | `fetch("https://api.x.ai/v1/chat/completions")` `:156`; model `"grok-2-1212"` `:163`; `Bearer ${process.env.XAI_API_KEY}` `:160`; key-guard `:136-140` |
| `src/lib/folioGrokSystemPrompt.ts` | Grok system prompt (`FOLIO_GROK_SYSTEM_PROMPT`) | Single export `:3`; **only importer** is `chat/route.ts:24` |
| `src/lib/vendorIntentInterceptor.ts` | Intent classifier for the chat | Only importer `chat/route.ts:19-23`; called only at `chat/route.ts:107` |
| `src/lib/folioVendorCapabilities.ts` (`folioVendorActions`) | Action catalog | Importers: `chat/route.ts:13` + `DynamicInsightPanel.tsx:7` (both chat) |

### 1b. UI mount points (chat reached via exactly one live path)
- `src/app/vendor/dashboard/page.tsx:161` renders `<VendorAnalyticsDashboard/>`.
- `src/components/vendor/VendorAnalyticsDashboard.tsx:52-62` mounts `<DynamicInsightPanel>`
  **only after `hasConversation` is true** (the chat sub-panel).
- `src/components/vendor/DynamicInsightPanel.tsx:78` — the live `fetch("/api/vendor-analytics/chat")`.
- **Orphan chat consumers** (never imported/mounted; dead already):
  `PinnedInsightCard.tsx:41` (fetches the chat endpoint), `StrategyModeOverlay.tsx:70`
  (mounts `DynamicInsightPanel`).

### 1c. Model / env / package refs
- `grok` / `x.ai` / `xai` / `grok-2-1212`: confined to `chat/route.ts` and
  `folioGrokSystemPrompt.ts`. Cosmetic "Powered by Grok-4" labels (not logic):
  `CreateDiscoveryLunchModal.tsx:275`, `CreateAppreciationDinnerModal.tsx:275`.
- `XAI_API_KEY`: only `chat/route.ts:136,160`. **Not** in `.env.example`. No `GROK_API_KEY`.
- No package dependency to remove.

### 1d. Shared-vs-exclusive (the part that prevents collateral breakage)

**GROK-EXCLUSIVE — safe to delete:**
- `src/lib/folioGrokSystemPrompt.ts` (only `chat/route.ts` imports it)
- `src/lib/vendorIntentInterceptor.ts` (only `chat/route.ts`)
- `src/app/api/vendor-analytics/chat/` (the whole route)
- `src/components/vendor/DynamicInsightPanel.tsx` (the chat panel) — requires **editing**
  `VendorAnalyticsDashboard.tsx` to remove import `:7` and the `hasConversation` block `:52-62`
- `src/lib/folioVendorCapabilities.ts` — deletable **only if** `DynamicInsightPanel` also goes
- `XAI_API_KEY` env var (revoke the secret; no `.env.example` line to remove)

**SHARED — DO NOT delete (non-chat consumers named):**
- `src/lib/vendorAnalyticsMock.ts` — 10+ non-chat importers (insight cards, dashboard,
  `vendorInsights.ts:1`, vendor-action routes)
- `src/lib/vendorAnalyticsDemoState.ts` — `VendorAnalyticsDashboard.tsx:5`,
  `AnalyticsDemoControls.tsx:3`, `WhatIfControls.tsx:3`
- `src/lib/vendorAnalyticsVisualization.ts` — `AnalyticsVisualization.tsx:3`,
  `vendorInsights.ts:2`, `PinnedInsightCard.tsx:5`
- `src/components/vendor/VendorAnalyticsDashboard.tsx` — **the live dashboard; edit, don't
  delete.** Non-chat parts stay: header `:26-35`, `AnalyticsQuestionHero` `:39`, insight
  cards `:45-47`. Only the chat block `:52-62` + import `:7` are removed.
- `src/components/vendor/actions/CreateAppreciationDinnerModal.tsx` — also mounted by
  non-chat `EventsThatMovedMetalCard.tsx:5,115` and `TopEngagedDesignersCard.tsx:5,115`;
  separate backend `api/vendor-actions/create-appreciation-dinner/route.ts`

**UNCERTAIN — resolve scope before deleting:**
- `src/components/vendor/AnalyticsVisualization.tsx` + `folioVendorCapabilities.ts`:
  consumers are chat code + the **orphan** `PinnedInsightCard`. Deletable **iff** you also
  remove the chat panel AND the orphan `PinnedInsightCard`. If `PinnedInsightCard` stays,
  `AnalyticsVisualization` stays.
- `src/components/vendor/actions/CreateDiscoveryLunchModal.tsx` + its backend
  `api/vendor-actions/create-discovery-lunch/route.ts`: grep shows **only**
  `DynamicInsightPanel` imports the modal, so killing the chat panel would orphan the
  discovery-lunch flow entirely. **Decision needed:** should the discovery-lunch action
  survive independently of chat? Today it is reachable only through chat action buttons.

**Note (out of scope for the Grok kill, but adjacent dead code):** `StrategyModeOverlay`,
`PinnedInsightCard`, `QuickInsightsGrid`, `WhatIfControls`, `AnalyticsDemoControls`,
`DesignerProductMap` are all orphans (no importers). A separate dead-code sweep, not part
of this kill-list.

---

## 2. DEAD-CODE PROOF — suspected-legacy interview surfaces

**Live posting question path (cross-check):** `getInterviewQuestions.ts:12-14` imports
`generateAllRoomQuestions` + `generateProjectQuestions` (and only the *type*
`GeneratedQuestion`); calls them at `:70,169,425,440`. It does **not** import/call
`generateInterviewQuestions` or `buildInterviewBrief`. Both live entry routes
(`/api/interview/start/route.ts:104-105`,
`/api/posting/project/[projectId]/interview/questions/route.ts:6,49,56`) flow through this
file. → The template bank and brief generator are off the live path.

### Target A — the second interview surface (`InterviewFlow` + `/api/interview/*`)
Render chain: `InterviewFlow` imported only at `StoryPanel.tsx:9` (barrel
`components/interview/index.ts:2`), rendered only at `StoryPanel.tsx:613` inside
`showInterviewModal` (`:606`), opened from a button gated `isOwner && POSTING_V1_ENABLED`
(`StoryPanel.tsx:413`, flag `:49` = `NEXT_PUBLIC_POSTING_V1 === "true"`). `StoryPanel`
itself ships un-flagged (`project/[id]/page.tsx:430`). The *primary* un-flagged interview
button routes to the posting `InterviewModal`, not `InterviewFlow` (`StoryPanel.tsx:352-364`).

| Item | Reachability | Verdict |
|------|-------------|---------|
| `components/interview/InterviewFlow.tsx` | rendered only behind `NEXT_PUBLIC_POSTING_V1` | **UNCERTAIN (flag-gated live)** |
| `components/interview/hooks/useInterviewSession.ts` | only `InterviewFlow` consumes it | **UNCERTAIN** |
| `api/interview/start/route.ts` | fetched at `useInterviewSession.ts:156` | **UNCERTAIN** |
| `api/interview/respond/route.ts` (prompts I1/I2/I3) | fetched at `useInterviewSession.ts:222` | **UNCERTAIN** |
| `api/interview/generate-draft/route.ts` (prompt I4) | **zero fetch sites repo-wide** | **CONFIRMED-DEAD** |
| `api/interview/realtime/session/route.ts` | fetched at `RealtimeInterviewView.tsx:93` ← `InterviewModal.tsx:2197` | **LIVE — do not touch** |
| `api/interview/realtime/convert/route.ts` | fetched at `InterviewModal.tsx:2203` | **LIVE — do not touch** |

**Correction:** the realtime routes belong to the **live posting `InterviewModal`**
(rendered from `MediaSection.tsx:548`, un-flagged; backed by
`prisma.realtimeInterviewSession`; gated by the separate realtime flags `flags.ts:11,19`),
**not** the dead `InterviewFlow` surface.

**The four UNCERTAIN items are one self-contained surface** — `StoryPanel` (flag-on) →
`InterviewFlow` → `useInterviewSession` → `/api/interview/start` + `/api/interview/respond`.
If `NEXT_PUBLIC_POSTING_V1` is permanently `false` in prod, the whole surface collapses to
CONFIRMED-DEAD together. That proof is an **env/deploy fact not in the repo** → **OPEN
QUESTION for the operator** (see §5). Until proven off, they stay (conservative rule).

### Target B — `src/lib/interview/buildInterviewBrief.ts`
Only runtime export `buildInterviewBrief` (`:157`). Importers: `generateQuestions.ts:21` and
the **unused** re-export `index.ts:136-148` (no file imports it from the barrel). Only call
site `generateQuestions.ts:1139`, inside the callerless `generateInterviewQuestions()`.
→ **CONFIRMED-DEAD** (transitively). Deleting it also requires removing the import at
`generateQuestions.ts:21` and the re-export block at `index.ts:136-148`.

### Target C — `src/lib/interview/generateQuestions.ts` (MIXED — split, don't delete the file)
**LIVE (keep):**
- `toInterviewQuestion` (`:1290`) — called by the live path at `getInterviewQuestions.ts:76,194,245`.
- `HOOK_OPENER_ID_PREFIX` / `HOOK_FOLLOWUP_ID_PREFIX` (`:49,55`) — imported by
  `api/interview/respond/route.ts:10` **and** the live `generateEditorialDraft.ts:7`.
- Types `GeneratedQuestion` / `QuestionType` / `GenerateQuestionsOptions` — type-imported by
  `generateRoomQuestions.ts:11`, `generateProjectQuestions.ts:18`, `answerAnalysis.ts:11`,
  `generateAllRoomQuestions.ts:12`, `getInterviewQuestions.ts:14`.

**CONFIRMED-DEAD cluster (excise):** `generateInterviewQuestions` (`:1117`, not re-exported;
`index.ts:60` comment says it's replaced by per-room generation), `generateContextualOpener`
(`:195`), `generateProspectiveQuestions` (`:237`), `validateAIQuestion` (`:1067`), the
`LEVEL_0..5` template bank, and the `buildInterviewBrief` import/call (`:21,1139`).
*(The `logAttributeVerification.ts:2` import of `generateInterviewQuestions` resolves to a
**different** file, `src/lib/editorial/generateInterviewQuestions.ts` — not this one.)*

> **Adjacent note:** `src/lib/editorial/generateInterviewQuestions.ts`
> (`generateContextualQuestions`, deterministic attribute-verification questions) has only a
> **type-only** importer (`logAttributeVerification.ts:2`). Likely legacy; classify in a
> follow-up trace before Phase 4 touches it. Not confirmed here.

---

## 3. CONSOLIDATION TARGET LIST

Every file that currently declares its own interviewer persona, tone-rule block, arrivals
rule, or banned-phrase list, and what it composes from the `src/lib/interview/prompts/`
module (`17 §6`) once consolidated. **Dead targets are struck from consolidation — they get
deleted in Phase 4 instead.**

### Question generators
| File | Declares today | Imports after consolidation |
|------|----------------|-----------------------------|
| `src/lib/interview/generateProjectQuestions.ts` | persona + rules + 6 role blocks (incl. `HOMEOWNER`, `BUILDER`) | `persona` + `rules` + `roles/{designer,architect,contractor,vendor}` |
| `src/lib/interview/generateRoomQuestions.ts` | persona ("interviewing a designer") + rules | `persona` + `rules` + `roles/*` (generalize beyond designer) |
| `src/lib/designer-bio/questions.ts` (+ `qa-generation.ts`) | persona + rules + `BUILDER` role Q's | `persona` + `rules` + `roles/{designer,architect,contractor}` |
| `src/lib/prompted-content/generateQuestions.ts` | persona + rules (peer-framing/trend techniques) | `persona` + `rules` |
| `src/lib/collaboration/questions/round1.ts` / `generateRound2.ts` / `generateRound3.ts` | persona + rules + vendor/designer framing | `persona` + `rules` + `roles/{vendor,designer}` (also Phase 6 rewrite) |
| `src/lib/editorial-queue/generatePrompts.ts` | persona + rules | `persona` + `rules` |
| ~~`src/lib/interview/buildInterviewBrief.ts`~~ | persona + own rule block | **DELETE (dead) — do not consolidate** |
| ~~`generateQuestions.ts` template cluster~~ | own rules + `validateAIQuestion` gate | **DELETE cluster (dead); new intent-gate lives in `rules.ts`** |

### Follow-up generators
| File | Declares today | After consolidation |
|------|----------------|---------------------|
| `.../interview/followups/route.ts` | arrivals-only rule | `rules` (arrivals/contrast policy) |
| `.../interview/followups/single/route.ts` | arrivals-only rule | `rules` |
| `.../interview/followups/batch/route.ts` | **chases rejections/emotion (contradicts the others)** | `rules` — reconcile to the one §3 policy |
| `src/lib/collaboration/questions/generateRound2.ts` | own follow-up rules | `rules` |
| `src/lib/designer-bio/questions.ts` (`generateFollowUpQuestions`) | own follow-up rules | `rules` |
| `api/interview/respond/route.ts` (I1/I2) | own follow-up + hook rules | **UNCERTAIN surface** — `rules` if kept; delete if `POSTING_V1` proven off |

### Editorial generators (Phase 5 targets)
| File | Declares today | After consolidation |
|------|----------------|---------------------|
| `src/lib/posting/generateEditorialDraft.ts` | **defines `FOLIO_TONE` (`:14`) + the canonical banned-phrase list** | becomes `editorialTone.ts` (extract `FOLIO_TONE` + banned list here) |
| `.../sections/[chapterIndex]/regenerate/route.ts` | imports `FOLIO_TONE` (`:11`) **but also has its own inline banned list** (`:16-28`) | import both from `editorialTone.ts`; drop inline copy |
| `.../interview/generate/route.ts` | **retained reference copy** of the E1 system prompt + banned list (`:205-264`, unused per prior audit) | remove the dead reference copy |
| `src/lib/interview/narrativeGeneration.ts` | own persona, **no grounding guardrail** | `persona` + `editorialTone` + add the grounding guardrail |
| `src/lib/collaboration/narrative/assembleStory.ts` | own persona ("find the emotional core") | `persona` + `editorialTone` + grounding guardrail (Phase 6) |
| ~~`api/interview/generate-draft/route.ts` (I4)~~ | "slightly polished" quotes | **DELETE (dead) — do not reconcile** |
| `api/interview/respond/route.ts` (I3 preview draft) | own editorial rules | **UNCERTAIN surface** — same fate as Target A |

**Banned-phrase list — actual duplication sites** (to collapse into one `editorialTone.ts`):
`generateEditorialDraft.ts` (canonical), the retained reference copy in
`interview/generate/route.ts`, and the inline copy in `sections/regenerate/route.ts`.
*(The other `grep` hits — `generateQuestions.ts`, `editorial/generateInterviewQuestions.ts`,
`get-designer-profile/route.ts` — are **not** duplication sites: the first two contain the
banned phrases inside template question copy, and `get-designer-profile/route.ts:40` is
**mock profile data** — a fake bio that ironically uses the very clichés the list bans.)*

---

## 4. AUTHORIZED LISTS

### SAFE TO DELETE (confirmed-dead; re-verify immediately before removing)
1. `src/app/api/interview/generate-draft/route.ts` — zero fetchers (kills conflict I4/#7).
2. `src/lib/interview/buildInterviewBrief.ts` — + remove import `generateQuestions.ts:21`
   and re-export `index.ts:136-148`.
3. **Template-bank cluster inside** `src/lib/interview/generateQuestions.ts` —
   `generateInterviewQuestions` (`:1117`), `generateContextualOpener` (`:195`),
   `generateProspectiveQuestions` (`:237`), `validateAIQuestion` (`:1067`), `LEVEL_0..5`.
   **Keep the file** (`toInterviewQuestion`, `HOOK_*_PREFIX`, type declarations are live).
4. **Grok chat (Phase 2):** `src/lib/folioGrokSystemPrompt.ts`,
   `src/lib/vendorIntentInterceptor.ts`, `src/app/api/vendor-analytics/chat/`,
   `src/components/vendor/DynamicInsightPanel.tsx` (+ edit `VendorAnalyticsDashboard.tsx:7,52-62`),
   `src/lib/folioVendorCapabilities.ts` (only once `DynamicInsightPanel` is gone), and the
   `XAI_API_KEY` secret.

### MUST REWIRE / DO NOT DELETE
- **Grok-shared vendor-analytics infra:** `vendorAnalyticsMock.ts`,
  `vendorAnalyticsDemoState.ts`, `vendorAnalyticsVisualization.ts`,
  `VendorAnalyticsDashboard.tsx` (edit only), `CreateAppreciationDinnerModal.tsx`.
- **Live interview code:** the realtime routes (`api/interview/realtime/*`), the posting
  `InterviewModal`, and `generateQuestions.ts` as a file (via the live exports above).
- **Consolidation (not deletion):** every non-struck file in §3.

### DECISIONS REQUIRED BEFORE ACTING (see §5)
- `NEXT_PUBLIC_POSTING_V1` prod value → fate of the whole `InterviewFlow` surface.
- Grok UNCERTAIN edges: `AnalyticsVisualization.tsx` / `folioVendorCapabilities.ts` (tied to
  orphan `PinnedInsightCard`), and `CreateDiscoveryLunchModal.tsx` + its backend route
  (chat-only reachability).

---

## 5. OPEN QUESTIONS (env/product facts not in the repo)
1. **Is `NEXT_PUBLIC_POSTING_V1` permanently `false` in production?** If yes, the four
   UNCERTAIN interview-surface items become CONFIRMED-DEAD and can be deleted with the Grok
   work instead of rewired. If it's on (or per-environment), they must be rewired through the
   module. This single fact decides delete-vs-rewire for I1/I2/I3, `InterviewFlow`,
   `useInterviewSession`, `/api/interview/start`, `/api/interview/respond`.
2. **Should the discovery-lunch action survive independently of the Grok chat?** It is
   currently reachable only via the chat panel; killing chat orphans
   `CreateDiscoveryLunchModal.tsx` + `api/vendor-actions/create-discovery-lunch/route.ts`.
3. **Scope for the vendor orphans** (`PinnedInsightCard`, `StrategyModeOverlay`,
   `QuickInsightsGrid`, `WhatIfControls`, `AnalyticsDemoControls`, `DesignerProductMap`):
   fold into this pass, or leave for a separate dead-code sweep? Their status affects whether
   `AnalyticsVisualization.tsx` / `folioVendorCapabilities.ts` become deletable.

**Stop here — no changes made.** The SAFE TO DELETE list (§4) is what Phases 2 and 4 are
authorized to remove, pending the §5 decisions for the UNCERTAIN items.
