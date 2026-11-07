import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { parseFinishSchedule } from '@/lib/import-agent/parseFinishSchedule';
import { finishScheduleToPendingTags } from '@/lib/import-agent/finishScheduleToPendingTags';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let importId: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const form = await req.formData();
    const file = form.get('file');
    const projectId = form.get('projectId');
    if (!file || typeof file === 'string' || typeof projectId !== 'string' || !projectId) {
      return NextResponse.json({ error: 'A file and project are required.' }, { status: 400 });
    }
    try { await assertProjectWrite(session.user.id, projectId); }
    catch { return NextResponse.json({ error: 'Not permitted' }, { status: 403 }); }
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Please use a file smaller than 10 MB.' }, { status: 413 });
    let rows;
    try { rows = await parseFinishSchedule(Buffer.from(await file.arrayBuffer()), file.name); }
    catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read this file.' }, { status: 422 });
    }
    if (!rows.length || rows.length > 200) return NextResponse.json({
      error: rows.length ? 'Please import at most 200 products at a time.' : 'No product rows found. Include Product, Brand and Room headers.',
    }, { status: 422 });

    // Persist the parsed source, not a public copy of a private finish book.
    // Parsing does not depend on storage availability or a Supabase cookie session.
    const tagCount = await prisma.$transaction(async tx => {
      const imported = await tx.importSession.create({ data: {
        userId: session.user.id, projectId, sourceType: 'PRESENTATION', fileName: file.name,
        status: 'PROCESSING', processingMeta: { kind: 'finish-schedule', version: 1 },
      } });
      importId = imported.id;
      const count = await finishScheduleToPendingTags(imported.id, rows, tx);
      await tx.importSession.update({ where: { id: imported.id }, data: { status: 'READY_FOR_REVIEW' } });
      return count;
    });
    return NextResponse.json({ sessionId: importId, status: 'READY_FOR_REVIEW', projectId, tagCount }, { status: 201 });
  } catch (error) {
    console.error('[finish-schedule] import failed:', error);
    if (importId) await prisma.importSession.update({ where: { id: importId }, data: {
      status: 'FAILED', errorMessage: 'Could not finish staging this schedule. Please retry.', completedAt: new Date(),
    } }).catch(() => {});
    return NextResponse.json({ error: 'Could not import this schedule. Please retry.' }, { status: 500 });
  }
}
