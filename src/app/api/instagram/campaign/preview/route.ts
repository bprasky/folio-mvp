import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { selectCampaignContent, CampaignPreset } from '@/lib/instagram/campaign/selectCampaignContent';
import { assertProjectWrite } from '@/lib/authz/access';

export const runtime = 'nodejs';

interface PreviewRequest {
  projectId: string;
  preset: CampaignPreset;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body: PreviewRequest = await request.json();
    const { projectId, preset } = body;

    if (!projectId || !preset) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, preset' },
        { status: 400 }
      );
    }

    // Preview includes source text; authenticate the project before reading it.
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Get campaign content selection
    const contentSelection = await selectCampaignContent(projectId, preset);

    return NextResponse.json(contentSelection);
  } catch (error: any) {
    console.error('Campaign preview error:', error);
    const raw = error?.message || 'Failed to generate preview';
    const ineligible = raw.startsWith('CAMPAIGN_INELIGIBLE:');
    const message = ineligible ? raw.replace(/^CAMPAIGN_INELIGIBLE:\s*/, '') : raw;
    return NextResponse.json({ error: message }, { status: ineligible ? 400 : 500 });
  }
}
