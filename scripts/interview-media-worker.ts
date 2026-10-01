import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const { processOneMediaJob } = require('../src/lib/interview-media/worker');
  const { nativeCommand } = require('../src/lib/interview-media/render');
  const { assertCaptureStorageReady } = require('../src/lib/interview-media/storage');
  await nativeCommand('ffmpeg', ['-version'], process.cwd());
  await nativeCommand('ffprobe', ['-version'], process.cwd());
  console.log('Standalone worker imports, FFmpeg and FFprobe verified.');
  if (process.argv.includes('--check-native')) return;
  await assertCaptureStorageReady();
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for recording-aligned transcription.');
  let stopped = false;
  process.on('SIGTERM', () => { stopped = true; });
  process.on('SIGINT', () => { stopped = true; });
  console.log('Folio media worker ready; concurrency=1. Native dependencies verified.');
  if (process.argv.includes('--check')) return;
  do {
    const worked = await processOneMediaJob();
    if (process.argv.includes('--once')) break;
    if (!worked) await new Promise(resolve => setTimeout(resolve, 3000));
  } while (!stopped);
}
main().catch(error => {
  console.error('Media worker stopped. Check private database/storage, OpenAI configuration and FFmpeg/FFprobe installation.');
  console.error(error instanceof Error ? error.name : 'UnknownError');
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') console.error(error.message);
  if (process.argv.includes('--check') && error instanceof Error) console.error(error.stack?.split('\n').slice(1, 5).join('\n'));
  process.exitCode = 1;
});
