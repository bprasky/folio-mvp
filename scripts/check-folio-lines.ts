import assert from 'node:assert/strict';
import Module from 'node:module';
import { FolioLineSchema, getSelectedPullQuoteText, getSelectedRoomLineText, syncPullQuotesFromChapters, type PullQuoteSelection } from '../src/lib/posting/schemas';
import { folioRewriteSources, folioTeaserSources, folioLinesMatchSources } from '../src/lib/posting/folioLines';
import type { LoadedAnswer } from '../src/lib/posting/loadInterviewAnswers';
import { extractQuotes } from '../src/lib/instagram/extractQuotes';
import { extractQuotesWithMetadata } from '../src/lib/instagram/matchQuoteToImage';
import { publicFolioBlocks } from '../src/lib/posting/publicFolioBlocks';

const answer: LoadedAnswer = { section: 'Dining Room', questionId: 'q1', isFollowUp: false, category: null, questionCategory: 'what', answer: 'We chose a glass table because a solid table would have crowded the dining room.' };
const direct: PullQuoteSelection = { selected: { text: answer.answer }, alternatives: [{ text: answer.answer, score: 10, provenance: { questionId: 'q1', isFollowUp: false } }] };
const line = { text: 'A glass table keeps the dining room visually open.', originalText: answer.answer, sources: [{ questionId: 'q1', isFollowUp: false, excerpt: answer.answer }] };
let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('PASS', name); }
check('original ranked quote supplies exact source context', () => assert.equal(folioRewriteSources('Dining Room', [answer], direct)[0].quote, answer.answer));
check('other rooms and project-scoped sources are excluded', () => {
  assert.equal(folioRewriteSources('Living Room', [answer], direct).length, 0);
  assert.equal(folioRewriteSources('Dining Room', [{ ...answer, category: 'big_idea' as any }], direct).length, 0);
});
check('ambiguous legacy quote context is rejected', () => {
  const legacy = { ...direct, alternatives: [{ text: answer.answer, score: 0 }] };
  assert.equal(folioRewriteSources('Dining Room', [answer, { ...answer, questionId: 'q2' }], legacy).length, 0);
});
check('long answers retain a bounded excerpt around the quote', () => {
  const long = { ...answer, answer: 'Earlier context. '.repeat(500) + answer.answer + ' More detail.'.repeat(500) };
  const source = folioRewriteSources('Dining Room', [long], direct)[0];
  assert.ok(source.source.excerpt.length <= 4000 && source.source.excerpt.includes(answer.answer));
});
check('stored evidence detects changed and missing answers', () => {
  assert.ok(folioLinesMatchSources([line], 'Dining Room', [answer]));
  assert.ok(!folioLinesMatchSources([line], 'Dining Room', []));
  assert.ok(!folioLinesMatchSources([line], 'Dining Room', [{ ...answer, answer: 'We chose wood.' }]));
  assert.ok(!folioLinesMatchSources([{ ...line, originalText: 'I invented this.' }], 'Dining Room', [answer]));
});
check('Folio storage cannot strip the original quote or evidence', () => {
  assert.ok(FolioLineSchema.safeParse(line).success);
  assert.ok(!FolioLineSchema.safeParse({ text: line.text }).success);
});
check('public payload keeps the display line but strips interview evidence and alternatives', () => {
  const privateBlocks = { galleryChapters: [{ pullQuote: { ...direct, authorship: 'folio', folio: { selected: line, alternatives: [line] } } }] };
  const publicBlocks = publicFolioBlocks(privateBlocks);
  assert.equal((publicBlocks.galleryChapters[0].pullQuote.folio.selected as any).sources, undefined);
  assert.equal((publicBlocks.galleryChapters[0].pullQuote.folio.selected as any).originalText, undefined);
  assert.equal(publicBlocks.galleryChapters[0].pullQuote.folio.selected.text, line.text);
  assert.deepEqual(publicBlocks.galleryChapters[0].pullQuote.folio.alternatives, []);
  assert.ok(privateBlocks.galleryChapters[0].pullQuote.folio.selected.sources.length);
});
check('Folio display text never enters quote-only exports', () => {
  const pq = { ...direct, authorship: 'folio' as const, folio: { selected: line, alternatives: [line] } };
  assert.equal(getSelectedRoomLineText(pq), line.text);
  assert.equal(getSelectedPullQuoteText(pq), null);
  const blocks: any = { galleryChapters: [{ title: 'Dining Room', pullQuote: pq }] };
  syncPullQuotesFromChapters(blocks);
  assert.deepEqual(extractQuotes(blocks), []);
  assert.deepEqual(extractQuotesWithMetadata(blocks), []);
  pq.authorship = 'verbatim' as any;
  syncPullQuotesFromChapters(blocks);
  assert.equal(getSelectedRoomLineText(pq), answer.answer);
  assert.deepEqual(extractQuotes(blocks), [answer.answer]);
});

