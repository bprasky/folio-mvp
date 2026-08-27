// ============================================================================
// The article headline: what we can enforce, and what we deliberately do not.
//
// House style is sentence case, 4-16 words (see the HEADLINE block in the
// generation prompt). This module is the deterministic half of that — the
// prompt asks, this checks.
//
// TWO RULES WERE REVERSED IN B8, both on corpus evidence. They were written when
// generation was producing bad long headlines, and they were treating a symptom the
// frame library now treats at the cause.
//
//   The cap was 10. 35% of real published headlines exceed it and the collected
//   corpus runs to 16, so 10 was not house style, it was a guess that happened to
//   suppress a failure mode. It is now 16 and is a BACKSTOP, not a shaping
//   constraint: a frame decides the shape, and this only catches a runaway.
//
//   NAMES_PEOPLE is gone. It banned the credited designer or studio from the
//   headline, and 57% of published design headlines open on exactly that. It was
//   killing the best-supported arrangement in the corpus for a reason — "the byline
//   below already says it" — that the corpus simply does not share.
//
// Note what did NOT change: docs/20's product naming gate. That withholds PRODUCT
// and BRAND names from prose until the exposure is paid for, which is a commercial
// rule about a placement Folio sells. A designer's own credit is not a placement
// and was never gated by it.
//
// The split matters, because casing is NOT symmetrically safe to fix:
//
//   Capitalizing the first character is always right. Stripping a terminal
//   period, wrapping quotes, or stray whitespace is always right. Those we do.
//
//   LOWERCASING is not. To turn "A Miami Beach House That Changes Mood" into
//   sentence case you must know that "House", "That" and "Mood" are common words
//   while "Miami Beach" is a place. Get it wrong and a published article says
//   "Miami beach" — a worse, more embarrassing failure than the Title Case it
//   was fixing, and one nobody notices until a reader does. Heuristics for this
//   (lowercase it if the body uses it lowercase; preserve capitalized bigrams)
//   all break on exactly the words that matter: "Beach" is both half of a place
//   name and an ordinary noun.
//
// So drift is REPORTED, not silently rewritten. The designer edits the headline
// in place in the preview, so a flagged headline is a few seconds of their time;
// a mangled proper noun is a correction on a live page. This is the same posture
// the pull quote pipeline takes with LLM_QUOTE_UNVERIFIED: surface it, don't
// paper over it.
// ============================================================================

/** House style. Past this a headline is a deck. */
export const HEADLINE_MIN_WORDS = 4;
export const HEADLINE_MAX_WORDS = 16;

