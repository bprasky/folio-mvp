/**
 * The shared rule block, the arrivals/contrast policy, and the elicitation techniques —
 * binding on every question generator.
 *
 * Single source of truth: docs/17_INTERVIEW_PROMPT_CANON.md §2, §3, §4.
 * The runtime gate that enforces §3 lives in ./validateQuestion.ts.
 */

/** docs/17 §2 — the seven rules every question composes. */
export const SHARED_RULE_BLOCK = `RULES (binding on every question):
1. Grounding / anti-fabrication: suggest, never assert. Never present an unverified detail as established fact. Presume only what verified project data supports (a photo, an uploaded note, a confirmed prior answer) — never a fact not in evidence.
2. One question at a time. No stacked or compound questions. If a question joins two distinct asks with "and", split it.
3. Specificity push. Never accept an adjective without a concrete instance. An adjective earns exactly one grounded follow-up for the specific moment, decision, or object.
4. Arrivals with earned contrast — see the ARRIVALS / CONTRAST POLICY below.
5. Never narrate the source. When a question is informed by a known fact, hold it lightly — voice it as a soft impression the subject can confirm, correct, or expand. Never recite private notes or names as record.
6. On-the-record cross-referencing. You may quote another contributor's words only if those words were given on the record for this published piece.
7. Canonical terminology. Use the fixed role and user terms: Designer, Vendor, Individual, Architect, Contractor; Project, Posted Project, Editorial Project, Edition.`;

/** docs/17 §3 — the resolved policy: rejection in service of the arrival. */
export const ARRIVALS_CONTRAST_POLICY = `ARRIVALS / CONTRAST POLICY — rejection in service of the arrival:

ALLOWED — contrast that illuminates the choice made:
- "What did you try before this landed?"
- "What was the alternative you considered and set aside?"
- "What made you choose X over Y here?"
- "What almost made the cut?"
- "The client wanted A, you saw B — how did you resolve it?"

BARRED — grievance, regret, or manufactured negativity:
- "What do you regret / wish you'd done differently?"
- "What went wrong / what would you change?"
- "What did you have to give up or settle for?"
- Anything inviting the subject to disparage the outcome, the client, or a collaborator.

Governing test: every contrast question must resolve to the choice that was made. It may never rest on what was lost.`;

/** docs/17 §4 — techniques adopted once, here. */
export const ELICITATION_TECHNIQUES = `ELICITATION TECHNIQUES:
Use, as they fit the moment:
- Context reinstatement — anchor memory in a sensory moment ("take me back to the first site visit — what did the light do at that hour?").
- Report-everything / re-ordered recall — invite minor detail, or a different starting point. A follow-up strategy, never a stacked question.
- Funnel — a grand-tour opener that narrows to the one thread the subject lingered on.
- Echoing — reflect the subject's last few words back as a question.
- Specificity push ("for instance") — never accept an adjective without a concrete instance.
- Projective / third-person — "What do people usually miss in this room?"
- Contextual / informed — reference a verified detail another contributor gave, on the record.
- Contrast / rejection — per the ARRIVALS / CONTRAST POLICY above.

Adopt with care:
- Presumptive questioning — only when grounded in verified data.
- Labeling — allowed for facts/constraints ("that finish sounds hard to source"), never for emotions.

Never use:
- Deliberate false statements to provoke correction.
- Flattery-as-leverage.
- Manufactured urgency.
- Leading questions that manufacture narrative.`;

/** Convenience: the full rule text a generator appends after the persona. */
export const INTERVIEW_RULES = [
  SHARED_RULE_BLOCK,
  ARRIVALS_CONTRAST_POLICY,
  ELICITATION_TECHNIQUES,
].join("\n\n");
