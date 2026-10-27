import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { parseProtectedPhotoUrl } from '@/lib/files/projectPhotoUrl';
import { downloadProjectPhotoObject } from '@/lib/server/protected-project-photo';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' };

export async function GET(request: NextRequest) {
  const url = new URL(request.url).pathname;
  const object = parseProtectedPhotoUrl(url);
  if (!object) return new NextResponse(null, { status: 404, headers });
  try {
    const session = await getServerSession(authOptions);
    let privateAccess = false;
    if (session?.user?.id) {
      try { await assertProjectView(session.user.id, object.projectId); privateAccess = true; }
      catch (error) { if (!(error instanceof Error) || !['Forbidden', 'NotFound'].includes(error.message)) throw error; }
    }
    const image = await prisma.projectImage.findFirst({ where: {
      projectId: object.projectId, url,
      ...(privateAccess ? {} : { inclusion: 'INCLUDED', project: PUBLISHED_PROJECT_FILTER }),
    }, select: { id: true } });
    const crop = image ? null : await prisma.productTag.findFirst({ where: {
      cropUrl: url, image: { projectId: object.projectId, ...(privateAccess ? {} : { inclusion: 'INCLUDED', project: PUBLISHED_PROJECT_FILTER }) },
      ...(privateAccess ? {} : { product: { isPending: false } }),
    }, select: { id: true } });
    if (!image && !crop) return new NextResponse(null, { status: 404, headers });
    const { buffer, mime } = await downloadProjectPhotoObject(object.path);
    return new NextResponse(buffer, { headers: { ...headers, 'Content-Type': mime, 'Content-Length': String(buffer.length) } });
  } catch {
    return new NextResponse(null, { status: 503, headers });
  }
}
