import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ForYouFeed } from '@/components/discovery/ForYouFeed';

export const metadata = {
  title: 'For You | Folio',
  description: 'Products matched to your design taste — powered by your saves, tags, and project history.',
};

export default async function ForYouPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/for-you');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10">
      <ForYouFeed />
    </div>
  );
}
