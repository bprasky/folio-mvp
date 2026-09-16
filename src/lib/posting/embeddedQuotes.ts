import { EmbeddedQuoteChoiceSchema, type EmbeddedQuoteChoice, type Blocks } from './schemas';
import { formatRoomName } from '@/lib/utils/formatRoomName';

export interface EmbeddedQuoteOption {
  text: string;
  sourceId: string;
  label: string;
  contributorAttribution?: string;
}

interface QuoteProject {
  designerOrg?: { name?: string | null } | null;
  designer?: { name?: string | null; studio?: string | null } | null;
}

interface QuotePost {
  expandedBlocks?: unknown;
  supplementalQuotes?: Array<{ id: string; pinned?: boolean; answer?: string | null; contributorRole?: string | null }>;
}

export function embeddedQuoteCredits(project?: QuoteProject | null) {
  const organization = project?.designerOrg?.name?.trim() || project?.designer?.studio?.trim() || null;
  const designer = project?.designer?.name?.trim() || null;
  return { organization, designer };
}

/** Saved direct quotations only: Folio display lines never enter this pool. */
export function embeddedQuoteOptions(post: QuotePost): EmbeddedQuoteOption[] {
  const options: EmbeddedQuoteOption[] = [];
  const add = (option: EmbeddedQuoteOption) => {
    if (typeof option.text !== 'string' || !option.text.trim() || option.text.length > 4000) return;
    if (!options.some(item => item.text === option.text && item.sourceId === option.sourceId)) options.push(option);
  };
  for (const quote of post?.supplementalQuotes ?? []) {
    if (!quote.pinned || !quote.answer || quote.contributorRole === 'DESIGNER' || !quote.id) continue;
    const attribution = quote.contributorRole ? formatRoomName(quote.contributorRole.toLowerCase()) : 'Contributor';
    add({ text: quote.answer, sourceId: `contributor:${quote.id}`, label: attribution, contributorAttribution: attribution });
  }
  const blocks = post?.expandedBlocks as Partial<Blocks> | undefined;
  for (const quote of blocks?.pullQuotes ?? []) {
    add({ text: typeof quote === 'string' ? quote : quote?.text, sourceId: 'designer',
      label: typeof quote !== 'string' && quote?.sourceSection ? formatRoomName(quote.sourceSection) : 'Project' });
  }
  for (const chapter of blocks?.galleryChapters ?? []) {
    if (chapter.kind === 'gallery') continue;
    const selection = chapter.pullQuote;
    const quotes = typeof selection === 'string' ? [{ text: selection }]
      : [selection?.selected, ...(selection?.alternatives ?? [])];
    for (const quote of quotes) {
      if (quote?.text) add({ text: quote.text, sourceId: 'designer', label: formatRoomName(chapter.title || 'Room') });
    }
  }
  return options;
}

export function savedEmbeddedQuoteChoices(blocks: unknown): EmbeddedQuoteChoice[] {
  const choices = blocks && typeof blocks === 'object' && 'embeddedQuotes' in blocks ? blocks.embeddedQuotes : null;
  return (Array.isArray(choices) ? choices : []).flatMap((choice: unknown) => {
    const parsed = EmbeddedQuoteChoiceSchema.safeParse(choice);
    return parsed.success ? [parsed.data] : [];
  });
}

export function embeddedQuoteAttribution(option: EmbeddedQuoteOption, choice: EmbeddedQuoteChoice | undefined, project?: QuoteProject | null) {
  if (option.contributorAttribution) return option.contributorAttribution;
  const credits = embeddedQuoteCredits(project);
  return choice?.attribution === 'designer'
    ? credits.designer || credits.organization || 'Designer'
    : credits.organization || credits.designer || 'Designer';
}
