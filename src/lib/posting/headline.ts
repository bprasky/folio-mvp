// ============================================================================
// The article headline: what we can enforce, and what we deliberately do not.
//
// House style is sentence case, 4-10 words (see the HEADLINE block in the
// generation prompt). This module is the deterministic half of that — the
// prompt asks, this checks.
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
export const HEADLINE_MAX_WORDS = 10;

export interface HeadlineIssue {
  code: 'TOO_LONG' | 'TOO_SHORT' | 'TITLE_CASE' | 'BANNED_SHAPE' | 'TERMINAL_PUNCT' | 'NAMES_PEOPLE';
  detail: string;
}

/**
 * Names the headline must not use. The byline already carries them.
 *
 * Passed in rather than inferred, because "Matto" is only a designer's name on
 * this project — somewhere else it is a word. Enforceable precisely because the
 * caller knows exactly who is being credited.
 */
export interface HeadlineNames {
  designerName?: string | null;
  orgName?: string | null;
}

/** Every whole-word form of a name worth catching, surname included. */
function nameForms(name: string | null | undefined): string[] {
  const full = (name ?? '').trim();
  if (!full) return [];
  const parts = full.split(/\s+/).filter(Boolean);
  const forms = [full];
  // A surname alone is the usual way a headline smuggles the name in
  // ("A house Matto never had to redraw"). One-word names are already covered.
  if (parts.length > 1) forms.push(parts[parts.length - 1]);
  // Studio names ending in a generic word ("BP Design") also appear shortened.
  return forms.filter(f => f.length > 2);
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
  { re: /\b\w+ in the \w+([\s\w]*)?,\s*\w+ in the \w+/i, label: 'balanced pair ("bold in the kitchen, soft in the bedroom") — a caption\'s shape' },
  // "A moody entry gives way to a sunlit landing" — a walkthrough, not a claim.
  { re: /\bgives? way to\b/i, label: '"gives way to" — describes a photo sequence' },
  // "Finishes and fixtures do all the talking".
  { re: /\bdo(es)? (all )?the talking\b/i, label: '"does the talking" — cliché, and says nothing about this house' },
  // "One house, written in different chapters" — about the article, not the
  // project. A reader does not care how the piece is organised.
  { re: /\b(written in|told in|across) (its |different |several |many )?(chapters|parts|sections|acts)\b/i, label: 'about the article\'s own structure, not the house' },
];

/** Every way this headline departs from house style. Empty means it conforms. */
export function headlineIssues(text: string, names?: HeadlineNames): HeadlineIssue[] {
  const issues: HeadlineIssue[] = [];
  const n = words(text).length;

  if (n > HEADLINE_MAX_WORDS) {
    issues.push({ code: 'TOO_LONG', detail: `${n} words (max ${HEADLINE_MAX_WORDS}) — this is a deck, not a headline` });
  } else if (n > 0 && n < HEADLINE_MIN_WORDS) {
    issues.push({ code: 'TOO_SHORT', detail: `${n} words (min ${HEADLINE_MIN_WORDS})` });
  }
  if (looksTitleCased(text)) {
    issues.push({ code: 'TITLE_CASE', detail: 'reads as Title Case; house style is sentence case' });
  }
  if (/[.]$/.test(text.trim())) {
    issues.push({ code: 'TERMINAL_PUNCT', detail: 'headlines take no terminal period' });
  }
  for (const { re, label } of BANNED_SHAPES) {
    if (re.test(text)) issues.push({ code: 'BANNED_SHAPE', detail: label });
  }

  // The headline is about the PROJECT. Naming the designer or the studio spends
  // the one line that has to interest a stranger on something the byline
  // directly beneath it already says — and on an org-credited project, naming
  // the individual contradicts the credit outright.
  for (const form of [...nameForms(names?.designerName), ...nameForms(names?.orgName)]) {
    const re = new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) {
      issues.push({ code: 'NAMES_PEOPLE', detail: `names "${form}" — the byline already does` });
      break;
    }
  }
  return issues;
}
