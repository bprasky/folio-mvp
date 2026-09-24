import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { OrgType } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { createFirm, FirmAlreadyExists } from '@/lib/onboarding/create-firm';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, OrgType> = {
  designer: 'DESIGN_FIRM', architect: 'ARCHITECTURE_FIRM', builder: 'CONTRACTOR', vendor: 'VENDOR',
  DESIGN_FIRM: 'DESIGN_FIRM', ARCHITECTURE_FIRM: 'ARCHITECTURE_FIRM', CONTRACTOR: 'CONTRACTOR',
  VENDOR: 'VENDOR', MANUFACTURER: 'MANUFACTURER', SHOWROOM: 'SHOWROOM',
  PHOTOGRAPHY_STUDIO: 'PHOTOGRAPHY_STUDIO', DEVELOPER: 'DEVELOPER',
};
const schema = z.object({
  name: z.string().trim().min(2, 'Enter your firm name.').max(120),
  type: z.string().refine((value) => Object.hasOwn(TYPES, value), 'Choose your firm type.'),
  location: z.string().trim().max(120).optional(),
  website: z.string().url('Enter a full website URL.').max(200).optional().or(z.literal('')),
  confirmed: z.literal(true, { error: 'Confirm you are authorized to create this firm.' }),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const org = await createFirm({ ...parsed.data, type: TYPES[parsed.data.type], userId: session.user.id });
    return NextResponse.json({ organizationId: org.id, organizationName: org.name, org, nextPath: '/projects/new' }, { status: 201 });
  } catch (error) {
    if (error instanceof FirmAlreadyExists) {
      return NextResponse.json({ code: 'FIRM_EXISTS', error: error.message, organization: error.organization }, { status: 409 });
    }
    console.error('[firm enrollment] Create failed:', error);
    return NextResponse.json({ error: 'Could not create your firm. Please try again.' }, { status: 500 });
  }
}
