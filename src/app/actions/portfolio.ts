'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { publishPortfolio, unpublishPortfolio } from '@/lib/publish/portfolio';

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Sign in to continue.');
  return session.user.id;
}
function refresh(projectId: string) {
  revalidatePath(`/project/${projectId}`);
  revalidatePath('/designer');
  revalidatePath('/designer/profile');
  revalidatePath('/projects');
  revalidatePath('/org', 'layout');
  revalidatePath('/p', 'layout');
}
export async function publishPortfolioAction(input: unknown) {
  const result = await publishPortfolio(await actor(), input);
  refresh(result.projectId);
  return result;
}
export async function unpublishPortfolioAction(projectId: string) {
  await unpublishPortfolio(await actor(), projectId);
  refresh(projectId);
}
