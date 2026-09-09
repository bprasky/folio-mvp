export const dynamic = 'force-dynamic';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { downloadMedia } from '@/lib/interviews/media';
import { transcribeRecording, extractRecordingQuotes } from '@/lib/interviews/providers';
import { validatedQuotes } from '@/lib/interviews/provenance';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const interview = await prisma.interviewSession.findUnique({ where: { id: params.id }, include: { MediaAsset: true, projects: true, products: true } });
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (interview.createdByUserId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['UPLOADED','TRANSCRIBED'].includes(interview.status)) return NextResponse.json({ error: 'Processing cannot start in this state' }, { status: 409 });
    if (!interview.MediaAsset) return NextResponse.json({ error: 'No recording asset' }, { status: 400 });
    const identity = { id: interview.id, createdByUserId: session.user.id, recordingAssetId: interview.recordingAssetId };
    if (interview.status === 'UPLOADED') {
      const job = randomUUID();
      const claimed = await prisma.interviewSession.updateMany({ where: { ...identity, status: 'UPLOADED', updatedAt: interview.updatedAt }, data: { status: 'TRANSCRIBING', transcriptionJobId: job, errorMessage: null, updatedAt: new Date() } });
      if (claimed.count !== 1) return NextResponse.json({ error: 'Interview changed; refresh before retrying' }, { status: 409 });
      const guard = { ...identity, status: 'TRANSCRIBING' as const, transcriptionJobId: job };
      try {
        const result = await transcribeRecording(await downloadMedia(interview.id, interview.MediaAsset));
        const segments = result.segments?.length ? result.segments.map(s => ({ startMs: Math.round(s.start * 1000), endMs: Math.round(s.end * 1000), text: s.text.trim() }))
          : [{ startMs: 0, endMs: Math.round(result.duration * 1000), text: result.text.trim() }];
        if (!segments.length || segments.some(s => !s.text || !Number.isSafeInteger(s.startMs) || !Number.isSafeInteger(s.endMs) || s.startMs < 0 || s.endMs <= s.startMs)) throw new Error('Invalid transcript');
        await prisma.$transaction(async tx => {
          const moved = await tx.interviewSession.updateMany({ where: guard, data: { status: 'TRANSCRIBED', transcribedAt: new Date(), transcriptionJobId: null, updatedAt: new Date() } });
          if (moved.count !== 1) throw new Error('Interview changed');
          await tx.transcriptSegment.deleteMany({ where: { interviewSessionId: interview.id } });
          await tx.transcriptSegment.createMany({ data: segments.map((s, order) => ({ ...s, order, id: randomUUID(), interviewSessionId: interview.id, speaker: 'designer' })) });
        });
      } catch {
        await prisma.interviewSession.updateMany({ where: guard, data: { status: 'UPLOADED', transcriptionJobId: null, errorMessage: 'Transcription failed. Please retry.', updatedAt: new Date() } });
        return NextResponse.json({ error: 'Transcription failed. Please retry.' }, { status: 502 });
      }
    }
    const job = randomUUID();
    const claimed = await prisma.interviewSession.updateMany({ where: { ...identity, status: 'TRANSCRIBED' }, data: { status: 'EXTRACTING', extractionJobId: job, errorMessage: null, updatedAt: new Date() } });
    if (claimed.count !== 1) return NextResponse.json({ error: 'Extraction already started or interview changed' }, { status: 409 });
    const guard = { ...identity, status: 'EXTRACTING' as const, extractionJobId: job };
    try {
      // Read persisted transcript even on the first extraction; model text is never its own evidence.
      const segments = await prisma.transcriptSegment.findMany({ where: { interviewSessionId: interview.id }, orderBy: { order: 'asc' } });
      if (!segments.length) throw new Error('Missing transcript');
      const useCases = [ ...(interview.projectId ? ['EDITORIAL_PULLQUOTE'] : []), ...(interview.productId ? ['PRODUCT_PAGE_INSIGHT'] : []) ];
      if (!useCases.length) useCases.push('EDITORIAL_PULLQUOTE');
      const raw = await extractRecordingQuotes({ project: interview.projects, product: interview.products }, segments.map(s => ({ start: s.startMs, end: s.endMs, text: s.text })), useCases);
      const quotes = validatedQuotes(raw, segments, useCases);
      if (!quotes.length) throw new Error('No transcript-backed quotes');
      await prisma.$transaction(async tx => {
        const now = new Date();
        const moved = await tx.interviewSession.updateMany({ where: guard, data: { status: 'EXTRACTED', extractedAt: now, extractionJobId: null, updatedAt: now } });
        if (moved.count !== 1) throw new Error('Interview changed');
        await tx.quoteHighlight.deleteMany({ where: { interviewSessionId: interview.id } });
        await tx.quoteHighlight.createMany({ data: quotes.map(q => ({ ...q, id: randomUUID(), interviewSessionId: interview.id, productId: interview.productId, approvedByDesigner: false, updatedAt: now })) });
      });
      return NextResponse.json({ ok: true, interviewSession: { id: interview.id, status: 'EXTRACTED' }, transcriptSegments: segments.length, quotesExtracted: quotes.length });
    } catch {
      await prisma.interviewSession.updateMany({ where: guard, data: { status: 'TRANSCRIBED', extractionJobId: null, errorMessage: 'Quote extraction failed. Retry without retranscribing.', updatedAt: new Date() } });
      return NextResponse.json({ error: 'Quote extraction failed. Retry without retranscribing.' }, { status: 502 });
    }
  } catch { return NextResponse.json({ error: 'Processing unavailable' }, { status: 500 }); }
}

