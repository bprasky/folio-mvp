import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { StudioBioActivity } from '@/components/publishing-studio/StudioBioActivity';

export const metadata = { title: 'About me | Publishing Studio | Folio' };

export default async function StudioAboutMePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <StudioBioActivity profileUrl={`/profile/${encodeURIComponent(session.user.id)}?tab=about`} />;
}
