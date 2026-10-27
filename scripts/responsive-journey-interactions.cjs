// Behavioral contracts for the actual journey components, not spacing snapshots.
const assert = require('node:assert/strict');

module.exports = async function interactions({ page, go, capture, requests, results }) {
  const check = async (name, run) => { await run(); results.push({ interaction: name, passed: true }); console.log('PASS ' + name); };
  const clickText = async text => {
    const buttons = await page.$$('button');
    for (const button of buttons) if ((await button.evaluate(e => e.textContent.trim())) === text) { await button.click(); return; }
    throw new Error('Missing button: ' + text);
  };
  await page.setViewport({ width: 390, height: 460, hasTouch: true });
  await check('Dialog traps focus, preserves native space typing, scrolls to the action and restores focus', async () => {
    await go('dialog'); await page.waitForSelector('[role=dialog]');
    await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true });
    await page.click('#opener'); await page.waitForSelector('[role=dialog] input');
    assert(await page.$eval('[role=dialog]', e => e.contains(document.activeElement)));
    await page.type('[role=dialog] input', 'A room with space');
    assert.equal(await page.$eval('[role=dialog] input', e => e.value), 'A room with space');
    for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); assert(await page.$eval('[role=dialog]', e => e.contains(document.activeElement))); }
    await page.$eval('[role=dialog] button', e => e.focus());
    assert(await page.$eval('[role=dialog] button', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await capture('dialog-short-action', 390);
    await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true });
    // Radix restores focus on its deferred unmount, after the dialog disappears.
    await page.waitForFunction(() => document.activeElement.id === 'opener', { timeout: 2000 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  });
  await check('Photo viewer fits a short viewport, exposes captions, navigates and restores focus', async () => {
    await go('lightbox'); await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true });
    await page.click('#opener'); await page.waitForSelector('[role=dialog]');
    await page.keyboard.press('ArrowRight');
    assert.match(await page.$eval('[role=status]', e => e.textContent), /2 \/ 3/);
    await page.$eval('[role=status]', e => e.scrollIntoView()); await capture('lightbox-short-caption', 390);
    assert(await page.$eval('[role=dialog]', e => e.scrollHeight > e.clientHeight));
    await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true });
    await page.waitForFunction(() => document.activeElement.id === 'opener', { timeout: 2000 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
  });
  await check('Nested dialog closes only its own layer and a controlled unsaved-work guard retains text', async () => {
    await go('nested-dialog'); await page.click('#outer-opener');
    await page.type('#guarded-value', 'Keep my unsaved room');
    await page.click('#inner-opener'); await page.waitForSelector('input[aria-label="Nested search"]');
    await page.type('input[aria-label="Nested search"]', 'A chair with space');
    await page.keyboard.press('Escape'); await page.waitForSelector('input[aria-label="Nested search"]', { hidden: true });
    await page.waitForFunction(() => document.activeElement.id === 'inner-opener', { timeout: 2000 });
    assert.equal(await page.$eval('#guarded-value', e => e.value), 'Keep my unsaved room');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => document.body.textContent.includes('Discard unsaved changes?'));
    await clickText('Keep editing'); await page.waitForFunction(() => !document.body.textContent.includes('Discard unsaved changes?'));
    assert.equal(await page.$eval('#guarded-value', e => e.value), 'Keep my unsaved room');
    await capture('nested-dialog-retained', 390);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => document.body.textContent.includes('Discard unsaved changes?'));
    await clickText('Discard changes'); await page.waitForSelector('[role=dialog]', { hidden: true });
    await page.waitForFunction(() => document.activeElement.id === 'outer-opener', { timeout: 2000 });
  });
  await check('Import dialog keeps its footer reachable while the body scrolls in a short viewport', async () => {
    await go('glass-modal'); await page.waitForSelector('[role=dialog]');
    await page.$$eval('[role=dialog] input',inputs=>inputs.at(-1).focus());
    assert(await page.$$eval('[role=dialog] input',inputs=>{const r=inputs.at(-1).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
    assert(await page.$eval('[role=dialog] button',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
    assert(await page.$eval('[role=dialog]',e=>[...e.querySelectorAll('div')].some(d=>getComputedStyle(d).overflowY==='auto'&&d.scrollHeight>d.clientHeight)));
    await capture('import-dialog-short',390);
    await clickText('Continue import'); await page.waitForSelector('[role=dialog]',{hidden:true});
  });
  await page.setViewport({ width: 390, height: 844, hasTouch: true });
  await check('Portrait preview preserves image proportions and pin coordinates across resizing', async () => {
    await go('tagging');
    const geometry = () => page.$eval('button img[src="/portrait.svg"]', image => {
      const photo = image.getBoundingClientRect(), pin = image.parentElement.querySelector('span').getBoundingClientRect();
      return { ratio: photo.width / photo.height, x: (pin.x + pin.width / 2 - photo.x) / photo.width * 100, y: (pin.y + pin.height / 2 - photo.y) / photo.height * 100 };
    });
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewport({ width, height: 844, hasTouch: width < 768 });
      const g = await geometry(); assert(Math.abs(g.ratio - 2 / 3) < .01, JSON.stringify(g));
      assert(Math.abs(g.x - 25) < 1 && Math.abs(g.y - 35) < 1, JSON.stringify(g));
    }
  });
  await check('Touch pin placement and dragging save normalized coordinates; keyboard adjustment is available', async () => {
    await page.setViewport({ width: 390, height: 844, hasTouch: true }); await go('tagging');
    await page.$eval('button img[src="/portrait.svg"]', e => e.parentElement.click());
    await page.waitForSelector('img.cursor-crosshair');
    await page.$eval('img.cursor-crosshair', e => e.scrollIntoView({ block: 'start' }));
    let box = await (await page.$('img.cursor-crosshair')).boundingBox();
    await page.touchscreen.tap(box.x + box.width * .65, box.y + box.height * .4);
    await page.waitForSelector('[aria-label="Search products"]');
    const coordinates = await page.evaluate(() => document.body.textContent.match(/Position: ([\d.]+)%, ([\d.]+)%/).slice(1).map(Number));
    assert(Math.abs(coordinates[0] - 65) < 1 && Math.abs(coordinates[1] - 40) < 1, coordinates.join(','));
    await capture('tagging-touch-picker', 390);
    await clickText('Paste a link');
    await page.type('[aria-label="Product link"]', 'https://example.test/a-very-long-product-address-that-must-not-widen-the-picker');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await capture('tagging-link', 390);
    await page.$eval('[aria-label="Cancel product selection"]', e => e.scrollIntoView({ block: 'center' }));
    await page.click('[aria-label="Cancel product selection"]');
    await page.waitForSelector('[aria-label="Search products"]', { hidden: true });
    const selector = 'button[aria-label^="Move Handcrafted"]';
    await page.$eval(selector, e => e.scrollIntoView({ block: 'center' }));
    box = await (await page.$('img.cursor-crosshair')).boundingBox();
    const pin = await (await page.$(selector)).boundingBox();
    const client = await page.createCDPSession();
    const point = { x: pin.x + pin.width / 2, y: pin.y + pin.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * .55, y: box.y + box.height * .45 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => window.fixtureTagWrites?.length > 0);
    const move = requests.filter(r => r.path === '/api/tag-product-to-image' && r.method === 'PATCH').at(-1);
    const saved = JSON.parse(move.body); assert(Math.abs(saved.x - 55) < 1 && Math.abs(saved.y - 45) < 1, move.body);
    await page.focus(selector); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.fixtureTagWrites.length > 1);
    const keyboard = JSON.parse(requests.filter(r => r.path === '/api/tag-product-to-image').at(-1).body);
    assert.equal(keyboard.x, 26); assert.equal(keyboard.y, 35);
    await client.detach();
  });
  await check('Room actions are visible without hover and assigned photos have keyboard/tap room controls', async () => {
    await go('rooms');
    assert(await page.$eval('[aria-label="View full photo"]', e => getComputedStyle(e).opacity === '1'));
    assert(await page.$eval('[aria-label="Room for Photo 1"]', e => e.options.length === 2));
    await page.select('[aria-label="Room for Photo 1"]', 'kitchen');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewport({width:768,height:1024,hasTouch:true});
    assert(await page.$eval('[aria-label="View full photo"]', e => getComputedStyle(e).opacity === '1'));
    await page.setViewport({width:390,height:844,hasTouch:true});
  });
  await check('Product editor failure offers retry and success exposes a reachable Save action', async () => {
    await go('product-editor', 'error'); await page.waitForSelector('[role=alert]');
    await capture('product-editor-error', 390); await clickText('Try again'); await page.waitForSelector('[role=alert]');
    await go('product-editor'); await page.waitForSelector('[role=dialog] input');
    await page.setViewport({ width: 390, height: 460 });
    await clickText('Save'); await page.waitForSelector('[role=dialog]', { hidden: true });
    assert.match(await page.evaluate(() => document.body.textContent), /Product saved/);
  });
  await check('Studio tabs respond to keyboard; its pitch dialog closes and returns focus', async () => {
    await page.setViewport({ width: 360, height: 844 }); await go('studio');
    await page.focus('[role=tab]'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.$eval('#studio-tab-progress', e => e.getAttribute('aria-selected')), 'true');
    await page.keyboard.press('ArrowLeft');
    await page.waitForSelector('button');
    await clickText('Filter');
    await page.waitForSelector('dialog'); await capture('studio-pitch', 360);
    assert(await page.$eval('dialog', e => e.getBoundingClientRect().width <= innerWidth));
    await page.keyboard.press('Escape'); await page.waitForSelector('dialog', { hidden: true });
  });
  await check('Reduced-motion preference removes CSS animation and transition motion', async () => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await go('create');
    assert(await page.$eval('button', e => parseFloat(getComputedStyle(e).transitionDuration) < .001));
    await page.emulateMediaFeatures([]);
  });
  await check('Public product drawer scrolls, traps focus and restores focus at every viewport', async () => {
    for (const width of [360,390,768,1440]) {
      await page.setViewport({width,height:width===1440?1000:844,hasTouch:width<1024}); await go('public-sheet');
      await page.waitForSelector('[role=dialog]');
      assert.equal(await page.$$eval('[role=dialog]',e=>e.length),1);
      assert(await page.$eval('[role=dialog]',e=>!['rgba(0, 0, 0, 0)','transparent'].includes(getComputedStyle(e).backgroundColor)), 'Drawer needs a readable surface over the page');
      await page.$eval('[role=dialog] a',e=>e.focus());
      assert(await page.$eval('[role=dialog] a',e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight && r.top>=0;}));
      await page.keyboard.press('Tab'); assert(await page.$eval('[role=dialog]',e=>e.contains(document.activeElement)));
      await capture('public-sheet-scroll',width);
      await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]',{hidden:true});
      // Disappearance precedes modal pointer-lock cleanup. Require a real hit
      // target, then let the locator wait for stable layout before reopening.
      await page.waitForFunction(() => {
        const opener = document.getElementById('opener'), rect = opener.getBoundingClientRect();
        return getComputedStyle(document.body).pointerEvents !== 'none'
          && opener.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }, { timeout: 2000 });
      await page.locator('#opener').click(); await page.waitForSelector('[role=dialog]');
      // Radix registers the modal layer after mount/autofocus. Escape belongs to
      // that layer only after the outside page is locked and the drawer is interactive.
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role=dialog]');
        return dialog?.contains(document.activeElement)
          && getComputedStyle(document.body).pointerEvents === 'none'
          && getComputedStyle(dialog).pointerEvents === 'auto';
      }, { timeout: 2000 });
      // The layer's Escape callback ref is refreshed in a passive effect. Allow
      // the committed modal state to paint before dispatching the next key.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      console.log('PASS reopened product drawer accepts keyboard focus at ' + width + 'px');
      await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]',{hidden:true});
      await page.waitForFunction(() => document.activeElement.id === 'opener', { timeout: 2000 });
      assert.equal(await page.evaluate(()=>document.activeElement.id),'opener');
    }
  });
  await check('Public profile loading, empty and error states are distinct', async () => {
    await page.setViewport({width:360,height:844});
    for(const state of ['loading','empty','error']) {
      await go('profile-feed',state);
      if(state==='loading') assert(await page.$('[role=status][aria-label="Loading profile"]'));
      if(state==='empty') assert.match(await page.evaluate(()=>document.body.textContent),/No content yet/);
      await capture('profile-feed-'+state,360);
    }
    assert(await page.$('[role=alert]')); await clickText('Try again'); await page.waitForSelector('[role=alert]');
  });
};
