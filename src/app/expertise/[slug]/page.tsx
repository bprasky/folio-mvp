import { expertiseEnabled } from '@/lib/publishing-studio/expertise/flag';
import { notFound } from 'next/navigation';
import { publicExpertise } from '@/lib/publishing-studio/expertise/service';
import { ExpertiseArticleView } from '@/components/publishing-studio/expertise/ExpertiseArticleView';
export const dynamic = 'force-dynamic';
export default async function ExpertiseArticlePage({ params }: { params: { slug: string } }) {
  if (!expertiseEnabled()) notFound();
  const story = await publicExpertise(params.slug);
  if (!story) notFound();
  return <ExpertiseArticleView article={story.article} author={story.owner} />;
}
