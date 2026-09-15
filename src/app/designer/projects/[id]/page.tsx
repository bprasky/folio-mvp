import { redirect } from 'next/navigation';

export default async function LegacyProjectPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = params instanceof Promise ? await params : params;
  redirect(`/project/${resolvedParams.id}`);
}
