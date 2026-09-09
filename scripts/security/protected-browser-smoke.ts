import { config } from 'dotenv';
import { renderProductPage } from '../../src/lib/server/render-product';
config({ path: '.env.local', quiet: true }); config({ quiet: true });
async function main() {
  try {
    const page = await renderProductPage('https://example.com');
    if (!page?.html.includes('Example Domain') || page.status !== 200) throw Error();
    console.log('PASS: worker returned public rendered HTML. This smoke does not prove network isolation.');
  } catch { console.error('FAIL: worker unavailable or unexpected content; no endpoint/token is printed.'); process.exitCode = 1; }
}
void main();
