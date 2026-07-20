# Interview & Elicitation Prompt Audit

**Read-only audit.** No prompt or code was modified. Every claim is grounded in a
`file:line` reference or a canon doc. Where I could not resolve something, it is
listed as an **OPEN QUESTION** rather than decided.

**Purpose:** map every user-facing interview/question and LLM prompt across the
designer / architect / contractor / vendor tracks, welcome-back micro-questions,
import agent, and editorial/moodboard generation; judge each against Folio canon;
and surface where the proposed elicitation techniques would **conflict with** or
**duplicate** an existing prompt — so we do not add conflicting or redundant prompts.

---

## STEP 0 — DISCOVERY (what was found)

### Canon located (authority order per `docs/08_AI_ROLE.md:74-80`)
All canonical docs are present under `/docs`:
- `docs/00_CONSTITUTION.md`, `docs/02_NON_NEGOTIABLES.md`, `docs/03_REJECTED_IDEAS.md`
- `docs/08_AI_ROLE.md` (AI suggests, never asserts; must not invent facts/credentials/product details)
- `docs/09_LANGUAGE_AND_TASTE.md` (calm/precise/non-hyped; observational not promotional; work not personality; canonical terms; no manufactured narrative)
- `docs/15_SUPER_ARTICLES.md` (Architect/Contractor/Vendor tracks; interview prompt architecture)
- `docs/16_ATTRIBUTION_CONSENT.md` (cross-party data/quote consent)
- `docs/12_INTELLIGENCE_SYSTEM.md` (welcome-back, supplemental quotes, trend interviews, vendor content)
- `docs/13_IMPORT_AGENT_SPEC.md` (`IMPORT_AGENT_SYSTEM` spec)

A prior related audit exists: `docs/audits/INTERVIEW_AUDIT.md` (posting-interview
flow mechanics + verbatim prompts). This document is complementary and focuses on
**canon compliance and cross-prompt conflict/duplication** across *all* surfaces.

### Prompt surfaces located
Seven+ **distinct** interview/question generators, four+ **distinct** editorial
generators, plus import/classification prompts. Full inventory in §1. The headline
discovery is **fragmentation**: there is no single canonical home for interview
prompts — the same "senior editorial journalist / interviewer" persona and its
rules are re-implemented independently in at least seven places, and they have
already drifted apart (see §3).

