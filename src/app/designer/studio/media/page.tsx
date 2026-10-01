import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { InterviewMediaLibrary } from '@/components/publishing-studio/InterviewMediaLibrary';
import { mediaSchemaReady } from '@/lib/interview-media/store';
export const metadata = { title: 'Interview media | Folio Publishing Studio' };
export default async function InterviewMediaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  if (!await mediaSchemaReady()) return <main className="mx-auto max-w-5xl px-6 py-10">
    <h1 className="folio-h1">Interview media</h1>
    <p className="folio-body mt-4">Interview recordings and media are not available yet. You can continue working in Publishing Studio.</p>
    <Link href="/designer/studio" className="folio-meta mt-6 inline-block underline">Back to Publishing Studio</Link>
  </main>;
  return <main className="mx-auto max-w-5xl px-6 py-10"><InterviewMediaLibrary /></main>;
}
