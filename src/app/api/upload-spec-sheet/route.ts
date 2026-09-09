export const dynamic = 'force-dynamic';

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectWrite } from '@/lib/authz/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const form = await request.formData();
    const projectId = form.get('projectId');
    if (typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    await assertProjectWrite(session.user.id, projectId);
    const file = form.get('file');
    if (!file || typeof file === 'string' || file.type !== 'application/pdf' || file.size === 0) {
      return NextResponse.json({ error: 'Provide a non-empty PDF spec sheet. Other document formats are not supported.' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximum file size is 10MB' }, { status: 400 });
    }
    // Existing document bucket. The image bucket rejects PDFs and other documents.
    const bucket = supabaseAdmin.storage.from('imports');
    const path = `projects/${projectId}/spec-sheets/${randomUUID()}.pdf`;
    const { error } = await bucket.upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = bucket.getPublicUrl(path);
    if (!data.publicUrl) throw new Error('Storage returned no document URL');
    // The object is durable; saving its URL on a Selection is a separate mutation.
    return NextResponse.json({ success: true, url: data.publicUrl, fileName: file.name, size: file.size, type: file.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Spec sheet upload failed:', error);
    return NextResponse.json({ error: 'Failed to upload spec sheet' }, { status: 500 });
  }
}