> **Note on canon-embedded example prompts.** `docs/12_INTELLIGENCE_SYSTEM.md` and
> `docs/15_SUPER_ARTICLES.md` contain *illustrative* prompt snippets (e.g. the
> trend-article prompt "Opening hook about the trend … Tone: Editorial, like
> Architectural Digest", `12:933-949`; contractor examples `15:56-60`). These are
> spec illustrations, not live code. They are noted where relevant but the audit
> verdicts below target **shipping code**.

---

## 1. INVENTORY TABLE

Legend — **SSOT?**: *single* = only definition of its kind; *dup* = one of several
overlapping implementations. **Live?**: *live* = wired to a shipping route/UI;
*parallel/legacy?* = present but wiring unconfirmed (see OPEN QUESTIONS).

### A. Core posting interview — question generation (LIVE; canonical path)

| ID | file:line | Surface / role | Purpose | Verbatim (short) | SSOT? |
|----|-----------|----------------|---------|------------------|-------|
| P1 | `src/lib/interview/generateProjectQuestions.ts:132-317` | About-This-Project, **role-calibrated** (Designer/Architect/**Builder**/**Homeowner**/Vendor/Photographer) | 5 opening category questions per respondent role | "You are generating the opening interview questions … YOU ARE INTERVIEWING A: ${role} … HOLD IT LIGHTLY, NEVER NARRATE IT …" | single (per role-calibration) |
| P1f | `generateProjectQuestions.ts:68-79` | fallback | Deterministic 5-category fallback questions | "Who was this project for, and what did they come to you wanting?" | single |
| P2 | `src/lib/interview/generateRoomQuestions.ts:140-182` | per-room, **designer only** (hardcoded "interviewing a designer") | N room questions w/ product naming-gate | "You are a senior editorial journalist … interviewing a designer about the ${roomName} …" | single (room path) |
| P2a | `generateRoomQuestions.ts:123-132` | lane-contract fragment | Governs use of distilled known-facts | "HOW TO USE THIS BACKGROUND — THE LANE CONTRACT …" | single |
| P3 | `src/lib/interview/distillInterviewFacts.ts:58-70` | fact digest (Haiku) | Strip emotion, facts only, no names | "Facts only. Strip all emotional emphasis … NEVER include personal names …" | single |

### B. Posting interview — follow-ups & evaluation (LIVE)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| F1 | `src/app/api/posting/project/[projectId]/interview/followups/route.ts:37-88` | project-level follow-ups | Fill WHO/WHAT/WHERE/WHEN/WHY at "30,000 feet" | "Ask about ARRIVALS, not departures. 'What clicked about this choice?' not 'Why did you reject the alternatives?'" | dup (3 follow-up prompts) |
| F2 | `.../interview/followups/single/route.ts:54-87` | single-answer follow-ups + coverage morphing | 0-2 deeper follow-ups | "Ask about ARRIVALS, not departures — 'What clicked?' not 'Why did you reject alternatives?'" | dup |
| F3 | `.../interview/followups/batch/route.ts:49-69` (+ user `189-272`) | round-based follow-ups (room + project branches) | Chase stories/details/**emotion**; room branch chases **rejected options & compromises** | "if they mentioned a compromise, ask what the client wanted vs what they wanted … Chase emotion: if they expressed pride or frustration, go there." | dup |
| F4 | `.../interview/evaluate/route.ts:35-44` | coverage classifier | none/covered/morphed | "You evaluate whether a designer's interview answers already cover upcoming questions." | single |

### C. Second interview surface — `/api/interview/*` + `components/interview/InterviewFlow.tsx` (parallel; wiring/legacy status uncertain)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| I1 | `src/app/api/interview/respond/route.ts:44-54` | generic follow-up | One "why/emotion/process" follow-up | "Ask about the 'why' behind their decisions … emotion, intention, and process" | dup |
| I2 | `.../interview/respond/route.ts:56-66` | hook follow-up | Deepen opener into article's opening pull quote | "Echo the designer's own theme back … Invite the EMOTIONAL stakes: what they hoped someone would feel, what was at risk …" | dup |
| I3 | `.../interview/respond/route.ts:143-151` | preview draft | Title + first-paragraph excerpt | "Title should be evocative, not literal …" | dup (editorial) |
| I4 | `.../interview/generate-draft/route.ts:69-92` | full editorial | Headline/sections/pull quotes | "Pull quotes should be the designer's actual words, **slightly polished**" | dup (editorial) |

### D. Editorial generation (LIVE + parallel)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| E1 | `src/lib/posting/generateEditorialDraft.ts` (system prompt; mirror `.../interview/generate/route.ts:205-264`) | canonical article generator | Full feature article | "ACCURACY RULES — NON-NEGOTIABLE … Do not fabricate designer quotes … use the EXACT product name" | canonical, but banned-phrase list is **duplicated** |
| E2 | `.../sections/[chapterIndex]/regenerate/route.ts:16-28` (+ user `166-210`) | section regen | Rewrite one chapter, verbatim quotes | "Do not invent quotes … do NOT rewrite the designer's voice" (`${FOLIO_TONE}` imported) | dup (shares FOLIO_TONE) |
| E3 | `src/lib/interview/narrativeGeneration.ts:55-64, 139-142, 303-305, 427-429` (N1-N8) | transitional / room-intro / material copy | Evocative editorial prose | "Be evocative … 'Morning light pools on the marble island.'" — **no accuracy/grounding guardrail** | dup |
| E4 | `src/lib/interview/answerAnalysis.ts:78-97` | answer analysis | Sentiment / pull-quote / vendor sentiment | "Focus on detecting positive vendor mentions that could be used for **promotional content**." | single |

### E. Collaboration story — vendor × designer testimonial (LIVE: `/api/collaboration/stories/*`, `magazine/collaborations/[slug]`)

| ID | file:line | Surface / role | Purpose | Verbatim (short) | SSOT? |
|----|-----------|----------------|---------|------------------|-------|
| C1 | `src/lib/collaboration/questions/round1.ts:16-76` | **Vendor** R1 (hardcoded) | Baseline relationship questions | "What makes this designer particularly effective to work with …"; "How did your products contribute to the designer's vision in memorable ways?" | single |
| C2 | `round1.ts:79-139` | **Designer** R1 (hardcoded) | Baseline relationship questions | "Describe a time when they went above and beyond to support your vision."; "How do strong vendor relationships elevate your work …" | single |
| C3 | `questions/generateRound2.ts:22-37` (+ user `56-70`, fallbacks `119-189`) | R2 deeper (both roles) | Follow-ups from R1 | "Focus on the human elements of collaboration" | dup |
| C4 | `questions/generateRound3.ts:25-40` (+ user `67-87`) | R3 cross-pollination | Quote one party's words to the other | "The ${otherRole} mentioned '[quote]'. How does hearing that resonate …" | single (technique) |
| C5 | `narrative/assembleStory.ts:55-80` (+ user `117-126`, meta `278-285`) | narrative | Weave both interviews into one story | "Highlight moments of connection, shared values, and mutual growth … Find the emotional core" | dup (editorial) |

### F. Prompted content — feed-card questions (`src/lib/prompted-content/generateQuestions.ts`)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| PC1 | `:87-125` (+ user `129`) | bio-reflective | Expertise questions using bio as *evidence* | "Peer framing: 'Most designers come at this from Y — your path was completely different' — positions the designer as distinctive." | single |
| PC2 | `:287-326` (+ user `330`) | project-reflective | Expertise questions using projects as *evidence* | "Trend context … this tells the designer their answer has an audience." | single |

### G. Welcome-back & supplemental quotes (LIVE)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| W1 | `src/components/intelligence/WelcomeBackBanner.tsx:66` (form `151`) | welcome-back micro-question (`source:'welcome_back'`) | Micro-note about the most-engaged product | "What drew you to the ${productName}?" | single |
| W2 | `src/lib/intelligence/quotes.ts:8`; `src/app/api/projects/[id]/supplemental-quotes/route.ts:144` | source enum | `'welcome_back' | 'trend_interview' | 'user_question'` | (enum only) | — |
| — | **`trend_interview` has NO generator anywhere in `src/`** | trend interview | *(declared, never produced)* | *(none)* | **GAP** |

### H. Consultation (buyer) — `src/lib/atelier/*`, `/api/consultations/*` (LIVE)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| CO1 | `src/lib/atelier/buildConsultationPrompt.ts:103-184` | buyer consultation system prompt | Designer-informed finish guidance | "Be clear: you are AI, not ${designer.name} personally … Don't … Make up information about products" | single |
| CO2 | `src/lib/atelier/extractDesignerReasoning.ts:404-435` | reasoning extraction | Extract decision patterns/quotes | "DO NOT invent or embellish. Only extract what's actually present." | single |

### I. Vendor analytics — Grok/x.ai (LIVE: `/api/vendor-analytics/chat`)

| ID | file:line | Surface | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|---------|------------------|-------|
| V1 | `src/lib/folioGrokSystemPrompt.ts:3-49` | vendor strategy chat (model `grok-2-1212`) | Turn questions into paid actions | "You are Folio's Vendor Strategy Director — an unflinchingly calm, authoritative … turn every question into immediate, **revenue-generating** Folio actions … instantly pivot to positive paid actions" | single |
| V2 | `src/components/vendor/VendorPromptSection.tsx:95,113` | vendor content prompt UI | Elicit vendor product commentary | "Inspired by {designerName}'s project"; "Share your thoughts... Folio will craft an article from your response." (question text server-supplied) | single |

### J. Import agent (LIVE) — `src/lib/import-agent/*`, `/api/import/product`

| ID | file:line | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|------------------|-------|
| IM1 | `src/lib/import-agent/config.ts:15-43` (`IMPORT_AGENT_SYSTEM`) | Root system prompt | "You suggest, never assert. All attributions are queued for designer verification … if uncertain, say so." | single |
| IM2 | `src/lib/import-agent/analyze.ts:75-101, 164-166, 256-295, 493-558` | Image / batch / PDF analysis | "Be conservative with confidence - only use 'high' when clearly identifiable." | single |
| IM3 | `src/lib/import-agent/attribute.ts:25-50`; `src/app/api/import/product/route.ts:281-315` | Web-search attribution / URL extraction | "If you cannot find specific information, omit that field rather than guessing." | single |

### K. Designer/architect/builder bio (LIVE) — `src/lib/designer-bio/*`

| ID | file:line | Role | Purpose | Verbatim (short) | SSOT? |
|----|-----------|------|---------|------------------|-------|
| B1 | `questions.ts:18-43` | **Designer** base Q's | Bio interview | "What do you believe about design that most people in this industry would push back on?" | single |
| B2 | `questions.ts:45-70` | **Architect** base Q's | Bio interview | "How do you think about the relationship between a building's structure and its interior life?" | single |
| B3 | `questions.ts:72-97` | **Builder** base Q's | Bio interview | "What's the detail most people would never notice but you'd never skip?" | single |
| B4 | `questions.ts:137-148` / `214-223` | website-context / follow-up Q's | Deeper bio Q's | "Ask the questions the website bio SHOULD have answered but didn't" | dup (follow-up) |
| B5 | `qa-generation.ts:77-87` | "In Their Words" seed | Profile personality Q's | "questions that reveal **personality**, taste, conviction, and character … make readers feel like they KNOW this person." | single |
| B6 | `qa-generation.ts:246-251` | milestone Q's (hardcoded) | Engagement-triggered | "Your projects have been saved 500 times. **That's real influence.**" | single |
| B7 | `generate-bio.ts:43-65` | bio writer | 200-400 word bio | BANNED PHRASES list ("passionate about", "award-winning" …); "no generic praise" | single |

### L. Editorial-queue angle→prompt generation (LIVE) — `src/lib/editorial-queue/*`

| ID | file:line | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|------------------|-------|
| EQ1 | `extractAngles.ts:31-47` | Rank corpus signals into angles | "signalIds may contain ONLY ids that appear in the SIGNALS list … your output is discarded if you break it" | single |
| EQ2 | `generatePrompts.ts:40-46` (+ `FORMAT_BRIEF` `23-30`, user `50-55`) | Angle → interview prompts | "Never write a generic prompt … Ask one thing at a time. Warm, curious, a colleague over coffee." | **dup (7th question generator)** |

### M. Classification & moodboard/image-gen (LIVE)

| ID | file:line | Purpose | Verbatim (short) | SSOT? |
|----|-----------|---------|------------------|-------|
| AC1 | `src/lib/aesthetic/imageClassification.ts:37-48` | Image → searchable attributes | "use common searchable terms interior designers would use" | single |
| MB1 | `src/lib/boards/prompt.ts:98-145` | Board/moodboard text-to-image render | "Preserve product proportions and materials; do not substitute lookalikes." | single |

### Parallel / possibly-dormant question generators (wiring unconfirmed — see OPEN QUESTIONS)

| ID | file:line | Note |
|----|-----------|------|
| X1 | `src/lib/interview/buildInterviewBrief.ts:509-617` | A **second** question generator w/ its own near-identical rule block ("Ask about arrivals, not departures. Wins, not compromises. Never ask about regrets, cuts …"). Invoked by `generateQuestions.ts:1139`, which the posting path does **not** call (posting uses `generateAllRoomQuestions`, `getInterviewQuestions.ts:70,425,440`). |
| X2 | `src/lib/interview/generateQuestions.ts:113-907` | A **third** system: hardcoded `LEVEL_0..5` template questions + dynamic openers. `LEVEL_0` includes generic/negative questions ("What was the initial vision for this space?", "What challenges did you navigate during this project?") that the LLM generators explicitly label BAD. Contains the `validateAIQuestion` gate (`1067-1081`) that **regex-bans** `regret|compromise|sacrifice|cut|lost`. |

---

## 2. CANON VERDICT PER PROMPT

Verdict key: **PASS** / **SOFT CONFLICT** (tone/terminology/framing drift; fixable in wording) / **HARD CONFLICT** (violates a Non-Negotiable or a core doc-08/09 rule). Hard conflicts ranked first.

### HARD CONFLICTS

1. **P1 — `generateProjectQuestions.ts:299` uses role label `HOMEOWNER`.**
   Rule: `docs/02_NON_NEGOTIABLES.md:15` — *"The canonical user term is INDIVIDUAL. The term 'homeowner' is deprecated and must not be used."* The prompt hardcodes a `HOMEOWNER:` role block (`:299-303`, `:340-345`) and interpolates it into a live model call. → **HARD (terminology, Non-Negotiable).** *Note:* the rest of P1 is otherwise exemplary (see PASS #1) — this is a one-word canon violation, not a rewrite.

2. **E4 — `answerAnalysis.ts:97` "Focus on detecting positive vendor mentions that could be used for promotional content."**
   Rule: `docs/09:38-39` — editorial is *"Observational, not promotional."* The prompt's stated objective is promotional-content sourcing. The underlying feature (vendor-sentiment → boost) is doc-15-sanctioned, but the **framing language** directs the model toward promotion. → **HARD (framing contradicts doc 09).** Fix is wording, not feature removal.

3. **C1/C2 — Collaboration Round-1 leading/testimonial questions.**
   `round1.ts` systematically **presumes positive facts** and centers **personality/relationship over work**:
   - `:35` "Describe a time when they went above and beyond to support your vision." (presumes above-and-beyond — leads the witness)
   - `:23` "What makes this designer particularly effective to work with …" (presumes effectiveness; personality)
   - `:40` "How did your products contribute to the designer's vision in memorable ways?" (presumes memorable contribution)
   - `:131` "How do strong vendor relationships elevate your work for clients?" (presumptive; "elevate")
   Rules: `docs/09:38-44` (*work not personality; observational not promotional; do not manufacture narrative*); task rule *"leads the witness or presumes a fact not evidenced."* → **HARD (leading + promotional + personality).**

### SOFT CONFLICTS

4. **P1/B3 — role term `BUILDER` vs canonical `Contractor`.** `generateProjectQuestions.ts:292` (`BUILDER:` block) and `designer-bio/questions.ts:72-97` (`BUILDER_BASE_QUESTIONS`) use "Builder," while `docs/15` names the role **Contractor** (`15:42-60`). Worse, P1's own body says *"Don't ask a **contractor** about design philosophy"* (`:314`) — internal inconsistency in one prompt. `docs/15` itself is inconsistent (UI tab mock says `[BUILDER]`, `15:95`). → **SOFT (terminology drift).**

5. **C5 / assembleStory — manufactured emotional arc.** `assembleStory.ts:55-80`: *"Highlight moments of connection, shared values, and mutual growth … Find the emotional core of the collaboration."* Rule `docs/09:40-44` (*does not … Manufacture narrative / Inflate importance*). → **SOFT.**

6. **E3 / narrativeGeneration N1-N8 — evocative prose with no grounding guardrail.** N1 example (`narrativeGeneration.ts:62`) invents sensory fact ("Morning light pools on the marble island"). Unlike E1/E2, these prompts carry **no accuracy/anti-fabrication rule**. Rules `docs/08:55-59` (don't invent), `docs/09:40-44` (don't speculate). → **SOFT (ungrounded; add a guardrail).**

7. **I4 / generate-draft — "slightly polished" quotes.** `generate-draft/route.ts` (`I4`) says pull quotes are *"the designer's actual words, slightly polished,"* contradicting the canonical verbatim rule in E1/E2 (`sections/regenerate` `E2`: *"do NOT rewrite the designer's voice"*). Rule `docs/08:56` (don't fabricate). → **SOFT (put words in the designer's mouth).**

8. **PC1/PC2 — peer-framing & trend-audience techniques.** `generateQuestions.ts:100` *"Peer framing … positions the designer as distinctive"*; `:104` *"Trend context … tells the designer their answer has an audience."* Leans personality/positioning and engagement-bait. Rule `docs/09:9-20` (non-hyped, not virality-optimized; work not personality). *Mitigant:* the FRAMING PRINCIPLE (bio/project as evidence, ask for transferable insight) is genuinely canon-aligned. → **SOFT (drop the two positioning techniques).**

9. **B5 / "In Their Words" seed — personality focus.** `qa-generation.ts:77-87`: *"reveal personality … make readers feel like they KNOW this person."* Rule `docs/09:38-39` (*work, not personality*). *Mitigant:* a profile bio arguably warrants some personality — see OPEN QUESTION. → **SOFT.**

10. **B6 / milestone questions — flattery/hype.** `qa-generation.ts:249` *"Your projects have been saved 500 times. That's real influence."*; `:248` engagement-triggered. Rule `docs/09:16-20` (non-hyped; no emotional leverage). → **SOFT.**

11. **CO1 / consultation — non-canonical term "buyer."** `buildConsultationPrompt.ts` uses "buyer"/"the buyer" throughout (`:151` etc.) where canon term is **Individual** (`docs/09:23-31`). *Mitigant:* guardrails are exemplary (see PASS). → **SOFT (terminology).**

12. **V1 / Grok vendor strategy — voice drift + different model.** `folioGrokSystemPrompt.ts:3-27`: persona *"Vendor Strategy Director … trusted C-suite advisor who has already thought three moves ahead … turn every question into … revenue-generating … actions."* This is a sales-performative voice on a **non-Claude model (grok-2-1212)**, diverging from Folio's calm/observational editorial voice (`docs/09:9-15`). "Never expose … 'who isn't buying'" + "instantly pivot to positive paid actions" is defensible as a business tool but is a voice-consistency outlier. → **SOFT (voice drift; also a model-consistency question).**

13. **X2 / generateQuestions.ts LEVEL_0 templates — generic, below the quality bar.** `generateQuestions.ts:114-130`: "What was the initial vision for this space?", "How would you describe the overall aesthetic?", "What challenges did you navigate during this project?" These are exactly the questions the LLM generators call BAD (P1 `:415-420`; P2 `:170-176` rule 4) and one focuses on negatives (contra the arrivals stance). → **SOFT (quality drift / stale duplicate).**

### PASS (canon-aligned; several are models to standardize on)

- **P1 elicitation core** — `generateProjectQuestions.ts:374-403`. The "hold it lightly, never narrate the source; voice it as a soft impression so they can confirm/correct/expand; never recite private names; never assert unverified as fact" block is a textbook implementation of **doc 08 (suggest, never assert)** and of the *presumptive-questioning-only-when-grounded* guardrail. **PASS (exemplary).**
- **P2 / generateRoomQuestions** — product naming-gate respects vendor tiers (`docs/15:183-198`); lane contract prevents citing notes as record. **PASS** (role-scope caveat below).
- **P1f, P3, F4** — deterministic fallback, fact-only digest, neutral coverage classifier. `distillInterviewFacts.ts:60-66` ("Facts only … NEVER include personal names … Do not infer or invent") is exemplary. **PASS.**
- **F1, F2** — arrivals-framed, anti-generic, specific. **PASS** (but see the arrivals-vs-contrast contradiction in §3a).
- **E1, E2** — non-negotiable accuracy rules, verbatim quotes, exact product/vendor names. **PASS (the canonical editorial standard).**
- **W1** — "What drew you to the ${productName}?" observational micro-question. **PASS.**
- **CO1 guardrails / CO2** — "you are AI, not X personally"; "don't make up information"; "DO NOT invent or embellish." **PASS.**
- **IM1-IM3** — "You suggest, never assert … if uncertain, say so"; "omit rather than guessing." Directly mirrors `docs/08` / `docs/13:205`. **PASS (exemplary).**
- **B7 / generate-bio** — banned-phrase discipline, "no generic praise." **PASS.**
- **EQ1, EQ2** — "cite ONLY these ids … output discarded if you break it"; "Never write a generic prompt. Ask one thing at a time." **PASS (exemplary — already encodes one-question-at-a-time + specificity).**
- **AC1, MB1** — neutral extraction; faithful render ("do not substitute lookalikes"). **PASS.**
- **C4 / Round-3 cross-pollination** — the *technique* (referencing another contributor's verified words) is sound and canon-permitted; PASS on tone, but see the **doc-16 OPEN QUESTION**.

---

## 3. CONFLICT MAP

### 3a. Cross-prompt contradictions (same system, incompatible instructions)

1. **Arrivals-only vs contrast/rejection — the central contradiction.**
   - **"Arrivals only, never rejections/compromises" is enforced in:** F1 (`followups/route.ts:56`), F2 (`single:62`), P1 (`generateProjectQuestions.ts:411`, BAD-list `:418`), P2 (`generateRoomQuestions.ts:172` rule 3), X1 (`buildInterviewBrief.ts` "Never ask about regrets, cuts, or things that didn't make it"), PC1/PC2 (banned: "failures, compromises, or regrets"), and hard-enforced by the **regex gate** `validateAIQuestion` (`generateQuestions.ts:1067-1081`, rejects `regret|compromise|sacrifice|cut|lost`).
   - **The opposite is *required* in:** F3 room branch (`batch/route.ts` system `:49-69` + user `:222-235`): *"if they mentioned a compromise, ask what the client wanted vs what they wanted … What did you try first? — the rejected option reveals the thinking … Chase emotion: if they expressed pride or frustration, go there."* Also I2 (`respond.ts:56-66`, "what was at risk").
   - → Within the **same posting interview**, one set of prompts forbids exactly what another set mandates. This is the #1 thing to resolve **before** adopting the proposed *contrast/rejection* technique.

2. **Quote fidelity: verbatim vs "polished."** E1/E2 require verbatim, un-rewritten quotes; I4 says "slightly polished." Contradiction across the two editorial surfaces.

3. **Interviewer persona/voice drift.** "senior editorial journalist" (P1, P2, X1), "editorial interviewer for a design magazine" (F1-F3), "editor for a prestigious … publication" (I4), "editorial director" (EQ1), "editorial interviewer" (EQ2), "expert editorial interviewer" (C3), and — on a different model — "Vendor Strategy Director / C-suite advisor" (V1). Seven+ personas, no shared voice definition.

4. **Work vs personality.** Posting interview + `docs/09` say *work, not personality*. But collaboration R1 (C1/C2), prompted-content peer-framing (PC1), and bio "In Their Words" (B5) center personality/relationship. Same platform, opposite stances by surface.

5. **Question quality bar.** P1/P2/EQ2 ban generic questions; X2's `LEVEL_0` templates ship generic ones ("How would you describe the overall aesthetic?").

### 3b. Duplication / multiple sources of truth (list every copy → pick one home)

**Interview/question generators (7 independent implementations):**
1. `generateProjectQuestions.ts` (P1) + `generateRoomQuestions.ts` (P2) — posting, canonical.
2. `buildInterviewBrief.ts` (X1) — parallel generator w/ its own rule block.
3. `generateQuestions.ts` LEVEL_0-5 + dynamic (X2) — template bank.
4. `designer-bio/questions.ts` (B1-B4) — bio interview.
5. `prompted-content/generateQuestions.ts` (PC1/PC2) — feed cards.
6. `collaboration/questions/round1-3` (C1-C4) — vendor×designer.
7. `editorial-queue/generatePrompts.ts` (EQ2) — angle-based.

**Follow-up generators (5):** F1, F2, F3 (posting) · I1/I2 (`respond`) · C3 (collab R2) · B4 (bio) — each re-derives "reference what they said, go deeper."

**Editorial generators (6):** E1 `generateEditorialDraft` (canonical) · E2 `sections/regenerate` · E3 `narrativeGeneration` (N1-N8) · I3/I4 `respond`/`generate-draft` · C5 `assembleStory` · (doc-only: trend/vendor article prompts, `docs/12`).

**Duplicated banned-phrase list:** the long "avoid these AI-default phrases" block is copied verbatim in `generateEditorialDraft` / `generate/route.ts:205-264` (E1) **and** `sections/regenerate/route.ts:16-28` (E2). `FOLIO_TONE` is imported by E2 — good — but the banned list is not centralized.

**Duplicated arrivals rule:** appears independently in F1, F2, P1, P2, X1, PC1/PC2, and the `validateAIQuestion` gate — no single definition.

### 3c. Terminology drift

| Term used | Where | Canon says | Severity |
|-----------|-------|-----------|----------|
| `HOMEOWNER` | `generateProjectQuestions.ts:299` | **Individual** (`02:15`, deprecated) | HARD |
| `BUILDER` | `generateProjectQuestions.ts:292`; `designer-bio/questions.ts:72-97` | **Contractor** (`15:42`) — and canon itself drifts (`15:95`) | SOFT |
| `buyer` | `buildConsultationPrompt.ts` (`:151` etc.) | **Individual** (`09:23-31`) | SOFT |
| `Architect`, `Photographer` roles | P1, B2 | Not in the canonical term list (`09:22-31`); legitimate per `docs/15` but unratified in doc 09 | note |

### 3d. FUTURE conflicts — where each *FITS CLEANLY* technique would collide or duplicate

| Technique | Already present? | Collision / duplication risk | Recommendation |
|-----------|------------------|------------------------------|----------------|
| **Context reinstatement** ("take me back to the first site visit") | Faint (I2 echo) | Low collision; if added ad hoc it becomes an 8th place | Add **once** to the canonical rule block; do not sprinkle |
| **Report-everything / recall-in-different-order** | Absent | New; risk of contradicting the "one-question-at-a-time" rule if written as a stacked prompt | Add as a follow-up *strategy*, keep single-question form |
| **Funnel (grand-tour → narrow)** | Present (P1 opener → P2 deep dives; EQ2) | Duplicating funnel logic across generators | Consolidate; don't re-encode per generator |
| **Echoing last words** | Present (I2 "echo the designer's own theme back"; F2 acknowledgment) | Adding elsewhere = 3rd copy | Standardize in one place |
| **One-question-at-a-time** | Present (P1 `:409`; EQ2 `:44`; X1) | **Collision:** collaboration R1 stacks compound questions (e.g., C1 `:20` "how you typically collaborate … communication style, decision-making, and problem-solving") | Enforce globally; fix collaboration |
| **"For instance" specificity push** | Present (P2 rule 4; EQ2; F3 "Modern can mean a lot of things — what did it mean specifically") | Already the norm — re-adding duplicates | Ratify existing; no new prompt |
| **Contextual/informed questioning (reference another contributor's verified detail)** | Present (C4 R3; F3 cross-room; `docs/15:56-60` contractor examples) | **Doc-16 consent** (see OPEN QUESTIONS) | Gate on consent; reuse C4 pattern |
| **Projective / third-person** ("what do people usually miss in this room?") | Partial (F3 "What would someone miss if they just glanced at this room?") | Re-adding duplicates F3 | Promote F3's version to the canonical block |
| **Contrast / rejection prompts** ("what did you reject before landing on this?") | **Contradicted** by arrivals-only rule + `validateAIQuestion` gate in 6 places; **required** in F3 room branch | **HIGHEST collision.** Cannot be adopted platform-wide until the arrivals-only stance is reconciled and the regex gate updated | Resolve policy FIRST (§5 step 2) |

**ADAPT-WITH-CARE techniques:**
- *Presumptive questioning (only when grounded):* the **good** pattern already exists (P1 soft-impression block, grounded in photos/notes). The **bad**, ungrounded kind exists in collaboration R1 (C1/C2 presume praise). Adopt P1's guardrail as the standard; fix C1/C2.
- *Labeling (facts/constraints, never emotions):* fact-labeling exists (D/`distillInterviewFacts`). Emotion-labeling exists in E4 (`answerAnalysis` "emotional_tone") — internal only, but note it's the disallowed variety if ever surfaced.

**REJECT techniques — presence check:**
- *Deliberate false statements to provoke correction:* **not present** (P1 explicitly forbids asserting unverified facts — good).
- *Flattery-as-leverage:* **present (mild)** — C1/C2 ("went above and beyond", "particularly effective"), B6 ("That's real influence"), PC1 peer-framing. Must not be extended; flag existing.
- *Manufactured urgency:* **not present** in interview prompts (the doc-12 "Still thinking about X?" is spec-only). Keep it that way.
- *Leading questions that manufacture narrative:* **present** — C1/C2, C5 ("find the emotional core"), E3 (ungrounded sensory). Flag existing.

---

## 4. GAP ANALYSIS — *FITS CLEANLY* techniques unused, per role

| Technique | Designer | Architect | Contractor/Builder | Vendor | Welcome-back |
|-----------|:-------:|:--------:|:-----------------:|:------:|:-----------:|
| Context reinstatement | gap | gap | gap | gap | gap |
| Report-everything / re-order recall | gap | gap | gap | gap | gap |
| Funnel (grand-tour→narrow) | present | partial¹ | partial¹ | partial¹ | n/a |
| Echoing last words | present² | gap | gap | gap | gap |
| One-question-at-a-time | present | present¹ | present¹ | present¹/gap³ | present |
| "For instance" specificity | present | gap | gap | partial | gap |
| Contextual/informed (cross-contributor) | present³ | gap | doc-only⁴ | present³ | gap |
| Projective / third-person | present² | gap | gap | gap | gap |
| Contrast / rejection | blocked⁵ | blocked⁵ | blocked⁵ | present³ | gap |

Notes: ¹ only via P1's role-calibrated *About-This-Project* opener; **there is no role-specific room-level generator** — P2 hardcodes "interviewing a designer" (`generateRoomQuestions.ts:140`), so architect/contractor/vendor get no room-level questions in their own frame. ² posting follow-ups only (F3/I2). ³ collaboration/batch. ⁴ `docs/15:56-60` examples, not shipped. ⁵ blocked by the arrivals-only rule + `validateAIQuestion` gate.

**Biggest structural gap:** the **architect and contractor tracks have no room-level interview**, and **no follow-up generator of their own** — they inherit designer-shaped machinery. `trend_interview` is a **declared source with no generator at all** (`quotes.ts:8`).

---

## 5. RECONCILIATION PLAN (sequenced; buildable steps, no code)

**Guiding principle:** *do not add a technique until it has one canonical home.* Every step below reduces the number of independent copies before anything new is layered on.

1. **Create a single canonical interview-prompt module + doc.** One "Folio editorial interviewer" persona, one shared **rule block** (grounding/anti-fabrication, one-question-at-a-time, "for-instance" specificity, terminology, and the arrivals-vs-contrast policy from step 2). Every generator (P1, P2, X1, F1-F3, I1-I2, C3, B4, PC, EQ2) imports from it instead of re-declaring. Recommended home: `src/lib/interview/prompts/` (code) + a short `docs/21_INTERVIEW_PROMPT_CANON.md` (policy). This is the fix for §3b.

2. **Resolve the arrivals-vs-contrast contradiction (blocking decision — see OPEN QUESTIONS).** Pick ONE policy and apply it to F1, F2, F3, P1, P2, X1, PC, and the `validateAIQuestion` regex gate simultaneously. *Recommendation:* adopt **"rejection in service of the arrival"** — allow "what did you try before this landed?" because it illuminates the win, while still barring dwelling on failure/regret. This unblocks the *contrast/rejection* technique platform-wide and ends the F3-vs-rest contradiction.

3. **Fix terminology (Non-Negotiable first).** `HOMEOWNER → Individual` in P1 (removes the HARD conflict). Decide `BUILDER` vs `Contractor` and apply consistently (P1, B3, and reconcile `docs/15`). `buyer → Individual` in CO1. Enumerate Architect/Contractor/Photographer/Vendor roles in `docs/09` (or explicitly scope them to `docs/15`).

4. **Collapse the editorial generators to one standard.** Make E1 (`generateEditorialDraft`) the single source; centralize the banned-phrase list (one constant, imported by E1 and E2). Retire I3/I4 or align them to E1's verbatim-quote rule (kills the "slightly polished" contradiction). Add E1's accuracy/grounding guardrail to E3 (`narrativeGeneration`) or fold E3 into E1. Fold C5 (`assembleStory`) tone into the same standard.

5. **Consolidate/retire the dormant question generators.** Confirm live status of X1 (`buildInterviewBrief`) and X2 (`generateQuestions.ts` templates). If legacy, delete; if kept, route them through the step-1 rule block and through `validateAIQuestion`. Delete or regenerate the generic `LEVEL_0` templates.

6. **Rework the collaboration module to observational, non-leading framing.** Rewrite C1/C2 to remove presumption/flattery ("went above and beyond" → "walk me through a specific moment you worked together"; drop "elevate/particularly effective"). Split the one compound question (C1 `:20`) into single-topic questions. Add a **doc-16 consent gate** before C4/R3 surfaces one party's verbatim quote to the other.

7. **De-personalize / de-hype the profile surfaces.** Reframe B5 ("In Their Words") and PC1/PC2 toward *work and transferable insight* (keep the strong "evidence-not-subject" framing; drop peer-positioning + "your answer has an audience"). Remove flattery from B6 ("That's real influence").

8. **Decide the Grok/vendor-analytics exception.** Either bring V1 into Folio's calm editorial voice and onto a Claude model, or explicitly document it as a scoped, out-of-editorial sales tool in canon so the voice divergence is intentional, not drift.

9. **Close the two functional gaps.** Build a grounded, observational `trend_interview` generator (or delete the dead enum). Generalize P2 beyond "designer," or add role-specific room-level + follow-up generators for architect/contractor/vendor, so those tracks stop inheriting designer-shaped prompts.

10. **Only now, layer the *FITS CLEANLY* techniques into the single rule block** (step 1): context reinstatement, report-everything, funnel, echoing, one-question (ratify), for-instance (ratify), projective, contextual/informed (with consent), and contrast/rejection (post step-2). Adding them in one place is what prevents this from fragmenting into an 8th copy.

**Recommended canonical location/structure (so it doesn't re-fragment):**
`src/lib/interview/prompts/` = { `persona.ts` (one interviewer voice), `rules.ts` (shared rule block incl. arrivals-vs-contrast policy + terminology + techniques), `roles/{designer,architect,contractor,vendor}.ts` (role deltas only), `editorialTone.ts` (FOLIO_TONE + the single banned-phrase list) } — every route/generator composes from these; `docs/21_INTERVIEW_PROMPT_CANON.md` is the human-readable policy that these files implement.

---

## OPEN QUESTIONS (for you to decide — I did not assume)

1. **Arrivals-only vs contrast/rejection (blocking).** Is "never ask about compromises/rejections/regrets" an *intentional* product stance that should override the proposed contrast/rejection technique, or should we adopt contrast/rejection and relax the `validateAIQuestion` gate? Note it is **already self-contradictory** (F3 chases rejections; the gate forbids them).
2. **`BUILDER` vs `Contractor`.** Which is canonical? `docs/15` uses both.
3. **Second interview surface** (`/api/interview/*` + `InterviewFlow.tsx`, referenced by `StoryPanel.tsx`): live or legacy? If legacy, I1-I4 can be retired rather than reconciled (removes the "polished quotes" conflict for free).
4. **`buildInterviewBrief.ts` (X1) and `generateQuestions.ts` templates (X2):** live or dormant? Confirmed the posting path does **not** call them (`getInterviewQuestions.ts:70,425,440` → `generateAllRoomQuestions`), but I did not trace every caller.
5. **Doc-16 consent for Round-3 cross-pollination (C4).** Both parties are collaboration participants — does that constitute consent to surface one's verbatim words to the other *before* publication, or is an explicit gate required per `docs/16`?
6. **Grok/x.ai vendor-analytics (V1):** in scope for Folio voice/model canon, or intentionally a separate tool? Its persona and model both diverge.
7. **Personality in the profile bio (B5).** Is a public profile bio exempt from doc 09's "work, not personality," or should "In Their Words" be reined in to work-focus?
8. **Instagram export prompts** (`src/lib/instagram/generateCarouselSlides.ts`, `generateSingleSlide.ts`, `src/lib/instagram-export/*`) were flagged by search but are outside the interview/editorial scope of this pass and were not extracted verbatim. Want them audited too?
