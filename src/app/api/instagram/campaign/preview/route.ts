import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { selectCampaignContent, CampaignPreset } from '@/lib/instagram/campaign/selectCampaignContent';

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

    // Get campaign content selection
    const contentSelection = await selectCampaignContent(projectId, preset);

    return NextResponse.json(contentSelection);
  } catch (error: any) {
    console.error('Campaign preview error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
