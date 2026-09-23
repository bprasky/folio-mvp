/** Select from already published editorial language, before the card is opened.
 * Never shorten a sentence into a new claim or turn private guidance into copy. */
export function publicationHeadlines(candidates: unknown[], attribution: string[]) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(new RegExp('[^\\p{L}\\p{N}]+', 'gu'), ' ').trim();
  const names = new Set(attribution.map(normalize));
  const generic = /^(?:a closer look|the design decision|project story|room story|introduction|overview|untitled|beautiful (?:home|room|design))\b/i;
  return Array.from(new Set(candidates.filter((value): value is string => typeof value === 'string')
    .map(value => value.trim()).filter(value => value.length >= 8 && value.length <= 90 &&
      value.split(/\s+/).length <= 14 && !names.has(normalize(value)) && !generic.test(value)))).slice(0, 5);
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
export function sourceSentences(text: string) {
  // Do not split decimals or abbreviations into apparently complete new facts.
  const sentences: string[] = [];
  for (const part of Array.from(segmenter.segment(text))) {
    const previous = sentences[sentences.length - 1];
    if (previous && /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|[A-Z])\.$/.test(previous)) sentences[sentences.length - 1] += ` ${part.segment.trim()}`;
    else sentences.push(part.segment.trim());
  }
  return sentences;
}

/** These are explicitly open interview questions, not claims about the work. */
export function activityHeadline(format: string, name: string, project?: string) {
  if (format === 'twenty_questions') return project ? `The story behind ${project}` : `Meet ${name}`;
  if (format === 'bio') return `The practice of ${name}`;
  if (format === 'material') return project ? `How were the materials chosen for ${project}?` : `How do I choose a material?`;
  if (format === 'method') return project ? `How did ${project} take shape?` : `How does a project take shape with ${name}?`;
  return project ? `Which decision defines ${project}?` : `What catches ${name}’s eye?`;
}