export interface HeadlineIssue {
  code: 'TOO_LONG' | 'TOO_SHORT' | 'TITLE_CASE' | 'BANNED_SHAPE' | 'TERMINAL_PUNCT';
  detail: string;
  /**
   * Whether this issue may drop a candidate.
   *
   * `error` — the headline is wrong and must not be offered.
   * `warning` — the headline departs from house style and is surfaced, not dropped.
   *
   * Carried on the issue rather than decided at each call site, because the call
   * sites had drifted apart: this module documented TITLE_CASE as "a heuristic, not
   * a gate" that "returns a warning rather than driving a rewrite or blocking
   * generation", while the regenerate route dropped any candidate with any issue
   * and the story read path filtered them out of the stored pool. The documentation
   * and the behaviour disagreed, and the behaviour won silently.
   *
   * `blockingIssues()` is the filter every dropping site now uses. A site that
   * wants to LOG everything still calls `headlineIssues()`.
   */
  severity: 'error' | 'warning';
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/**
 * Only the transforms that cannot be wrong.
 *
 * Applied to every generated headline. Deliberately does NOT touch the case of
 * any word but the first — see the note at the top of this file.
 */
export function normalizeHeadline(raw: string): string {
  let text = (raw ?? '').replace(/\s+/g, ' ').trim();
  // Models sometimes hand back the headline already quoted.
  text = text.replace(/^["“'‘]+/, '').replace(/["”'’]+$/, '').trim();
  // Headlines do not take a terminal period. A question or exclamation mark is
  // a deliberate choice and is left alone.
  text = text.replace(/\.+$/, '').trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Function words that stay lowercase in BOTH conventions, so their casing tells
 * us nothing about which convention is in play.
 */
const NEUTRAL = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'for', 'so', 'yet',
  'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it', 'its',
  'from', 'into', 'over', 'with', 'that', 'than', 'then', 'this',
]);

/**
 * Sentence case and Title Case are separable in aggregate even though no single
 * word is decisive: in Title Case most content words are capitalized, while in
 * sentence case only proper nouns are — and a headline is rarely more than half
 * proper nouns.
 *
 * Reported, never auto-corrected — and it is a heuristic, not a gate. A headline
 * that is genuinely mostly proper nouns ("Inside Diano Matto's Miami Beach
 * house") trips it. That costs a log line and nothing else, which is the reason
 * this returns a warning rather than driving a rewrite or blocking generation.
 */
export function looksTitleCased(text: string): boolean {
  const ws = words(text).slice(1); // the first word is capitalized either way
  const content = ws.filter(w => !NEUTRAL.has(w.toLowerCase().replace(/[^a-z']/g, '')));
  if (content.length < 3) return false; // too short to tell
  const capitalized = content.filter(w => /^[A-Z]/.test(w)).length;
  return capitalized / content.length > 0.6;
}

/**
 * Where a fragment says a thing SITS. A closed, stable set — unlike the open set
 * of adjectives that can fill the other half of a balanced pair.
 *
 * The determiner is required on the prepositional forms ("in the kitchen", "in
 * one wing"), which is what keeps a bare place name out: "They bought the marble
 * in Italy, then redrew the plan" reports two events and must survive.
 */
const LOCATOR = String.raw`(?:here|there|outside|inside|within|indoors|outdoors|upstairs|downstairs|above|below|out front|out back|(?:in|on|at|across|through)\s+(?:the|one|another|each|every|either)\s+\w+(?:\s+\w+)?)`;

/** `<quality> <locator>, <quality> <locator>` — the caption's native shape. */
const BALANCED_PAIR = new RegExp(
  String.raw`\b\w+\s+${LOCATOR}\s*,\s*(?:and\s+|but\s+)?\w+\s+${LOCATOR}\b`, 'i',
);

/**
 * The shapes a headline falls into when it has nothing specific to say. Each of
 * these is also spelled out in the prompt; this catches the ones that come back
 * anyway.
 */
const BANNED_SHAPES: Array<{ re: RegExp; label: string }> = [
  { re: /\b(refuses|refusing|isn't afraid|is not afraid|dares|daring)\s+to\b/i, label: 'defined by what it declines to do ("refuses to…")' },
  { re: /^where\b.+\bmeets?\b/i, label: '"Where X meets Y"' },
  { re: /\b(a|an)\s+(study|exercise|masterclass|lesson)\s+in\b/i, label: '"A study in X"' },
  { re: /\b(redefin|reimagin|rethink|reinvent)\w*\b/i, label: '"Redefining X"' },
  { re: /\bthe\s+art\s+of\s+\w+ing\b/i, label: '"The art of X-ing"' },
  { re: /\b(curated|elevated|seamless|harmonious|timeless|bespoke|sanctuary|oasis|haven)\b/i, label: 'brochure vocabulary' },

  // The caption shapes. A caption is specific and accurate and still not a
  // headline: it says what a photograph shows and stops, leaving nothing at
  // stake. These are the constructions that give one away.
  //
  // "Bold in the kitchen, soft in the primary bedroom" — two things inventoried
  // and the inventory presented as a thought.
  //
  // Matched STRUCTURALLY rather than by phrasing. The first version of this rule
  // spelled out one lexicalization ("X in the Y, Z in the W") and so caught
  // exactly one of the three examples the criteria list under NEVER THE BALANCED
  // PAIR: "Dark in one wing, bright in the other" and "Moody here, sunlit there"
  // both went straight through, and "Formal outside, unruly within" shipped.
  //
  // What every one of them is: a quality pinned to a PLACE, twice, with a comma
  // between. That is a floor plan read aloud, which is why it reads as a caption
  // — the sentence describes where things are, so nothing in it happened.
  //
  // The locator is the discriminator, not the adjective. "Two crews, one site,
  // the same afternoon" is also a comma list of verbless fragments and is a GOOD
  // example: its fragments are concrete nouns converging on one event, and no
  // fragment says where anything sits. Keying on position rather than on a
  // lexicon of moods is what keeps that line alive.
  { re: BALANCED_PAIR, label: 'balanced pair ("bold in the kitchen, soft in the bedroom") — a caption\'s shape: one quality per location, inventoried' },
  // "A moody entry gives way to a sunlit landing" — a walkthrough, not a claim.
  { re: /\bgives? way to\b/i, label: '"gives way to" — describes a photo sequence' },
  // "Finishes and fixtures do all the talking".
  { re: /\bdo(es)? (all )?the talking\b/i, label: '"does the talking" — cliché, and says nothing about this house' },
  // "One house, written in different chapters" — about the article, not the
  // project. A reader does not care how the piece is organised.
  { re: /\b(written in|told in|across) (its |different |several |many )?(chapters|parts|sections|acts)\b/i, label: 'about the article\'s own structure, not the house' },

  // The conceit. Rooms that argue, exteriors that stay quiet, materials that
  // converse — personifying the architecture reads as writing rather than
  // reporting, and it is always describing arrangement: nothing happened, nobody
  // decided anything, the building is simply performing a mood.
  {
    re: /\b(rooms?|walls?|kitchens?|exteriors?|facades?|stairs?|stairways?|spaces?|finishes|fixtures|materials?|palettes?)\b[^,]{0,40}\b(argue|argues|converse|converses|whisper|whispers|shout|shouts|speak|speaks|talk|talks|breathe|breathes|behave|behaves|insist|insists|reconcile|reconciles|mediate|mediates|negotiate|negotiates|stay quiet|stays quiet|hold their tongue)\b/i,
    label: 'personified architecture ("so the rooms can argue") — a conceit, and it describes arrangement rather than a decision',
  },
];

/**
 * Only the issues that may DROP a headline.
 *
 * The filter every rejecting site uses. Sites that log call `headlineIssues`, so a
 * warning is still surfaced — it just no longer costs the designer the candidate.
 */
export function blockingIssues(text: string): HeadlineIssue[] {
  return headlineIssues(text).filter((i) => i.severity === 'error');
}

/** Every way this headline departs from house style. Empty means it conforms. */
export function headlineIssues(text: string): HeadlineIssue[] {
  const issues: HeadlineIssue[] = [];
  const n = words(text).length;

  if (n > HEADLINE_MAX_WORDS) {
    issues.push({ code: 'TOO_LONG', severity: 'error', detail: `${n} words (max ${HEADLINE_MAX_WORDS}) — past this it is a deck` });
  } else if (n > 0 && n < HEADLINE_MIN_WORDS) {
    issues.push({ code: 'TOO_SHORT', severity: 'error', detail: `${n} words (min ${HEADLINE_MIN_WORDS})` });
  }
  // WARNING, not error. `looksTitleCased` is a heuristic and this module has always
  // said so: a headline that is genuinely mostly proper nouns trips it. Dropping on
  // a heuristic throws away good headlines for a house convention, and casing is the
  // one departure a designer can fix in the preview in two seconds.
  if (looksTitleCased(text)) {
    issues.push({ code: 'TITLE_CASE', severity: 'warning', detail: 'reads as Title Case; house style is sentence case' });
  }
  if (/[.]$/.test(text.trim())) {
    issues.push({ code: 'TERMINAL_PUNCT', severity: 'error', detail: 'headlines take no terminal period' });
  }
  for (const { re, label } of BANNED_SHAPES) {
    if (re.test(text)) issues.push({ code: 'BANNED_SHAPE', severity: 'error', detail: label });
  }

  return issues;
}
