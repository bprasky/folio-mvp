export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';
import { extractOrgProfileFields } from '@/lib/profile/extract-profile-fields';
import { applyExtractedFieldsToOrg } from '@/lib/profile/apply-extracted-fields';
import { generateOrgBio } from '@/lib/org-onboarding/generate-org-bio';
import {
  ORG_ABOUT_QUESTIONS,
  buildTranscriptFromAnswers,
} from '@/lib/org-onboarding/conversational-interview-questions';

/**
 * POST /api/profile/extract-from-interview
 *
 * Extracts structured profile fields from a completed About interview,
 * writes them to the org/user model, and generates the polished bio.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Verify user is org owner/admin
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get org and interview data
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { bioInterview: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.bioInterview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const interview = org.bioInterview;
    let transcript: string;

    if (interview.interviewFormat === 'conversational' && interview.conversationalAnswers) {
      // New conversational format: build transcript from Q&A pairs
      const answers = interview.conversationalAnswers as Record<string, string>;
      const interviewTranscript = buildTranscriptFromAnswers(answers, ORG_ABOUT_QUESTIONS);

      // If there's an imported bio, merge it with the follow-up answers
      const importedBio = (interview as any).importedBioText as string | null;
      if (importedBio && importedBio.trim()) {
        transcript = `EXISTING BIO:\n${importedBio}\n\nFOLLOW-UP INTERVIEW:\n${interviewTranscript}\n\nPrefer the follow-up interview for any field where both sources provide an answer — the interview reflects more recent and deliberate intent. Use the bio to fill gaps the interview didn't address.`;
      } else {
        transcript = interviewTranscript;
      }
    } else {
      // Legacy layered format: build transcript from structured fields
      transcript = buildLegacyTranscript(interview);
    }

    if (!transcript.trim()) {
      return NextResponse.json({ error: 'No interview content to extract from' }, { status: 400 });
    }

    // Step 1: Extract structured profile fields via Claude
    const extracted = await extractOrgProfileFields(transcript);

    // Step 2: Write extracted fields to Organization model + ProfileFieldSource records
    await applyExtractedFieldsToOrg(orgId, interview.id, extracted);

    // Step 3: Generate the polished bio (fullBio, shortBio, pullQuotes, etc.)
    // This updates OrgBioInterview and Organization.description
    if (interview.interviewFormat === 'conversational') {
      // Conversational format: pass the transcript directly
      await generateOrgBio({
        organizationId: orgId,
        orgName: org.name,
        transcript,
      });
    } else {
      // Legacy layered format: pass structured fields
      await generateOrgBio({
        organizationId: orgId,
        orgName: org.name,
        interview: {
          originStory: interview.originStory || undefined,
          philosophyStatement: interview.philosophyStatement || undefined,
          projectTypes: interview.projectTypes,
          location: interview.location || extracted.city || undefined,
          serviceRegions: interview.serviceRegions,
          idealClient: interview.idealClient || undefined,
          layer2Responses: interview.layer2Responses as Record<string, string> | undefined,
        },
      });
    }

    // Step 4: Update onboarding progress
    await prisma.orgOnboardingProgress.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        bioInterviewComplete: true,
      },
      update: {
        bioInterviewComplete: true,
      },
    });

    return NextResponse.json({ success: true, extracted });
  } catch (error) {
    console.error('[POST /api/profile/extract-from-interview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract profile fields' },
      { status: 500 }
    );
  }
}

/**
 * Build a transcript string from legacy layered interview data.
 */
function buildLegacyTranscript(interview: {
  originStory?: string | null;
  philosophyStatement?: string | null;
  projectTypes?: string[];
  location?: string | null;
  serviceRegions?: string[];
  idealClient?: string | null;
  layer2Responses?: unknown;
}): string {
  const parts: string[] = [];

  if (interview.originStory) {
    parts.push(`Q: How did the studio start?\nA: ${interview.originStory}`);
  }
  if (interview.philosophyStatement) {
    parts.push(`Q: What's your design philosophy?\nA: ${interview.philosophyStatement}`);
  }
  if (interview.projectTypes?.length) {
    parts.push(`Q: What types of projects do you focus on?\nA: ${interview.projectTypes.join(', ')}`);
  }
  if (interview.location) {
    parts.push(`Q: Where are you based?\nA: ${interview.location}`);
  }
  if (interview.idealClient) {
    parts.push(`Q: Who is your ideal client?\nA: ${interview.idealClient}`);
  }

  // Include layer2 responses if present
  if (interview.layer2Responses && typeof interview.layer2Responses === 'object') {
    for (const [key, value] of Object.entries(interview.layer2Responses as Record<string, string>)) {
      if (value) {
        parts.push(`Q: ${key}\nA: ${value}`);
      }
    }
  }

  return parts.join('\n\n');
}
