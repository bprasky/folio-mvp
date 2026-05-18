import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  nextOnboardingStep,
  resumePathForStep,
  isProfessionalRole,
} from '@/lib/onboarding/resume';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      onboardingDiagnosticAt: true,
      onboardingFirmContextAt: true,
      onboardingBioCaptureAt: true,
      onboardingProfilePreviewAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const step = nextOnboardingStep(user.role, user);

  return NextResponse.json({
    role: user.role,
    isProfessional: isProfessionalRole(user.role),
    nextStep: step,
    resumePath: resumePathForStep(step),
    completed: step === 'done',
    timestamps: {
      diagnostic: user.onboardingDiagnosticAt,
      firmContext: user.onboardingFirmContextAt,
      bioCapture: user.onboardingBioCaptureAt,
      profilePreview: user.onboardingProfilePreviewAt,
    },
  });
}
