import { config } from 'dotenv';
import { protectedProductHtml } from '../../src/lib/browserless/protected-product';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

async function main() {
  try {
    const html = await protectedProductHtml('https://example.com');
    if (!html?.includes('Example Domain')) throw new Error('No expected content');
    console.log('PASS: protected Browserless rendered public HTML with verified launch controls');
  } catch (error) {
    // Connection errors can contain the credential-bearing websocket URL.
    const message = error instanceof Error ? error.message : '';
    const safe = message.startsWith('Browser egress controls unavailable:') ? message :
      message.includes('401') ? 'service authorization rejected' :
      message.includes('403') ? 'service rejected launch settings' :
      message.includes('getBrowserCommandLine') ? 'cannot verify actual launch controls' : 'render or connection failed';
    console.error(`FAIL: ${safe}`);
    process.exitCode = 1;
  }
}
void main();
