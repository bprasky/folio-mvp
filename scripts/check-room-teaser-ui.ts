import assert from 'node:assert/strict';
import Module from 'node:module';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { articleFolioLines } from '../src/lib/posting/folioLines';

(globalThis as any).React = React;
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const requests: string[] = [];
let refreshed = 0;
const router = { refresh: () => { refreshed++; } };
const originalLoad = (Module as any)._load;
(Module as any)._load = function(id: string, ...rest: any[]) {
  if (id === 'next/navigation') return { useRouter: () => router };
  return originalLoad.call(this, id, ...rest);
};
const { StoryEditProvider } = require('../src/components/story/StoryEditContext');
(Module as any)._load = originalLoad;
(globalThis as any).fetch = async (url: string) => { requests.push(url); return { ok: true }; };
const root = createRoot(document.getElementById('root')!);
const paragraph = 'The glass table keeps the dining room visually open.';
const options = articleFolioLines('Dining Room', [paragraph]);
const complete = { title: 'Dining Room', body: [paragraph], pullQuote: { selected: null, alternatives: [], authorship: 'folio', folio: { generatorVersion: 3, selected: options[0], alternatives: options } } };
const render = (chapters: unknown[]) => React.createElement(StoryEditProvider, { projectId: 'test', initialOverrides: [], chapters }, React.createElement('p', null, 'Article'));

async function main() {
  await act(async () => root.render(render([complete])));
  assert.equal(requests.length, 0, 'prepared draft makes no generation request');
  const edited = { ...complete, body: ['Black accents balance the bright dining room.'] };
  await act(async () => root.render(render([edited])));
  assert.equal(requests.length, 1, 'editing article evidence automatically prepares options');
  assert.ok(requests[0].endsWith('/sections/pull-quotes/backfill'));
  assert.equal(refreshed, 1);
  await act(async () => root.render(render([edited])));
  assert.equal(requests.length, 1, 'rendering multiple times does not issue duplicate requests');
  await act(async () => root.render(render([complete])));
  await act(async () => root.render(render([{ title: 'Dining Room', body: [paragraph], pullQuote: null }, { title: 'Living Room', body: ['A sofa faces the garden.'], pullQuote: null }])));
  assert.equal(requests.length, 2, 'legacy rooms prepare in one article-level request');
  await act(async () => root.unmount());
  dom.window.close();
  console.log('PASS draft load auto-prepares missing/stale choices once; ready drafts do not generate');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
