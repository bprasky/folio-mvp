import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { InterviewMediaLibrary } from '@/components/publishing-studio/InterviewMediaLibrary';
export const metadata = { title: 'Interview media | Folio Publishing Studio' };
export default async function InterviewMediaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <main className="mx-auto max-w-5xl px-6 py-10"><InterviewMediaLibrary /></main>;
}
