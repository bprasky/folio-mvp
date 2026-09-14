/** Public readers need the selected display line, never the interview evidence. */
export function publicFolioBlocks<T>(blocks: T): T {
  if (!blocks || typeof blocks !== 'object') return blocks;
  const result = structuredClone(blocks);
  const chapters = (result as Record<string, unknown>).galleryChapters;
  if (!Array.isArray(chapters)) return result;
  for (const chapter of chapters) {
    const pq = chapter?.pullQuote;
    if (!pq || typeof pq !== 'object' || !pq.folio) continue;
    const text = pq.folio.selected?.text;
    pq.folio = {
      selected: typeof text === 'string' ? { text } : null,
      alternatives: [],
    };
  }
  return result;
}
