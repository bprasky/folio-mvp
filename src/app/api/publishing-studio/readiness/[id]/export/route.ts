import { NextRequest, NextResponse } from 'next/server';
import { renderApprovedImage } from '@/lib/publishing-studio/readiness/render-image';
import { z } from 'zod';
import { currentCandidate, ReadinessError } from '@/lib/publishing-studio/readiness/service';
import { appendEvent } from '@/lib/publishing-studio/readiness/store';
import { readinessActor, readinessFailure } from '@/lib/publishing-studio/readiness/http';
export const maxDuration = 120;
const schema = z.object({ version: z.number().int().positive(), sourceVersion: z.string().length(64) }).strict();

/** Exact reviewed package, including cross-project stories; no filler/CTA slides. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await readinessActor(); const body = schema.safeParse(await request.json());
    if (!body.success) throw new ReadinessError('Refresh this story before exporting.');
    const candidate = await currentCandidate(userId, params.id, body.data.version, body.data.sourceVersion);
    if (candidate.readiness !== 'ready' || candidate.dismissed) throw new ReadinessError('Finish the remaining steps before exporting.', 409);
    const images = [];
    for (const [index, image] of Array.from(candidate.visuals.entries())) {
      const buffer = await renderApprovedImage(image.url, 1080, 1350, image.projectId);
      images.push({ name: `${String(index + 1).padStart(2, '0')}.jpg`, dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}` });
    }
    const fresh = await currentCandidate(userId, candidate.id, candidate.version, candidate.sourceVersion);
    await appendEvent(fresh, 'exported', { destination: 'download', imageIds: candidate.visuals.map(image => image.id) });
    return NextResponse.json({ images, filename: `folio-story-${candidate.id.slice(-10)}.zip`,
      caption: `${candidate.draft.caption}\n\nDesign: ${candidate.draft.credits.designer}\nPhotography: ${candidate.draft.credits.photographer}` });
  } catch (error) { return readinessFailure(error); }
}
