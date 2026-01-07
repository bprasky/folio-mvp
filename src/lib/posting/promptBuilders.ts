type Img = { id: string; alt?: string | null; caption?: string | null };
type TaggedProduct = {
  name: string;
  vendor?: string | null;
  url?: string | null;
  key?: string | null;
};

export function compactImages(images: Img[], limit = 12): string {
  if (!Array.isArray(images) || images.length === 0) return 'No images.';
  const list = images
    .slice(0, limit)
    .map((im, i) => `• IMG${i + 1}${im.alt || im.caption ? ` – ${im.alt || im.caption}` : ''}`.trim());
  return list.join('\n');
}

export function compactProducts(products: TaggedProduct[], limit = 16): string {
  if (!Array.isArray(products) || products.length === 0) return 'No tagged products.';
  const list = products.slice(0, limit).map((p, i) => `• ${p.name}${p.vendor ? ` – ${p.vendor}` : ''}`);
  return list.join('\n');
}

// Simple soft moderation scrub: removes or softens likely trip phrases without altering meaning much.
export function softModerate(text: string): { text: string; changed: boolean } {
  if (!text) return { text, changed: false };

  let out = text;
  const before = out;

  // Gentle substitutions; add more as needed.
  out = out.replace(/\bkill(ed|ing)?\b/gi, 'remove');
  out = out.replace(/\bdamn(ed|ing)?\b/gi, 'very');
  out = out.replace(/\bsexy\b/gi, 'striking');

  return { text: out, changed: out !== before };
}

export function frameFollowupsPrompt(ctx: {
  projectTitle: string;
  city?: string;
  clientType?: string;
  baseAnswers: string;
  imagesCompact: string;
  productsCompact: string;
}) {
  return [
    `Project: ${ctx.projectTitle}${ctx.city ? ` (${ctx.city})` : ''}${ctx.clientType ? ` – ${ctx.clientType}` : ''}`,
    `Images:\n${ctx.imagesCompact}`,
    `Tagged Products:\n${ctx.productsCompact}`,
    `Designer Answers:\n${ctx.baseAnswers}`,
    `Task: Generate 4–6 targeted, optional follow-up questions to clarify narrative, sourcing decisions, constraints, and craft.`,
    `Format: JSON array of { id, prompt } with concise, neutral tone.`,
  ].join('\n\n');
}

export function frameNarrativePrompt(ctx: {
  projectTitle: string;
  city?: string;
  clientType?: string;
  baseAnswers: string;
  followups: string;
  imagesCompact: string;
  productsCompact: string;
  toneNote?: string;
}) {
  return [
    `Project: ${ctx.projectTitle}${ctx.city ? ` (${ctx.city})` : ''}${ctx.clientType ? ` – ${ctx.clientType}` : ''}`,
    `Images:\n${ctx.imagesCompact}`,
    `Tagged Products:\n${ctx.productsCompact}`,
    `Designer Answers:\n${ctx.baseAnswers}`,
    `Follow-ups:\n${ctx.followups || 'None'}`,
    ctx.toneNote ? `Tone Note: ${ctx.toneNote}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

