export const dynamic = 'force-dynamic';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { INTERVIEW_MIME, MAX_INTERVIEW_BYTES } from '@/lib/interviews/format';
import { isWebM, mediaBucket, objectKey, removeMedia } from '@/lib/interviews/media';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const interview = await prisma.interviewSession.findUnique({ where: { id: params.id }, include: { MediaAsset: true } });
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (interview.createdByUserId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['DRAFT', 'UPLOADED'].includes(interview.status)) return NextResponse.json({ error: 'Recording cannot be replaced in this state' }, { status: 409 });
    const bucket = mediaBucket();
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_INTERVIEW_BYTES + 64 * 1024) return NextResponse.json({ error: 'Recording request is too large' }, { status: 413 });
    const file = (await request.formData()).get('file');
    if (!file || typeof file === 'string' || file.type !== INTERVIEW_MIME || !file.size) return NextResponse.json({ error: 'A nonempty audio/webm recording is required' }, { status: 400 });
    if (file.size > MAX_INTERVIEW_BYTES) return NextResponse.json({ error: 'Recording exceeds 4 MiB' }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!isWebM(bytes)) return NextResponse.json({ error: 'Invalid WebM recording' }, { status: 400 });
    const id = randomUUID();
    const key = `interviews/${interview.id}/${id}.webm`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(key, bytes, { contentType: INTERVIEW_MIME, upsert: false });
    if (error) return NextResponse.json({ error: 'Recording upload failed' }, { status: 502 });
    try {
      await prisma.$transaction(async tx => {
        const now = new Date();
        await tx.mediaAsset.create({ data: { id, storageKey: key, url: `storage://${bucket}/${key}`, mimeType: INTERVIEW_MIME, fileSizeBytes: file.size, metadata: { bucket }, updatedAt: now } });
        const linked = await tx.interviewSession.updateMany({
          where: { id: interview.id, createdByUserId: session.user.id, status: interview.status, recordingAssetId: interview.recordingAssetId, updatedAt: interview.updatedAt },
          data: { recordingAssetId: id, status: 'UPLOADED', recordedAt: now, uploadedAt: now, errorMessage: null, updatedAt: now },
        });
        if (linked.count !== 1) throw new Error('Concurrent interview change');
        if (interview.recordingAssetId) await tx.mediaAsset.delete({ where: { id: interview.recordingAssetId } });
      });
    } catch {
      await removeMedia(key);
      return NextResponse.json({ error: 'Recording was not saved; retry after refreshing' }, { status: 409 });
    }
    if (interview.MediaAsset) {
      try { await removeMedia(objectKey(interview.id, interview.MediaAsset)); }
      catch { console.warn('[interview-media] previous-object-cleanup-unavailable'); }
    }
    return NextResponse.json({ ok: true, interviewSession: { id: interview.id, status: 'UPLOADED' } });
  } catch { return NextResponse.json({ error: 'Recording upload unavailable' }, { status: 500 }); }
}

