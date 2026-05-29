/**
 * POST /api/projects/[id]/import-spec
 *
 * Wizard spec step: extract product specifications from an uploaded PDF and
 * stage them as reviewable PendingProductTag rows (source = SPEC) on a new
 * ImportSession. The client reviews them, then POSTs /api/import/[sessionId]/
 * finalize to materialize selections.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { extractSpecificationsFromPDF } from '@/lib/pdf';
import { pdfSpecToPendingTags } from '@/lib/import-agent/pdfSpecToPendingTags';

const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
      await assertProjectWrite(userId, projectId);
    } catch (e: any) {
      if (e?.message === 'NotFound') {
        return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Create the session up front so a failure still leaves a record.
    const importSession = await prisma.importSession.create({
      data: {
        userId,
        sourceType: 'PRESENTATION',
        fileName: file.name,
        projectId,
        status: 'PROCESSING',
      },
    });

    let tagCount = 0;
    try {
      const result = await extractSpecificationsFromPDF(buffer, {
        generateImageSearchQueries: true,
        useVisualAnalysis: true,
        maxItemsPerPage: 20,
      });

      // Keep a PdfExtraction record for traceability.
      await prisma.pdfExtraction.create({
        data: {
          projectId,
          fileName: file.name,
          result: result as unknown as object as any,
          status: 'pending_review',
          createdBy: userId,
        },
      });

      tagCount = await pdfSpecToPendingTags(importSession.id, result);
    } catch (extractErr: any) {
      console.error('[import-spec] extraction failed:', extractErr?.message);
      await prisma.importSession.update({
        where: { id: importSession.id },
        data: { status: 'FAILED', errorMessage: 'We couldn’t read specifications from that PDF.' },
      });
      return NextResponse.json({ error: 'PDF extraction failed. Please try again.' }, { status: 500 });
    }

    await prisma.importSession.update({
      where: { id: importSession.id },
      data: {
        status: tagCount > 0 ? 'READY_FOR_REVIEW' : 'FAILED',
        errorMessage: tagCount > 0 ? null : 'No product specifications were found in that PDF.',
      },
    });

    return NextResponse.json({ sessionId: importSession.id, tagCount });
  } catch (error) {
    console.error('[import-spec] error:', error);
    return NextResponse.json({ error: 'Failed to import specifications' }, { status: 500 });
  }
}
