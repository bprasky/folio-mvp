// Native processing is imported only by the long-running worker and fixture tests.
import { spawn } from 'node:child_process';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { EditPlan, Capture, MediaRecord } from './types';
import { MediaError } from './types';

export function nativeCommand(binary: 'ffmpeg' | 'ffprobe', args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const executable = process.env[binary === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'] || binary;
    const child = spawn(executable, args, { cwd, windowsHide: true, shell: false, signal, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', diagnostics = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 12 * 60 * 1000);
    child.stdout.on('data', chunk => { output += String(chunk); if (output.length > 4 * 1024 * 1024) child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-2000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new MediaError(`Media processing failed (${binary}, ${code}). ${diagnostics.slice(-250)}`)); });
  });
}
export async function probeMedia(file: string, cwd: string, videoRequired: boolean, signal?: AbortSignal) {
  const info = JSON.parse(await nativeCommand('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', file], cwd, signal));
  const durationMs = Math.round(Number(info.format?.duration) * 1000);
  const hasVideo = info.streams?.some((s: { codec_type: string }) => s.codec_type === 'video') || false;
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !info.streams?.some((s: { codec_type: string }) => s.codec_type === 'audio') || (videoRequired && !hasVideo))
    throw new MediaError('The recording has no playable audio or required video.');
  // Decode every packet; ffprobe metadata alone is insufficient to prove playability.
  await nativeCommand('ffmpeg', ['-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-i', file, '-threads', '2', '-f', 'null', '-'], cwd, signal);
  return { durationMs, hasVideo };
}
export const encodeBase = ['-y', '-v', 'error', '-nostdin', '-max_alloc', '67108864', '-threads', '2', '-filter_threads', '1'];
export async function normalizeCapture(input: string, output: string, video: boolean, cwd: string, signal?: AbortSignal) {
  const container = input.endsWith('.webm') ? 'matroska' : 'mov';
  const metadata = JSON.parse(await nativeCommand('ffprobe', ['-v', 'error', '-max_alloc', '67108864', '-protocol_whitelist', 'file,pipe',
    '-f', container, '-show_streams', '-of', 'json', input], cwd, signal));
  if (!Array.isArray(metadata.streams) || metadata.streams.length > 4 || metadata.streams.some((stream: { width?: number; height?: number; channels?: number }) =>
    (stream.width || 0) * (stream.height || 0) > 3840 * 2160 || (stream.channels || 0) > 2)) throw new MediaError('The capture exceeds supported recording dimensions or tracks.');
  if (!video && metadata.streams.some((stream: { codec_type?: string }) => stream.codec_type === 'video')) throw new MediaError('Video tracks cannot be accepted for voice-only recording.');
  await nativeCommand('ffmpeg', [...encodeBase, '-protocol_whitelist', 'file,pipe', '-f', container, '-i', input,
    '-map', '0:a:0', ...(video ? ['-map', '0:v:0', '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2', '-r', '25', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p'] : ['-vn']),
    '-c:a', 'aac', '-ar', '48000', '-ac', '1', '-b:a', '96k', '-movflags', '+faststart', output], cwd, signal);
  return probeMedia(output, cwd, video, signal);
}
function timestamp(ms: number) {
  const n = Math.max(0, Math.round(ms));
  return `${String(Math.floor(n / 3600000)).padStart(2, '0')}:${String(Math.floor(n / 60000) % 60).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')},${String(n % 1000).padStart(3, '0')}`;
}
const captionText = (text: string) => text.replace(/[\r\n]/g, ' ').replace(/[<>{}]/g, '').trim();
/** Captions use recorded segment timestamps; live receipt times never enter this renderer. */
export async function renderEditPlan(plan: EditPlan, captures: MediaRecord<Capture>[], sourceFiles: Map<string, string>, imageFiles: Map<string, string>, cwd: string, signal?: AbortSignal) {
  const width = plan.aspect === 'portrait' ? 720 : 1280, height = plan.aspect === 'portrait' ? 1280 : 720;
  let elapsed = 0;
  const chapters = [';FFMETADATA1', `title=${plan.title.replace(/[\r\n=;#\\]/g, ' ')}`, `comment=${plan.credits.replace(/[\r\n=;#\\]/g, ' ')}`];
  for (const [index, scene] of Array.from(plan.scenes.entries())) {
    const run = captures.find(c => c.id === scene.captureId)!;
    const duration = (scene.endMs - scene.startMs) / 1000;
    const srt = run.payload.transcript!.filter(s => scene.captionOrders.includes(s.order)).map((s, i) => `${i + 1}\n${timestamp(s.startMs - scene.startMs)} --> ${timestamp(s.endMs - scene.startMs)}\n${captionText(s.text)}\n`).join('\n');
    // Credits, destination and chapter are rendered as real text, never interpreted as a filter expression.
    const attribution = [plan.title, scene.chapter, plan.credits, plan.destination || 'Folio · private draft'].filter(Boolean).join(' · ');
    await writeFile(join(cwd, `captions${index}.srt`), srt + `\n9999\n00:00:00,000 --> ${timestamp(duration * 1000)}\n${captionText(attribution)}\n`);
    const inputs = ['-ss', String(scene.startMs / 1000), '-t', String(duration), '-protocol_whitelist', 'file,pipe', '-i', sourceFiles.get(scene.captureId)!];
    const image = scene.imageId ? imageFiles.get(scene.imageId) : undefined;
    if (image) inputs.push('-loop', '1', '-i', image);
    const visual = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-ow)*${scene.focalX}:(ih-oh)*${scene.focalY},setsar=1,subtitles=captions${index}.srt:force_style='FontName=Inter,FontSize=16,PrimaryColour=&H00FFFFFF,Outline=1,MarginV=28'`;
    await nativeCommand('ffmpeg', [...encodeBase, ...inputs, '-t', String(duration), '-map', '0:a:0',
      ...(plan.format === 'audio' ? ['-vn'] : ['-map', image ? '1:v:0' : '0:v:0', '-vf', visual, '-r', '25', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p']),
      '-c:a', 'aac', '-ar', '48000', '-ac', '1', '-b:a', '128k', '-movflags', '+faststart', `scene${index}.mp4`], cwd, signal);
    chapters.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${elapsed}`, `END=${elapsed + duration * 1000}`, `title=${captionText(scene.chapter || `Segment ${index + 1}`).replace(/[=;#\\]/g, ' ')}`);
    elapsed += duration * 1000;
  }
  await writeFile(join(cwd, 'concat.txt'), plan.scenes.map((_, i) => `file 'scene${i}.mp4'`).join('\n'));
  await writeFile(join(cwd, 'chapters.txt'), chapters.join('\n'));
  const output = plan.format === 'audio' ? 'output.m4a' : 'output.mp4';
  await nativeCommand('ffmpeg', [...encodeBase, '-f', 'concat', '-safe', '1', '-i', 'concat.txt', '-f', 'ffmetadata', '-i', 'chapters.txt', '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', output], cwd, signal);
  const info = await probeMedia(output, cwd, plan.format !== 'audio', signal);
  if (Math.abs(info.durationMs - elapsed) > 1200) throw new MediaError('Rendered duration did not match the approved edit plan.');
  const preview = plan.format === 'audio' ? 'preview.m4a' : 'preview.mp4';
  if (plan.format === 'audio') {
    // Audible draft marker prevents private preview from becoming a clean export endpoint.
    await nativeCommand('ffmpeg', [...encodeBase, '-i', output, '-f', 'lavfi', '-i', `sine=frequency=880:duration=${info.durationMs / 1000}`,
      '-filter_complex', "[1:a]volume=0.10:enable='lt(mod(t,10),0.35)'[mark];[0:a][mark]amix=inputs=2:duration=first:normalize=0[out]",
      '-map', '[out]', '-c:a', 'aac', '-b:a', '64k', preview], cwd, signal);
  } else {
    await writeFile(join(cwd, 'watermark.srt'), `1\n00:00:00,000 --> ${timestamp(info.durationMs)}\nPRIVATE PREVIEW\n`);
    await nativeCommand('ffmpeg', [...encodeBase, '-i', output, '-vf', "scale=640:-2,subtitles=watermark.srt:force_style='FontName=Inter,FontSize=26,Alignment=8,MarginV=20'",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', preview], cwd, signal);
  }
  await probeMedia(preview, cwd, plan.format !== 'audio', signal);
  return { output: join(cwd, output), preview: join(cwd, preview), durationMs: info.durationMs, mimeType: plan.format === 'audio' ? 'audio/mp4' : 'video/mp4' };
}
export async function boundedFile(file: string, max: number) {
  if ((await stat(file)).size > max) throw new MediaError('The rendered file exceeds the configured private storage limit.');
  return readFile(file);
}
