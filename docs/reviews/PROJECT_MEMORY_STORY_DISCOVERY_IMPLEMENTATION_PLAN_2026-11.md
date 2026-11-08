# Phase A/B — Project Memory and Story Discovery Implementation Plan

**Status:** Engineering plan for review; no schema or application changes authorized by this document. **Date:** 2026-11-08.
**Parent:** [Episode Data Contracts](LIVING_PROJECT_EPISODE_DATA_CONTRACTS_2026-11.md).

## Outcome and scope

Deliver the first private, source-grounded **Folio Story Opportunities** experience: the designer uploads existing project documentation; Folio detects an authentic event, change, or open issue; Folio proposes a compelling angle and one specific missing piece, with evidence and review controls. No episodes automatically publish. No automatic collaborator outreach. No new public project UI in this slice.

### Existing source adapters — concrete code anchors

| Adapter | Existing source and implementation | Phase A action |
| --- | --- | --- |
| Project access | `src/lib/authz/access.ts`, `assertProjectView` / `assertProjectWrite` | Resolve actor/workspace/project on **every** private read and mutation; restrict editorial proposals to owner/editor, not every participant |
| Project photographs | `ProjectImage` (`roomId`, `aiClassification`, `verifiedAttributes`, `createdAt`, inclusion) | Source ID, room, image, timestamp, verified/AI-inferred distinction; never infer event time from upload time without labeling |
| Project files | `ProjectFile` (`fileType`, `fileUrl`, `dateUploaded`) | Use existing extraction output if authorized; no uncontrolled external fetch or raw URL exposure |
| Project interviews | `EditorialInterviewAnswer` (`questionId`, `answerText`, `linkedImageId`, `roomId`, `audioUrl`, `wordTimings`) | Immutable answer identity via interview + question + follow-up key; citation to question and time span when available |
| Product/selection changes | `SelectionHistory` and `src/lib/design-journey.ts` | Treat `reasonCategory` as structured evidence, `reasonNotes` as attributed statement; do not turn inferred reasons into facts |
| Design decisions | `DesignerDecision` (`reasoning`, `tradeoffs`, `outcomeNotes`) | Link a change/issue to later outcome when evidence supports it |
| Existing studio story flow | `src/lib/publishing-studio/story-service.ts`, `activities.ts`, `generate-activity.ts` | **Do not loosen** current published-source public story rules; create a separate private discovery adapter |
| Existing editorial readiness | `src/lib/publishing-studio/readiness/service.ts` and `sources.ts` | Reuse source digest, readiness and deduplication patterns where possible; no expensive generation on page browse |
| Existing story angles | `StoryThread` and `docs/15_SUPER_ARTICLES.md` | Reuse scoring concepts as hints; never require three contributors for an opportunity |

### Proposed modules (names are provisional)

- `src/lib/project-memory/source-adapters.ts`: actor-scoped, bounded retrieval of typed references; outputs no public URLs.
- `src/lib/project-memory/evidence.ts`: normalize source refs, attribution, timestamps, digest and confidence.
- `src/lib/project-memory/events.ts`: deterministic extraction of candidate changes/issues/resolutions; private-only.
- `src/lib/project-memory/story-opportunities.ts`: propose narrative angle, supporting citations, unresolved question and suggested footage; source grounded.
- `src/lib/project-memory/review.ts`: dismiss, revise, save, approve-for-episode-draft actions with optimistic concurrency.
- `src/app/api/projects/[id]/story-opportunities/route.ts`: authenticated project-scoped GET/POST only; no anonymous reads.
- `src/components/publishing-studio/ProjectStoryOpportunities.tsx`: source-backed card with evidence, one next action and a clear 'suggestion' status.

**Persistence decision:** Start with read-only adapters and deterministic in-memory evaluation fixtures. After confirming opportunity behavior, introduce minimal persisted private opportunity snapshots and provenance links with additive migrations; do not prematurely persist an entire universal event graph or reuse `ProjectModule` as private memory. A new table is justified only when saved/dismissed/review state cannot be reliably represented in the existing studio store.

## Delivery increments

