const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const sharp = require('sharp');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

(async () => {
  const directory = path.resolve('.tmp/photo-intake'); await fs.mkdir(directory, { recursive: true });
  await esbuild.build({ stdin: { contents: `import { prepareProjectPhoto } from './src/lib/files/prepareProjectPhoto'; window.prepare = prepareProjectPhoto;`, resolveDir: process.cwd() }, bundle: true, platform: 'browser', outfile: path.join(directory, 'helper.js'), alias: { '@': path.resolve('src') } });
  // A repeatable high-detail photographic gradient: no private images needed.
  const width = 4096, height = 3072, pixels = Buffer.alloc(width * height * 3); let seed = 173;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const noise = ((seed >>> 24) - 128) * .27;
    const i = (y * width + x) * 3; pixels[i] = 40 + x / width * 170 + noise; pixels[i + 1] = 60 + y / height * 130 + noise; pixels[i + 2] = 110 + noise;
  }
  const original = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).withExif({ IFD0: { Artist: 'PRIVATE_FIXTURE' } }).toBuffer();
  assert.ok(original.length > 3 * 1024 * 1024 && original.length < 32 * 1024 * 1024);
  const fixtures = [];
  for (const format of ['jpeg', 'png', 'webp']) { const buffer = await sharp(original).resize(800, 600).toFormat(format).toBuffer(); const file = path.join(directory, 'small.' + format); await fs.writeFile(file, buffer); fixtures.push({ file, buffer, mime: 'image/' + format }); }
  const large = path.join(directory, 'large.jpg'); await fs.writeFile(large, original);
  const corrupt = path.join(directory, 'corrupt.jpg'); await fs.writeFile(corrupt, 'not an image');
  const dimensions = Buffer.from(fixtures[1].buffer); dimensions.writeUInt32BE(10000, 16); dimensions.writeUInt32BE(10000, 20); const oversized = path.join(directory, 'dimensions.png'); await fs.writeFile(oversized, dimensions);
  const script = await fs.readFile(path.join(directory, 'helper.js'));
  const server = http.createServer((req, res) => { if (req.url === '/helper.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(script); } else { res.setHeader('Content-Type', 'text/html'); res.end('<input type="file"><script src="/helper.js"></script>'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ executablePath: process.env.GUIDED_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const prepare = async file => { await (await page.$('input')).uploadFile(file); return page.evaluate(async () => { const file = document.querySelector('input').files[0]; try { const result = await window.prepare(file), again = await window.prepare(file); const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(result.file); }); return { width: result.width, height: result.height, size: result.file.size, original: result.file === file, stable: again.file === result.file, notice: result.notice, data }; } catch (error) { return { error: error.message }; } }); };
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const fixture of fixtures) { const actual = await prepare(fixture.file); assert.equal(actual.original, true); assert.equal(actual.stable, true); assert.deepEqual(Buffer.from(actual.data.split(',')[1], 'base64'), fixture.buffer); }
    const result = await prepare(large); assert.ok(!result.error, result.error); assert.ok(result.size <= 3 * 1024 * 1024); assert.ok(result.width >= 1600 && result.width <= 3200); assert.equal(result.stable, true); assert.match(result.notice, /original is unchanged/);
    const output = Buffer.from(result.data.split(',')[1], 'base64'); await fs.writeFile(path.join(directory, 'prepared.jpg'), output);
    const stored = await sharp(output).rotate().jpeg({ quality: 90 }).toBuffer(); await fs.writeFile(path.join(directory, 'stored.jpg'), stored);
    const meta = await sharp(stored).metadata(); assert.equal(meta.width, result.width); assert.equal(meta.height, result.height); assert.equal(meta.exif, undefined);
    const originalSmall = await sharp(original).resize(800, 600).raw().toBuffer(); const storedSmall = await sharp(stored).resize(800, 600).raw().toBuffer();
    let squared = 0; for (let i = 0; i < originalSmall.length; i++) squared += (originalSmall[i] - storedSmall[i]) ** 2;
    const psnr = 10 * Math.log10(255 ** 2 / (squared / originalSmall.length)); assert.ok(psnr > 30, `PSNR ${psnr}dB below editorial fixture threshold`);
    assert.match((await prepare(corrupt)).error, /supported|decode|corrupt|read/i);
    assert.match((await prepare(oversized)).error, /dimensions|megapixel|40|large/i);
    const report = { smallFormats: ['jpeg', 'png', 'webp'], originalBytes: original.length, preparedBytes: result.size, width: meta.width, height: meta.height, previewPSNR: psnr, metadataStripped: true, identityStable: true, corruptRejected: true, oversizedDimensionsRejected: true };
    await fs.writeFile(path.join(directory, 'results.json'), JSON.stringify(report, null, 2)); console.log('PASS real Chrome photo intake', report);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
