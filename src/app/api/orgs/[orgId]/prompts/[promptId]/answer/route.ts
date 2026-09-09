export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { rateLimit } from '@/lib/rateLimit';

/**
 * POST /api/orgs/[orgId]/prompts/[promptId]/answer
 * Vendor answers a curated prompt → generates article content → creates VendorPost.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string; promptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { orgId, promptId } = resolvedParams;
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    const { answer } = body;

    if (typeof answer !== 'string' || !answer.trim() || answer.length > 10000) {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    // Verify user is org member
    const membership = await prisma.organizationUser.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership?.isActive || !isOrgRole(membership.role) || !can(membership.role, 'edit_org_profile')) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }
    const limit = await rateLimit({ userId: session.user.id, scope: 'vendor-prompt-answer', limit: 20, windowMs: 3600000 });
    if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const defaults = ['default-story', 'default-product', 'default-designers'];
    if (promptId.startsWith('default-') && !defaults.includes(promptId)) return NextResponse.json({ error: 'Unknown prompt' }, { status: 404 });
    let ownPrompt = false;
    if (!defaults.includes(promptId)) {
      const prompt = await prisma.vendorPrompt.findFirst({ where: { id: promptId, OR: [{ organizationId: orgId }, { organizationId: null }], status: 'ACTIVE' }, select: { id: true, organizationId: true } });
      if (!prompt) return NextResponse.json({ error: 'Prompt unavailable' }, { status: 404 });
      ownPrompt = prompt.organizationId === orgId;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    // Generate article content from the answer
    // For now, structure the answer as clean editorial content.
    // In production, this would call Claude to expand the answer into a full article.
    const title = answer.length > 60 ? answer.slice(0, 57) + '...' : answer;
    const slug = `${org?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'vendor'}-${Date.now()}`;

    const content = `${answer}`;

    // Create VendorPost
    try {
      const post = await prisma.vendorPost.create({
        data: {
          organizationId: orgId,
          authorId: session.user.id,
          title,
          slug,
          content,
          excerpt: answer.slice(0, 200),
          contentType: 'article',
          status: 'DRAFT', // Start as draft for review
          promptId: promptId.startsWith('default-') ? null : promptId,
          promptAnswers: { question: promptId, answer },
        },
      });

      // Update prompt status if it's a real prompt (not a default)
      if (ownPrompt) {
        try {
          await prisma.vendorPrompt.update({
            where: { id: promptId, organizationId: orgId },
            data: { status: 'ANSWERED', answeredAt: new Date(), answeredPostId: post.id },
          });
        } catch {
          // Prompt may not exist in DB (was a default)
        }
      }

      return NextResponse.json({
        success: true,
        post: { id: post.id, slug: post.slug, status: post.status },
      });
    } catch (createError) {
      // VendorPost table might not exist yet
      console.error('[prompts/answer] VendorPost creation failed:', createError);
      return NextResponse.json({ error: 'Unable to save the answer' }, { status: 503 });
    }
  } catch (error) {
    console.error('[prompts/answer] Error:', error);
    return NextResponse.json({ error: 'Failed to process answer' }, { status: 500 });
  }
}