### A0 — security and observability gates
- Confirm PR #851 is deployed and add a database-backed negative test for private project with published module.
- Verify `ProjectFile`/image/interview authorization paths and source extraction failure reporting.
- Define explicit access matrix: owner/editor vs viewer/participant/vendor vs anonymous; test all.
- Require bounded source retrieval and no private source in public serializer.

### A1 — source-aware private project digest
- Read one authorized project with source adapters and produce a typed, source-linked digest.
- Include dates, room, contributor, original vs inferred claims, and source snapshot hash.
- Missing extraction must surface a diagnostic; never silently claim complete understanding.

### B1 — opportunity discovery, no publishing
- Detect meaningful event sequences: expected→changed, issue→resolution, selection swap, craftsmanship breakthrough, or open question.
- Generate at most three **distinct** high-confidence opportunities per explicit refresh; avoid generic engagement bait.
- Each opportunity has a thesis, 2+ source citations when available (one source allowed if substantial), confidence, what is unknown, and one precise follow-up assignment.
- Never fabricate quotes, timelines, blame, causes or resolutions.
- Separate draft suggestions from actual published stories and current Studio publication candidates.

### B2 — review and saved work
- Designer can dismiss, save, revise, or request clarification. Save revisions and source digests.
- On source change, flag stale suggestion rather than silently overwrite saved edits.
- The output of this phase is **an editorial opportunity**, not an approved episode.

### C handoff — only after B is validated
- Map accepted opportunity into a versioned, media-native episode draft.
- Preserve approval and rights boundaries. Do not publish or change anchor automatically.
- Keep `ProjectPost` primary editorial untouched.

## Evaluation fixtures

1. **Stone delay:** Original installation schedule, delayed delivery evidence, builder resolution; suggestion must cite evidence and ask only the missing follow-up.
2. **Wrong toilet location:** Designer note and later corrected plan; do not assign blame, name a party, or call it resolved unless supported.
3. **Quiet project:** Beautiful design choices with no drama; suggest an insightful craftsmanship/decision story, not invented tension.
4. **Sparse project:** One image, no interview; ask one useful question rather than inventing an episode.
5. **Contradictory accounts:** Designer and builder disagree; attribute each claim and flag uncertainty.
6. **Private material:** Published parent with private source or unpublished parent; no raw private source in public API.
7. **Stale evidence:** Source changed after opportunity saved; preserve edits and mark stale.
8. **Vendor claim:** Free factual correction does not auto-publish, auto-invite or grant image rights.
9. **Noisy media dump:** Repeated photos and irrelevant footage dedupe, with no false story claims.
10. **Multi-room project:** An event from one room cannot be misattributed to another.

## Test commands and gates (proposed)

- Add `scripts/check-project-memory-source-adapters.cjs`: deterministic adapters, permission matrix and source timestamps.
- Add `scripts/check-story-opportunity-evidence.cjs`: ten fixtures, source citations, no fabricated claims, stale source and bounded results.
- Add disposable PostgreSQL integration coverage for saved opportunities, project isolation and concurrent review.
- Run `node scripts/check-public-module-feed-visibility.cjs`, existing Studio story/readiness checks, TypeScript, lint and build.
- Test project owner, firm editor, participant, vendor and anonymous against both direct API calls and public serializers.
- Visual browser review on mobile and desktop with 0/1/3 suggestions; no fake “ready to publish” labels.

## Go/no-go criteria

- **Security:** zero unauthorized source exposure in negative tests.
- **Evidence:** every factual assertion points to eligible source evidence; uncertain inferences visibly labeled.
- **Editorial value:** a reviewer can explain why the suggested storyline matters and what exact material is missing.
- **Effort:** no mandatory manual tagging of every source and no generic multi-question interview before showing value.
- **Reliability:** extraction failures and source gaps are visible and actionable; saved work survives refresh.
- **No regressions:** existing project publication, Spotlight consent, Studio story revision and feed paths continue to pass.

## Deliberate exclusions

No automatic video assembly, public episode release, story rings, viewing progress, collaborator invitations, paid placements, vendor catalog imports, or new advertising analytics in this initial slice.

## Review checkpoint

The first engineering change should be **A0/A1 only**: permissioned source adapters and a private digest with tests. Once evaluated against real but appropriately authorized projects, determine the smallest persistence migration for B1/B2. This sequencing prevents speculative schema sprawl and keeps the founder's promised low-effort experience central.
