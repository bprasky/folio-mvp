import { formatRoomName } from '@/lib/utils/formatRoomName';
import { prisma } from '@/lib/prisma';
import { resolveProductNaming } from '@/lib/naming/resolveProductNaming';
import { scrubProseNaming } from '@/lib/naming/scrubProse';
import type { LoadedAnswer } from './loadInterviewAnswers';
import { generateFolioLines } from './generateFolioLines';
import { articleFolioLines, folioLinesMatchSources, isArticleFolioLine, needsRoomTeaserPreparation } from './folioLines';
import { selectPullQuotes, toSelection } from './selectPullQuotes';
import { extractQuoteCandidates } from './quoteCandidates';
import { FolioLineSchema, getSelectedRoomLineText, isPullQuoteSelection, syncPullQuotesFromChapters, type Blocks, type PullQuoteSelection } from './schemas';

/** Prepare the selector before saving an article, or repair a legacy draft once. */
export async function prepareRoomTeasers<T extends { galleryChapters?: any[] }>(
  blocks: T,
  answers: LoadedAnswer[],
  projectId: string,
  options: { refresh?: boolean; preserveRoomIds?: string[]; correlationId?: string; postingUserId?: string | null } = {},
): Promise<T> {
  const publicAnswers = answers.filter(answer => answer.category === null)
    .map(answer => ({ ...answer, section: formatRoomName(answer.section) }));
  const refreshChapter = (ch: any) => options.refresh && !options.preserveRoomIds?.includes(ch.roomId);
  const chapters = (blocks.galleryChapters ?? []).filter(ch => {
    if (ch.kind === 'gallery' || !Array.isArray(ch.body) ||
      !ch.body.some((p: unknown) => typeof p === 'string' && p.trim())) return false;
    const previous = isPullQuoteSelection(ch.pullQuote) ? ch.pullQuote : undefined;
    return refreshChapter(ch) || needsRoomTeaserPreparation(ch) || !getSelectedRoomLineText(previous) || !previous?.folio?.alternatives?.length ||
      !folioLinesMatchSources(previous.folio.alternatives, formatRoomName(ch.title ?? 'The room'), publicAnswers, ch.body);
  });
  const roomNames = Array.from(new Set(chapters.map(ch => formatRoomName(ch.title ?? 'The room'))));
  if (!chapters.length) return blocks;
  // Callers have already checked project ownership. Read current tag evidence
  // once, then scope each model input to the chapter's own photographs.
  const projectTags = await prisma.productTag.findMany({ where: { image: { projectId } },
    select: { productId: true, imageId: true, finishRaw: true, finishConfirmed: true,
      product: { select: { name: true, brand: true, category: true, description: true } } } });
  const naming = await resolveProductNaming(projectTags.map(tag => tag.productId), {
    mode: 'prose', projectId, postingUserId: options.postingUserId,
  });
  let byRoom: Record<string, PullQuoteSelection | null> = {};
  try {
    ({ byRoom } = await selectPullQuotes(roomNames, publicAnswers, options.correlationId ?? 'room-teasers', projectId, true));
  } catch {
    // Ranking is advisory. Never discard verified candidates because transport
    // or incident reporting threw outside the ranker's normal fallback.
    for (const room of roomNames) {
      const candidates = extractQuoteCandidates(publicAnswers, room);
      byRoom[room] = candidates.length ? toSelection(candidates[0], candidates) : null;
    }
  }
  let cursor = 0;
  // Article requests may contain many rooms. Bound both writer/reviewer traffic
  // and latency; each worker finishes a room before starting another.
  await Promise.all(Array.from({ length: Math.min(2, chapters.length) }, async () => {
    while (cursor < chapters.length) {
      const chapter = chapters[cursor++];
      const room = formatRoomName(chapter.title ?? 'The room');
      const refresh = refreshChapter(chapter);
      const previous: PullQuoteSelection | undefined = isPullQuoteSelection(chapter.pullQuote) ? chapter.pullQuote
        : typeof chapter.pullQuote === 'string' && chapter.pullQuote.trim()
          ? { selected: { text: chapter.pullQuote }, alternatives: [{ text: chapter.pullQuote, score: 1 }] }
          : undefined;
      const direct = byRoom[room];
      const selection: PullQuoteSelection = !refresh && previous
        ? { ...previous }
        : direct ? { ...direct } : { selected: null, alternatives: [] };
      if (!selection.selected && direct?.selected) {
        selection.selected = direct.selected;
        selection.alternatives = direct.alternatives;
      }
      const recoverFallback = previous?.folio?.generatorVersion !== 3 && previous?.folio?.alternatives.some(isArticleFolioLine);
      let lines = !refresh && !recoverFallback && previous?.folio?.alternatives &&
        folioLinesMatchSources(previous.folio.alternatives, room, publicAnswers, chapter.body)
        ? previous.folio.alternatives : [];
      if (!lines.length) {
        try {
          const imageIds = new Set<string>(chapter.imageIds ?? []);
          const taggedProducts = projectTags.filter(tag => imageIds.has(tag.imageId)).map(tag => ({
            productId: tag.productId, name: tag.product.name, brand: tag.product.brand,
            category: tag.product.category, description: tag.product.description?.slice(0, 2000) ?? null,
            finish: tag.finishConfirmed ? tag.finishRaw : null,
          }));
          lines = await generateFolioLines(room, publicAnswers, projectId, direct ?? undefined, taggedProducts, chapter.body);
        } catch {
          // A provider outage must not leave an otherwise complete room without
          // its clickable teaser. These excerpts remain explicitly Folio-authored.
          lines = articleFolioLines(room, chapter.body);
        }
      }
      if (!lines.length) lines = articleFolioLines(room, chapter.body);
      const scrubbed = scrubProseNaming({ introduction: lines.map(line => line.text) } as Blocks, naming).blocks.introduction!;
      lines = lines.flatMap((line, index) => line.sources.some(source => 'kind' in source && source.kind === 'article') && scrubbed[index] !== line.text
        ? [] : [{ ...line, text: scrubbed[index] }])
        .filter(line => FolioLineSchema.safeParse(line).success && folioLinesMatchSources([line], room, publicAnswers, chapter.body));
      if (!lines.length) lines = articleFolioLines(room, chapter.body);
      const oldFolio = previous?.folio?.selected;
      selection.folio = {
        generatorVersion: 3,
        alternatives: lines,
        selected: !refresh && oldFolio && lines.some(line => line.text === oldFolio.text)
          ? oldFolio : lines[0],
      };
      selection.authorship = selection.selected
        ? (!refresh && previous?.authorship === 'folio' ? 'folio' : 'verbatim')
        : 'folio';
      chapter.pullQuote = selection;
    }
  }));
  syncPullQuotesFromChapters(blocks);
  return blocks;
}
