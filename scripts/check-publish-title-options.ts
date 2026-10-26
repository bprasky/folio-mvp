import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { usePublishFlow, type UsePublishFlowReturn } from '../src/hooks/usePublishFlow';

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const reply = (status: number, body: unknown) => Response.json(body, { status });

async function scenario(name: string, generationStatus: number, titleStatus: number | 'network') {
  const calls: { url: string; method: string; body?: string }[] = [];
  const chosenTitle = 'The house keeps its existing title';
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method || 'GET', body: init?.body as string | undefined });
    if (url.includes('/interview/generate')) return reply(generationStatus, generationStatus === 200 ? { meta: { designerBioMissing: true } } : { error: 'Generation unavailable', status: 'in_progress' });
    if (url.endsWith('/headline/regenerate')) {
      if (titleStatus === 'network') throw new Error('Network unavailable');
      return reply(titleStatus, { error: 'No supported options this time.' });
    }
    if (url.endsWith('/drafts')) return reply(200, { interview: {}, drafts: [{ id: 'draft', lead: { kicker: chosenTitle } }] });
    if (url.endsWith('/interview')) return reply(200, { answers: [] });
    return reply(200, {});
  }) as typeof fetch;
  let flow: UsePublishFlowReturn;
  function Harness() { flow = usePublishFlow('project-1'); return null; }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Harness)));
  calls.length = 0;
  await act(async () => flow.generateDraft());
  const titleCalls = calls.filter(call => call.url.endsWith('/headline/regenerate'));
  if (generationStatus !== 200) {
    assert.equal(titleCalls.length, 0);
    assert.equal(calls.filter(call => call.url.endsWith('/drafts')).length, 0);
    assert.ok(flow!.error);
  } else {
    assert.equal(titleCalls.length, 1);
    assert.equal(titleCalls[0].method, 'POST');
    assert.deepEqual(JSON.parse(titleCalls[0].body!), {});
    assert.ok(calls.findIndex(call => call.url.includes('/interview/generate')) < calls.indexOf(titleCalls[0]));
    assert.ok(calls.indexOf(titleCalls[0]) < calls.findIndex(call => call.url.endsWith('/drafts')));
    assert.equal(flow!.currentLead?.title, chosenTitle);
    assert.equal(calls.some(call => call.method === 'PATCH'), false, 'never selects or overwrites a title');
    if (titleStatus === 200) assert.equal(flow!.error, null);
    else assert.match(flow!.error!, /article was regenerated, but title options could not be prepared/);
  }
  assert.equal(flow!.regenBusy, false);
  await act(async () => root.unmount());
  console.log('PASS', name);
}

async function main() {
  await scenario('successful article prepares title options before refresh and preserves current title', 200, 200);
  await scenario('failed article does not request title options', 500, 200);
  await scenario('202 generation no-op does not request title options', 202, 200);
  await scenario('title rejection preserves article, refreshes, and reports partial success', 200, 422);
  await scenario('title network error preserves article and still refreshes', 200, 'network');
  dom.window.close();
  console.log('5 publish title option checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