const originalLoad = (Module as any)._load;
let responses: any[] = [];
const calls: any[] = [];
(Module as any)._load = function(id: string, ...rest: any[]) {
  if (id === '@anthropic-ai/sdk') return class { messages = { create: async (args: any) => { calls.push(args); return { content: [{ type: 'text', text: (() => { const response = responses.shift(); if (response instanceof Error) throw response; return JSON.stringify(response); })() }], stop_reason: 'end_turn' }; } }; };
  if (id === './llmClient') return { callLLM: async (fn: () => Promise<unknown>) => ({ ok: true, data: await fn() }) };
  return originalLoad.call(this, id, ...rest);
};
const { generateFolioLines, resolveFolioDraft } = require('../src/lib/posting/generateFolioLines');
(Module as any)._load = originalLoad;

async function main() {
  check('invented source id and unchanged or quoted output are rejected', () => {
    const sources = folioRewriteSources('Dining Room', [answer], direct);
    assert.deepEqual(resolveFolioDraft({ alternatives: [{ text: line.text, sourceIds: ['fake'] }] }, sources), []);
    assert.deepEqual(resolveFolioDraft({ alternatives: [{ text: answer.answer, sourceIds: ['q1'] }] }, sources), []);
    assert.deepEqual(resolveFolioDraft({ alternatives: [{ text: '“A fabricated quote.”', sourceIds: ['q1'] }] }, sources), []);
  });
  check('teasers can cite multiple public room answers and retain each source', () => {
    const other = { ...answer, questionId: 'q2', answer: 'Black accents on the chairs balance the brightness.' };
    const sources = folioTeaserSources('Dining Room', [answer, other, { ...other, questionId: 'private', category: 'big_idea' as any }], direct);
    assert.equal(sources.length, 2);
    const text = 'A glass table preserves openness, with black accents balancing the bright dining room.';
    const resolved = resolveFolioDraft({ alternatives: [{ text, sourceIds: ['q1', 'q2'] }] }, sources);
    assert.equal(resolved[0].sources.length, 2);
    assert.ok(folioLinesMatchSources(resolved, 'Dining Room', [answer, other]));
    assert.deepEqual(resolveFolioDraft({ alternatives: [{ text: 'We chose the room layout.', sourceIds: ['q1'] }] }, sources), []);
  });
  responses = [{ alternatives: [{ text: line.text, sourceIds: ['q1'] }] }, { approvedIds: ['v1'] }];
  const generated = await generateFolioLines('Dining Room', [answer], 'test-project', direct);
  check('reviewed rewrite retains original text and source', () => assert.deepEqual(generated, [line]));
  check('reviewer sees original ranked quote, not only answer context', () => assert.equal(JSON.parse(calls[1].messages[0].content).versions[0].directQuote, answer.answer));
  responses = [{ alternatives: [{ text: line.text, sourceIds: ['q1'] }] }, { approvedIds: [] }];
  const rejected = await generateFolioLines('Dining Room', [answer], 'test-project', direct);
  check('semantic rejection does not fall back to unreviewed wording', () => assert.deepEqual(rejected, []));
  const extraAnswer = { ...answer, questionId: 'q2', answer: 'Black chairs balance the bright room.' };
  const moreLines = ['The dining room keeps an open view through the table.', 'Black chairs punctuate the bright dining room.', 'Transparency guides the table choice in this dining room.'];
  responses = [{ alternatives: [{ text: line.text, sourceIds: ['q1'] }] }, { approvedIds: ['v1'] },
    { alternatives: moreLines.map(text => ({ text, sourceIds: ['q1', 'q2'] })) }, { approvedIds: ['v1', 'v2', 'v3'] }];
  const toppedUp = await generateFolioLines('Dining Room', [answer, extraAnswer], 'test-project', direct, [], ['Room article context.']);
  check('a second grounded batch tops up rich room evidence without losing approved choices', () => {
    assert.equal(toppedUp.length, 4);
    assert.equal(toppedUp[0].text, line.text);
    const retry = JSON.parse(calls[calls.length - 2].messages[0].content);
    assert.deepEqual(retry.alreadyApproved, [line.text]);
    assert.equal(retry.article, 'Room article context.');
  });
  responses = [{ alternatives: [{ text: line.text, sourceIds: ['q1'] }] }, { approvedIds: ['v1'] }, new Error('Top-up provider unavailable')];
  const retained = await generateFolioLines('Dining Room', [answer, extraAnswer], 'test-project', direct);
  check('top-up provider failure retains independently approved first batch', () => assert.deepEqual(retained, [line]));
  const before = calls.length;
  await generateFolioLines('Living Room', [answer], 'test-project', direct);
  check('missing room evidence incurs no model call', () => assert.equal(calls.length, before));

  const React = require('react');
  (globalThis as any).React = React;
  const { renderToStaticMarkup } = require('react-dom/server');
  const { PullQuotePicker } = require('../src/components/story/PullQuotePicker');
  const props = { chapterIndex: 0, projectId: 'test', onUpdate: () => {} };
  check('both authorship modes render even with no direct quotes', () => {
    const html = renderToStaticMarkup(React.createElement(PullQuotePicker, { ...props, pullQuote: null }));
    assert.ok(html.includes('Your words') && html.includes('Written by Folio'));
    assert.ok(!html.includes('aria-disabled'));
    assert.ok(html.includes('Choose your room') && html.includes('social'));
  });
  check('Folio preview is a paragraph while direct quote is a blockquote', () => {
    const html = renderToStaticMarkup(React.createElement(PullQuotePicker, { ...props, pullQuote: { ...direct, authorship: 'folio', folio: { selected: line, alternatives: [line] } } }));
    assert.ok(html.includes(line.text)); assert.ok(!html.includes('<blockquote'));
    const verbatim = renderToStaticMarkup(React.createElement(PullQuotePicker, { ...props, pullQuote: direct }));
    assert.ok(verbatim.includes('<blockquote'));
  });
  let ownerContext: any = null;
  (Module as any)._load = function(id: string, ...rest: any[]) {
    if (id === './StoryEditContext') return {
      useStoryEdit: () => ownerContext,
      StoryEditRegion: ({ children }: any) => React.createElement('div', null, children),
    };
    if (id === '@/components/posting/editing/EditableParagraph') return function TestParagraph({ text }: any) { return React.createElement('p', null, text); };
    if (id === '@/components/posting/editing/SectionFeedback') return () => null;
    return originalLoad.call(this, id, ...rest);
  };
  const { QuoteTile } = require('../src/components/story/QuoteTile');
  (Module as any)._load = originalLoad;
  const tileProps = { roomLabel: 'Dining Room', pullQuote: line.text, pullQuoteSelection: { ...direct, authorship: 'folio', folio: { selected: line, alternatives: [line] } }, attribution: 'Designer Name', productCount: 0, onClick: () => {}, isExpanded: false, reducedMotion: true, chapterIndex: 0, editorialNarrative: 'Room article body.' };
  check('published tile identifies Folio wording without quotation or designer byline', () => {
    const html = renderToStaticMarkup(React.createElement(QuoteTile, tileProps));
    assert.ok(html.includes(line.text) && html.includes('Written by Folio'));
    assert.ok(!html.includes('<blockquote') && !html.includes('Designer Name'));
  });
  ownerContext = { projectId: 'test', isEdited: () => false, isEditing: () => false, hasHistory: () => false };
  check('owner tile puts the quote picker between room label and article', () => {
    const html = renderToStaticMarkup(React.createElement(QuoteTile, tileProps));
    assert.ok(html.indexOf('Dining Room') < html.indexOf('Your words'));
    assert.ok(html.indexOf(line.text) < html.indexOf('Room article body.'));
  });

  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const root = createRoot(document.getElementById('root'));
  const requests: any[] = [];
  (globalThis as any).fetch = async (url: string, options: any) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ ok: true }) }; };
  await act(async () => { root.render(React.createElement(PullQuotePicker, { ...props, pullQuote: direct })); });
  await act(async () => { Array.from(document.querySelectorAll('button')).find((b: any) => b.textContent === 'Written by Folio')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('Written by Folio calls only the room-version endpoint', () => {
    assert.ok(requests[0].url.endsWith('/sections/folio-lines')); assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].body.chapterIndex, 0);
  });
  await act(async () => { root.render(React.createElement(PullQuotePicker, { ...props, pullQuote: { ...direct, authorship: 'folio', folio: { selected: line, alternatives: [line] } } })); });
  await act(async () => { Array.from(document.querySelectorAll('button')).find((b: any) => b.textContent === 'Your words')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('switching back sends mode only and preserves the original selection', () => {
    assert.equal(requests[1].method, 'PATCH'); assert.equal(requests[1].body.authorship, 'verbatim'); assert.ok(!('selectedText' in requests[1].body));
  });
  const secondQuote = 'The black chairs balance the brightness.';
  await act(async () => root.render(React.createElement(PullQuotePicker, { ...props, pullQuote: { ...direct, alternatives: [...direct.alternatives, { text: secondQuote, score: 9 }] } })));
  await act(async () => { Array.from(document.querySelectorAll('button')).find((b: any) => b.textContent === 'Browse all 2 options')!.click(); });
  check('all quote choices are discoverable with explicit selection state', () => {
    assert.equal(document.querySelectorAll('[aria-label="Room opening line options"] button').length, 2);
    assert.equal(document.querySelector('[aria-label="Room opening line options"] button')!.getAttribute('aria-pressed'), 'true');
  });
  await act(async () => { const buttons = document.querySelectorAll('[aria-label="Room opening line options"] button'); (buttons[1] as HTMLButtonElement).click(); });
  check('selecting a visible alternative persists that exact quote', () => assert.equal(requests.at(-1).body.selectedText, secondQuote));
  await act(async () => root.unmount());
  dom.window.close();
  console.log(`${passed} Folio version checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
