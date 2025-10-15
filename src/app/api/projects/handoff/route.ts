import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { getVendorContext } from '@/lib/auth/vendorContext';

async function getUserIdFromRequest(req: Request) {
  // 1) Primary: NextAuth session
  const session = await getServerSession();
  if (session?.user?.id) return session.user.id;

  // 2) Fallback: decode JWT from cookies (works when getServerSession fails)
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (token?.sub) return String(token.sub);
    if ((token as any)?.id) return String((token as any).id);
  } catch {}

  // 3) Dev override header (demo only)
  if (process.env.NODE_ENV !== 'production') {
    const devId = req.headers.get('x-dev-user-id');
    if (devId) return devId;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const vendorCtx = await getVendorContext();

    // — normalize fields —
    const rawName = (body?.name ?? body?.projectName ?? "").trim();
    const name = rawName.length ? rawName : "Untitled project";
    const note = typeof body?.note === "string" ? body.note : "";

    // — create project —
    const project = await prisma.project.create({
      data: {
        title: name,   // Use title field (schema uses title, not name)
        description: note,
        vendorOrgId: vendorCtx?.vendorOrgId ?? null,
        designerOrgId: body?.designerOrgId || null,
        ownerId: userId,
        isHandoffReady: !!(body?.designerOrgId || body?.designerEmail),
        handoffInvitedAt: (body?.designerOrgId || body?.designerEmail) ? new Date() : null,
        clientType: 'RESIDENTIAL',
        isPublic: false,
        isAIEnabled: true,
        views: 0,
        saves: 0,
        shares: 0,
      },
      select: { id: true, title: true, createdAt: true },
    });

    // — (demo) skip/soft-fail participants —
    if (vendorCtx?.vendorOrgId) {
      try {
        await (prisma as any).projectParticipant.create({
          data: {
            projectId: project.id as any,
            organizationId: vendorCtx.vendorOrgId as any,
            side: "VENDOR" as any,
            role: "EDITOR" as any,
          },
        });
      } catch (e) {
        console.warn("[DEMO] participant create skipped:", (e as any)?.code || (e as any)?.message);
      }
    }

    // --- Create a visit token reliably (single-table model) ---
    let visit: { token: string; url: string } | null = null;
    try {
      const token = crypto.randomUUID();
      // If your schema stores token on VendorVisit (most likely from the error logs):
      // Accept either recipientEmail or designerEmail from the body
      const emailRaw = (body?.recipientEmail ?? body?.designerEmail ?? "").trim().toLowerCase();
      if (!emailRaw) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

      const vv = await prisma.vendorVisit.create({
        data: {
          token,
          projectId: project.id as any,
          designerEmail: emailRaw,           // ✅ your DB column
          vendorId: userId,
          note: note || null,
        },
        select: { id: true, token: true, createdAt: true },
      });

      // (optional but recommended) mark vendor project as invited
      await prisma.project.update({
        where: { id: project.id as any },
        data: { handoffInvitedAt: new Date() },
      }).catch(() => {});

      const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
      visit = { token: vv.token, url: `${base}/visit/${vv.token}` };
    } catch (e) {
      console.warn("[DEMO] visit creation skipped:", (e as any)?.code || (e as any)?.message);
    }

    return NextResponse.json({ project, visit }, { status: 201 });
  } catch (err) {
    console.error("handoff POST error:", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// Designer claims project ownership
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { projectId, designerUserId, designerOrgId } = body;

    if (!projectId || !designerUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, designerUserId' },
        { status: 400 }
      );
    }

    // For testing, return a mock updated project
    const mockUpdatedProject = {
      id: projectId,
      designerId: designerUserId,
      ownerId: designerUserId,
      designerOrgId: designerOrgId || undefined,
      handoffClaimedAt: new Date(),
      isHandoffReady: false,
      vendorOrg: {
        id: 'test-vendor-org',
        name: 'Vendor Co',
        description: 'Premium furniture vendor',
      },
      designerOrg: designerOrgId ? {
        id: designerOrgId,
        name: 'Design Studio Alpha',
        description: 'Creative design studio',
      } : null,
      owner: {
        id: designerUserId,
        name: 'Designer User',
        email: 'designer@example.com',
      },
      designer: {
        id: designerUserId,
        name: 'Designer User',
        email: 'designer@example.com',
      },
      rooms: [
        {
          id: 'room-1',
          name: 'Kitchen',
          selections: [],
        },
      ],
      selections: [],
    };

    return NextResponse.json(mockUpdatedProject);
  } catch (error) {
    console.error('Error claiming project:', error);
    return NextResponse.json(
      { error: 'Failed to claim project' },
      { status: 500 }
    );
  }
}

// Get projects ready for handoff
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const designerEmail = searchParams.get('designerEmail');
    const vendorOrgId = searchParams.get('vendorOrgId');

    // For testing, return mock projects
    const mockProjects = [
      {
        id: 'test-project-1',
        name: 'Modern Kitchen Renovation',
        description: 'Contemporary kitchen design with premium fixtures',
        vendorOrgId: vendorOrgId || 'test-vendor-org',
        designerOrgId: 'test-designer-org',
        ownerId: 'test-vendor-user',
        isHandoffReady: true,
        handoffInvitedAt: new Date(),
        vendorOrg: {
          id: 'test-vendor-org',
          name: 'Vendor Co',
          description: 'Premium furniture vendor',
        },
        designerOrg: {
          id: 'test-designer-org',
          name: 'Design Studio Alpha',
          description: 'Creative design studio',
        },
        owner: {
          id: 'test-vendor-user',
          name: 'John Vendor',
          email: 'john@vendorco.com',
        },
        rooms: [
          {
            id: 'room-1',
            name: 'Kitchen',
            selections: [],
          },
        ],
        selections: [],
      },
    ];

    return NextResponse.json(mockProjects);
  } catch (error) {
    console.error('Error fetching handoff projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch handoff projects' },
      { status: 500 }
    );
  }
} 